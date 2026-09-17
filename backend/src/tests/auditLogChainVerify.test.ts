/**
 * Integration tests for GET /api/v1/audit-logs/verify-chain
 *
 * Three scenarios:
 *   1. No chained entries → intact: true, checkedRows: 0
 *   2. A valid chain seeded correctly → intact: true
 *   3. A chain with a tampered prevHash → intact: false, brokenAtId reported
 */
import { createHash } from 'crypto';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import { onboardTenant } from '../services/tenantService';
import { deleteTenantBySlug, ensureTenantTableExists } from '../repository/tenantRepository';
import { deleteUserByEmail, ensureUserTableExists } from '../repository/userRepository';
import { dropTenantSchema } from '../database/tenantSchemaManager';
import { deleteAuditLogs } from './testHelpers';

describe('GET /api/v1/audit-logs/verify-chain', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = `chain-verify-corp-${runId}`;
  const tenantSchema = `tenant_chain_verify_corp_${runId}`;
  const adminEmail = `admin_chainverify_${runId}@corp.com`;

  let token: string;
  let tenantId: string;

  const genesisHash = createHash('sha256').update('GENESIS').digest('hex');

  function rowHash(prevHash: string, action: string, entityId: string | null, createdAt: Date): string {
    return createHash('sha256')
      .update(prevHash + action + (entityId ?? '') + new Date(createdAt).toISOString())
      .digest('hex');
  }

  async function cleanup() {
    if (tenantId) await deleteAuditLogs(prisma, { tenantId }).catch(() => {});
    await deleteTenantBySlug(prisma, tenantSlug).catch(() => {});
    await deleteUserByEmail(prisma, adminEmail).catch(() => {});
    await dropTenantSchema(prisma, tenantSchema).catch(() => {});
  }

  beforeAll(async () => {
    await prisma.$connect();
    await ensureTenantTableExists(prisma);
    await ensureUserTableExists(prisma);
    await cleanup();

    const onboard = await onboardTenant(prisma, {
      companyName: 'Chain Verify Corp',
      slug: tenantSlug,
      adminEmail,
      adminPassword: 'Password123!',
      adminName: 'Chain Verify Admin',
    });
    token = onboard.token;
    tenantId = onboard.tenant.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('returns intact:true with checkedRows:0 when no chained entries exist', async () => {
    // onboarding may write unchained rows (prevHash: null); none have prevHash set yet
    const res = await request(app)
      .get('/api/v1/audit-logs/verify-chain')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantSlug);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intact).toBe(true);
    expect(res.body.data.checkedRows).toBe(0);
  });

  it('returns intact:true for a correctly chained sequence', async () => {
    const t1 = new Date('2024-01-01T09:00:00.000Z');
    const t2 = new Date('2024-01-01T09:00:01.000Z');
    const t3 = new Date('2024-01-01T09:00:02.000Z');

    const h1 = rowHash(genesisHash, 'INVOICE.CREATED', 'inv-1', t1);
    const h2 = rowHash(h1, 'INVOICE.PAID', 'inv-1', t2);

    await prisma.auditLog.createMany({
      data: [
        {
          tenantId,
          action: 'INVOICE.CREATED',
          entity: 'Invoice',
          entityId: 'inv-1',
          createdAt: t1,
          prevHash: genesisHash,
        },
        {
          tenantId,
          action: 'INVOICE.PAID',
          entity: 'Invoice',
          entityId: 'inv-1',
          createdAt: t2,
          prevHash: h1,
        },
        {
          tenantId,
          action: 'INVOICE.EMAILED',
          entity: 'Invoice',
          entityId: 'inv-1',
          createdAt: t3,
          prevHash: h2,
        },
      ],
    });

    const res = await request(app)
      .get('/api/v1/audit-logs/verify-chain')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantSlug);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intact).toBe(true);
    expect(res.body.data.checkedRows).toBe(3);
  });

  it('returns intact:false with brokenAtId when a prevHash has been tampered', async () => {
    const t1 = new Date('2024-02-01T10:00:00.000Z');
    const t2 = new Date('2024-02-01T10:00:01.000Z');

    // Row 1 is valid (genesis), row 2 has a corrupted prevHash
    const goodRow = await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'BILL.CREATED',
        entity: 'Bill',
        entityId: 'bill-99',
        createdAt: t1,
        prevHash: genesisHash,
      },
    });

    const tamperedRow = await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'BILL.APPROVED',
        entity: 'Bill',
        entityId: 'bill-99',
        createdAt: t2,
        prevHash: 'TAMPERED_HASH_THAT_DOES_NOT_MATCH',
      },
    });

    const res = await request(app)
      .get('/api/v1/audit-logs/verify-chain')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantSlug);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intact).toBe(false);
    // The tampered row is after our valid chain rows, so we just need to
    // confirm the endpoint reports a broken link.
    expect(res.body.data.brokenAtId).toBeDefined();
    expect(typeof res.body.data.brokenAtId).toBe('string');
    expect(res.body.data.message).toMatch(/broken/i);

    // Cleanup to avoid bleeding into other tests
    await deleteAuditLogs(prisma, { id: { in: [goodRow.id, tamperedRow.id] } });
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs/verify-chain')
      .set('X-Tenant-ID', tenantSlug);
    expect(res.status).toBe(401);
  });
});
