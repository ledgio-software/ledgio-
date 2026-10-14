import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import { onboardTenant } from '../services/tenantService';
import { deleteTenantBySlug, ensureTenantTableExists } from '../repository/tenantRepository';
import { deleteUserByEmail, ensureUserTableExists } from '../repository/userRepository';
import { dropTenantSchema } from '../database/tenantSchemaManager';
import { invalidateTenantCacheById } from '../cache/tenantCache';

describe('Plan tiers (Shop/Business/Enterprise) - feature gating, admin upgrade, and seat limits', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = `tier-corp-${runId}`;
  const tenantSchema = `tenant_tier_corp_${runId}`;
  const adminEmail = `admin_tier_${runId}@corp.com`;
  const masterPasscode = process.env.BROADCAST_MASTER_SECRET;

  let adminToken: string;
  let tenantId: string;

  async function cleanupTestData() {
    if (tenantId) {
      await prisma.job.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId, email: { not: adminEmail } } }).catch(() => {});
    }
    await deleteTenantBySlug(prisma, tenantSlug).catch(() => {});
    await deleteUserByEmail(prisma, adminEmail).catch(() => {});
    await dropTenantSchema(prisma, tenantSchema).catch(() => {});
  }

  beforeAll(async () => {
    await prisma.$connect();
    await ensureTenantTableExists(prisma);
    await ensureUserTableExists(prisma);
    await cleanupTestData();

    const onboard = await onboardTenant(prisma, {
      companyName: 'Tier Corp',
      slug: tenantSlug,
      adminEmail,
      adminPassword: 'Password123!',
      adminName: 'Tier Admin',
    });
    adminToken = onboard.token;
    tenantId = onboard.tenant.id;
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('a newly onboarded tenant defaults to the Shop plan (tier 1)', async () => {
    const res = await request(app)
      .get('/api/v1/tenants/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(res.status).toBe(200);
    expect(res.body.data.tenant.tier).toBe(1);
  });

  it('a newly onboarded tenant gets a 30-day free trial', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(tenant.subscriptionStatus).toBe('TRIAL');
    const days = (tenant.trialEndsAt!.getTime() - tenant.createdAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  describe('Business-tier routes are blocked on the Shop plan', () => {
    const cases: [string, string][] = [
      ['GET', '/api/v1/banking/accounts'],
      ['GET', '/api/v1/recurring-transactions'],
      ['GET', '/api/v1/budgets'],
      ['GET', '/api/v1/approval-workflows'],
    ];

    it.each(cases)('%s %s returns 403 with upgradeRequired', async (method, path) => {
      const res = await (request(app) as any)
        [method.toLowerCase()](path)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-ID', tenantSlug);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.upgradeRequired).toBe(true);
      // Tenant defaults to the retail sector, whose tier-2 plan is "Standard".
      expect(res.body.error).toContain('Standard plan');
    });
  });

  describe('Admin plan-tier management (PUT /tenants/:id/tier)', () => {
    it('rejects a missing/invalid master passcode', async () => {
      const res = await request(app).put(`/api/v1/tenants/${tenantId}/tier`).send({ tier: 2, passcode: 'wrong-passcode' });
      expect(res.status).toBe(401);
    });

    (masterPasscode ? it : it.skip)('rejects an invalid tier value', async () => {
      const res = await request(app).put(`/api/v1/tenants/${tenantId}/tier`).send({ tier: 99, passcode: masterPasscode });
      expect(res.status).toBe(400);
    });

    (masterPasscode ? it : it.skip)('upgrades the tenant to Business (tier 2), and Business-tier routes succeed afterward', async () => {
      const upgrade = await request(app).put(`/api/v1/tenants/${tenantId}/tier`).send({ tier: 2, passcode: masterPasscode });
      expect(upgrade.status).toBe(200);
      expect(upgrade.body.data.tenant.tier).toBe(2);

      const res = await request(app)
        .get('/api/v1/recurring-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-ID', tenantSlug);
      expect(res.status).toBe(200);
    });

    (masterPasscode ? it : it.skip)('downgrades back to Shop (tier 1) so later tests in this file are unaffected', async () => {
      const res = await request(app).put(`/api/v1/tenants/${tenantId}/tier`).send({ tier: 1, passcode: masterPasscode });
      expect(res.status).toBe(200);
      expect(res.body.data.tenant.tier).toBe(1);
    });
  });

  describe('Sector Starter unlocks', () => {
    async function setSector(sector: string) {
      await prisma.tenant.update({ where: { id: tenantId }, data: { sector } });
      await invalidateTenantCacheById(tenantId);
    }

    afterAll(async () => {
      await prisma.job.deleteMany({ where: { tenantId } });
      await setSector('retail');
    });

    it('a manufacturing Starter tenant can use Job Costing and Manufacturing, but not other Business features', async () => {
      await setSector('manufacturing');
      const auth = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`).set('X-Tenant-ID', tenantSlug);

      expect((await auth(request(app).get('/api/v1/jobs'))).status).toBe(200);
      expect((await auth(request(app).get('/api/v1/manufacturing/bom-templates'))).status).toBe(200);
      expect((await auth(request(app).get('/api/v1/budgets'))).status).toBe(403);

      const current = await auth(request(app).get('/api/v1/tenants/current'));
      expect(current.body.data.tenant.starterUnlocks).toEqual(['Job Costing', 'Manufacturing']);
    });

    it('a retail Starter tenant is still blocked from Job Costing', async () => {
      await setSector('retail');
      const res = await request(app).get('/api/v1/jobs').set('Authorization', `Bearer ${adminToken}`).set('X-Tenant-ID', tenantSlug);
      expect(res.status).toBe(403);
    });

    it('a construction Starter tenant can create jobs up to 5 active, then is asked to upgrade', async () => {
      await setSector('construction');
      await prisma.job.createMany({
        data: [1, 2, 3, 4].map((n) => ({ tenantId, jobNumber: `JOB-T${n}`, name: `Site ${n}`, status: n % 2 ? 'OPEN' : 'IN_PROGRESS' })),
      });
      await prisma.job.create({ data: { tenantId, jobNumber: 'JOB-T9', name: 'Finished site', status: 'COMPLETED' } });

      const create = (name: string) =>
        request(app).post('/api/v1/jobs').set('Authorization', `Bearer ${adminToken}`).set('X-Tenant-ID', tenantSlug).send({ name });

      expect((await create('Fifth active job')).status).toBe(201);
      const blocked = await create('Sixth active job');
      expect(blocked.status).toBe(403);
      expect(blocked.body.upgradeRequired).toBe(true);
      expect(blocked.body.error).toContain('up to 5 active jobs');
    });
  });

  describe('Seat limits (POST /tenants/invite)', () => {
    it('blocks inviting beyond the Shop plan seat limit (3 active members)', async () => {
      // Admin already counts as 1 active member. Directly seed 2 more active
      // users (bypassing the full invite-accept flow, which isn't the thing
      // under test here) to reach the Shop plan's cap of 3.
      await prisma.user.createMany({
        data: [
          { email: `seat1_${runId}@corp.com`, password: 'x', name: 'Seat One', role: 'Accountant', tenantId, isActive: true, isEmailVerified: true },
          { email: `seat2_${runId}@corp.com`, password: 'x', name: 'Seat Two', role: 'Accountant', tenantId, isActive: true, isEmailVerified: true },
        ],
      });

      const res = await request(app)
        .post('/api/v1/tenants/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-ID', tenantSlug)
        .send({ email: `overcap_${runId}@corp.com`, role: 'Accountant' });

      expect(res.status).toBe(403);
      expect(res.body.upgradeRequired).toBe(true);
      expect(res.body.error).toContain('Starter plan is limited to 3');
    });
  });
});
