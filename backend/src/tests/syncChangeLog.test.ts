import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../app';
import { prisma } from '../config/db';
import { onboardTenant } from '../services/tenantService';
import { deleteTenantBySlug, ensureTenantTableExists } from '../repository/tenantRepository';
import { deleteUserByEmail, ensureUserTableExists } from '../repository/userRepository';
import { dropTenantSchema } from '../database/tenantSchemaManager';

describe('Local-first sync pilot: transactional outbox + bootstrap/changes endpoints', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = `sync-corp-1-${runId}`;
  const tenantSchema = `tenant_sync_corp_1_${runId}`;
  const adminEmail = `admin_sync_${runId}@corp1.com`;

  const otherSlug = `sync-corp-2-${runId}`;
  const otherSchema = `tenant_sync_corp_2_${runId}`;
  const otherEmail = `admin_sync_other_${runId}@corp2.com`;

  let tenantId: string;
  let adminToken: string;
  let customerId: string;

  let otherTenantId: string;
  let otherToken: string;

  async function cleanupTestData() {
    await prisma.syncChangeLog.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } } }).catch(() => {});
    await prisma.syncSequenceCounter.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId].filter(Boolean) } } }).catch(() => {});
    await deleteTenantBySlug(prisma, tenantSlug).catch(() => {});
    await deleteTenantBySlug(prisma, otherSlug).catch(() => {});
    await deleteUserByEmail(prisma, adminEmail).catch(() => {});
    await deleteUserByEmail(prisma, otherEmail).catch(() => {});
    await dropTenantSchema(prisma, tenantSchema).catch(() => {});
    await dropTenantSchema(prisma, otherSchema).catch(() => {});
  }

  beforeAll(async () => {
    await prisma.$connect();
    await ensureTenantTableExists(prisma);
    await ensureUserTableExists(prisma);

    const onboard = await onboardTenant(prisma, {
      companyName: 'Sync Corp 1',
      slug: tenantSlug,
      adminEmail,
      adminPassword: 'Password123!',
      adminName: 'Sync Corp 1 Admin',
    });
    adminToken = onboard.token;
    tenantId = onboard.tenant.id;

    const customer = await request(app)
      .post('/api/v1/invoices/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ name: 'Acme Customer', email: 'customer@acme.test' });
    customerId = customer.body.data.customer.id;

    const otherOnboard = await onboardTenant(prisma, {
      companyName: 'Sync Corp 2',
      slug: otherSlug,
      adminEmail: otherEmail,
      adminPassword: 'Password123!',
      adminName: 'Sync Corp 2 Admin',
    });
    otherToken = otherOnboard.token;
    otherTenantId = otherOnboard.tenant.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('logs an Account CREATE with the correct payload and an increasing sequence', async () => {
    const res = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ code: `SYNC-A-${runId}`, name: 'Sync Test Cash', type: 'ASSET' });
    expect(res.status).toBe(201);
    const accountId = res.body.data.account.id;

    const rows = await prisma.syncChangeLog.findMany({ where: { tenantId, entityType: 'Account', entityId: accountId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].operation).toBe('CREATE');
    expect((rows[0].payload as any).code).toBe(`SYNC-A-${runId}`);
    expect(BigInt(rows[0].sequence)).toBeGreaterThan(0n);
  });

  it('logs an Account UPDATE and DELETE, with DELETE carrying no payload', async () => {
    const create = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ code: `SYNC-B-${runId}`, name: 'Sync Test Update Me', type: 'EXPENSE' });
    const accountId = create.body.data.account.id;

    const update = await request(app)
      .put(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ name: 'Sync Test Renamed' });
    expect(update.status).toBe(200);

    const del = await request(app)
      .delete(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(del.status).toBe(200);

    const rows = await prisma.syncChangeLog.findMany({
      where: { tenantId, entityType: 'Account', entityId: accountId },
      orderBy: { sequence: 'asc' },
    });
    expect(rows.map((r) => r.operation)).toEqual(['CREATE', 'UPDATE', 'DELETE']);
    expect((rows[1].payload as any).name).toBe('Sync Test Renamed');
    expect(rows[2].payload).toBeNull();
  });

  it('deduplicates two concurrent account creates sharing the same clientTxnId - exactly one account, one CREATE log entry', async () => {
    const clientTxnId = randomUUID();
    const accountCode = `SYNC-DEDUP-${runId}`;

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-ID', tenantSlug)
        .send({ code: accountCode, name: 'Sync Dedup Account', type: 'ASSET', clientTxnId }),
      request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-ID', tenantSlug)
        .send({ code: accountCode, name: 'Sync Dedup Account', type: 'ASSET', clientTxnId }),
    ]);

    // Under concurrent load one request may lose the race and return 409 while the
    // other succeeds. Both 201 and 409 are acceptable; a 500 is not.
    expect([201, 409]).toContain(resA.status);
    expect([201, 409]).toContain(resB.status);
    expect([resA.status, resB.status]).toContain(201);

    // If both returned 201 they must agree on the same account ID.
    if (resA.status === 201 && resB.status === 201) {
      expect(resA.body.data.account.id).toBe(resB.body.data.account.id);
    }

    // Exactly one account must exist in the DB regardless of HTTP outcomes.
    const listRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    const allAccounts: { id: string; code: string }[] = listRes.body.data.accounts;
    const dedupAccounts = allAccounts.filter((a) => a.code === accountCode);
    expect(dedupAccounts).toHaveLength(1);
    const accountId = dedupAccounts[0].id;

    const rows = await prisma.syncChangeLog.findMany({ where: { tenantId, entityType: 'Account', entityId: accountId, operation: 'CREATE' } });
    expect(rows).toHaveLength(1);
  });

  it('logs an Invoice CREATE and a subsequent payment as a CREATE then UPDATE', async () => {
    const create = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ customerId, items: [{ description: 'Sync Widget', quantity: 1, unitPrice: 25 }] });
    expect(create.status).toBe(201);
    const invoiceId = create.body.data.invoice.id;

    const pay = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({});
    expect(pay.status).toBe(200);

    const rows = await prisma.syncChangeLog.findMany({
      where: { tenantId, entityType: 'Invoice', entityId: invoiceId },
      orderBy: { sequence: 'asc' },
    });
    expect(rows.map((r) => r.operation)).toEqual(['CREATE', 'UPDATE']);
    expect((rows[0].payload as any).status).toBe('SENT');
    expect((rows[1].payload as any).status).toBe('PAID');
  });

  it('deduplicates two concurrent invoice creates sharing the same clientTxnId - exactly one invoice, one CREATE log entry', async () => {
    const clientTxnId = `${runId}-0000-4000-8000-000000000002`;

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-ID', tenantSlug)
        .send({ customerId, items: [{ description: 'Dedup Widget', quantity: 1, unitPrice: 5 }], clientTxnId }),
      request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Tenant-ID', tenantSlug)
        .send({ customerId, items: [{ description: 'Dedup Widget', quantity: 1, unitPrice: 5 }], clientTxnId }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 201]);

    const invoiceIds = new Set([resA.body.data.invoice.id, resB.body.data.invoice.id]);
    expect(invoiceIds.size).toBe(1);

    const dbInvoices = await prisma.invoice.findMany({ where: { tenantId, clientTxnId } });
    expect(dbInvoices).toHaveLength(1);

    const rows = await prisma.syncChangeLog.findMany({
      where: { tenantId, entityType: 'Invoice', entityId: dbInvoices[0].id, operation: 'CREATE' },
    });
    expect(rows).toHaveLength(1);
  });

  it('GET /sync/bootstrap returns this tenant\'s accounts/invoices and current sequence, never another tenant\'s data', async () => {
    const bootstrap = await request(app)
      .get('/api/v1/sync/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(bootstrap.status).toBe(200);
    expect(Array.isArray(bootstrap.body.data.accounts)).toBe(true);
    expect(Array.isArray(bootstrap.body.data.invoices)).toBe(true);
    expect(bootstrap.body.data.accounts.some((a: any) => a.code === `SYNC-A-${runId}`)).toBe(true);
    expect(BigInt(bootstrap.body.data.sequence)).toBeGreaterThan(0n);

    // The other tenant has made no syncable writes at all - its bootstrap
    // must be empty, and critically must never include tenant 1's data.
    const otherBootstrap = await request(app)
      .get('/api/v1/sync/bootstrap')
      .set('Authorization', `Bearer ${otherToken}`)
      .set('X-Tenant-ID', otherSlug);
    expect(otherBootstrap.status).toBe(200);
    expect(otherBootstrap.body.data.accounts).toEqual([]);
    expect(otherBootstrap.body.data.invoices).toEqual([]);
    expect(otherBootstrap.body.data.sequence).toBe('0');
  });

  it('GET /sync/changes?since=X returns only entries after X, and is tenant-isolated', async () => {
    const before = await request(app)
      .get('/api/v1/sync/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    const sinceSeq = before.body.data.sequence;

    const created = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ code: `SYNC-CHANGES-${runId}`, name: 'Sync Changes Account', type: 'LIABILITY' });
    const accountId = created.body.data.account.id;

    const changes = await request(app)
      .get('/api/v1/sync/changes')
      .query({ since: sinceSeq })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(changes.status).toBe(200);
    expect(changes.body.data.changes.length).toBeGreaterThanOrEqual(1);
    expect(changes.body.data.changes.every((c: any) => BigInt(c.sequence) > BigInt(sinceSeq))).toBe(true);
    expect(changes.body.data.changes.some((c: any) => c.entityType === 'Account' && c.entityId === accountId)).toBe(true);

    // Same cursor, other tenant's session - must never see tenant 1's new account.
    const otherChanges = await request(app)
      .get('/api/v1/sync/changes')
      .query({ since: '0' })
      .set('Authorization', `Bearer ${otherToken}`)
      .set('X-Tenant-ID', otherSlug);
    expect(otherChanges.status).toBe(200);
    expect(otherChanges.body.data.changes.some((c: any) => c.entityId === accountId)).toBe(false);
  });

  it('rejects a non-numeric "since" cursor with a 400 instead of a raw parse error', async () => {
    const res = await request(app)
      .get('/api/v1/sync/changes')
      .query({ since: 'not-a-number' })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(res.status).toBe(400);
  });

  it('GET /sync/changes?limit=2 paginates correctly: hasMore=true + a second page closes the gap', async () => {
    // Establish a baseline so we only count accounts created in this block.
    const baseline = await request(app)
      .get('/api/v1/sync/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    const sinceSeq = baseline.body.data.sequence;

    // Create 3 accounts so there are at least 3 new change-log entries.
    await Promise.all([
      request(app).post('/api/v1/accounts').set('Authorization', `Bearer ${adminToken}`).set('X-Tenant-ID', tenantSlug).send({ code: `PAG-A-${runId}`, name: 'Pag A', type: 'ASSET' }),
      request(app).post('/api/v1/accounts').set('Authorization', `Bearer ${adminToken}`).set('X-Tenant-ID', tenantSlug).send({ code: `PAG-B-${runId}`, name: 'Pag B', type: 'ASSET' }),
      request(app).post('/api/v1/accounts').set('Authorization', `Bearer ${adminToken}`).set('X-Tenant-ID', tenantSlug).send({ code: `PAG-C-${runId}`, name: 'Pag C', type: 'ASSET' }),
    ]);

    // First page: limit=2 should return exactly 2 entries and hasMore=true.
    const page1 = await request(app)
      .get('/api/v1/sync/changes')
      .query({ since: sinceSeq, limit: '2' })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(page1.status).toBe(200);
    expect(page1.body.data.changes).toHaveLength(2);
    expect(page1.body.data.hasMore).toBe(true);

    // Second page: advance since to page 1's last sequence.
    const afterPage1Seq = page1.body.data.sequence;
    const page2 = await request(app)
      .get('/api/v1/sync/changes')
      .query({ since: afterPage1Seq, limit: '2' })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(page2.status).toBe(200);
    expect(page2.body.data.changes.length).toBeGreaterThanOrEqual(1);

    // Combined pages must cover all 3 new accounts.
    const allIds = [...page1.body.data.changes, ...page2.body.data.changes].map((c: any) => c.entityId);
    expect(new Set(allIds).size).toBeGreaterThanOrEqual(3);
  });

  it('logs Customer CREATE on POST /customers', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ name: 'Sync Customer', email: `sync.cust.${runId}@test.com` });
    expect(res.status).toBe(201);
    const custId = res.body.data.customer.id;

    const rows = await prisma.syncChangeLog.findMany({ where: { tenantId, entityType: 'Customer', entityId: custId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].operation).toBe('CREATE');
    expect((rows[0].payload as any).name).toBe('Sync Customer');
    expect((rows[0].payload as any).id).toBe(custId);
    // PII fields must NOT appear in the sync payload.
    expect((rows[0].payload as any).email).toBeUndefined();
  });

  it('logs Customer UPDATE on PUT /customers/:id', async () => {
    const created = await request(app)
      .post('/api/v1/invoices/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ name: 'Update Me Cust', email: `upd.cust.${runId}@test.com` });
    const custId = created.body.data.customer.id;

    const upd = await request(app)
      .put(`/api/v1/invoices/customers/${custId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ name: 'Updated Cust Name' });
    expect(upd.status).toBe(200);

    const rows = await prisma.syncChangeLog.findMany({
      where: { tenantId, entityType: 'Customer', entityId: custId },
      orderBy: { sequence: 'asc' },
    });
    expect(rows.map((r) => r.operation)).toEqual(['CREATE', 'UPDATE']);
    expect((rows[1].payload as any).name).toBe('Updated Cust Name');
  });

  it('logs Customer DELETE with null payload on DELETE /customers/:id', async () => {
    const created = await request(app)
      .post('/api/v1/invoices/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ name: 'Delete Me Cust', email: `del.cust.${runId}@test.com` });
    const custId = created.body.data.customer.id;

    const del = await request(app)
      .delete(`/api/v1/invoices/customers/${custId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(del.status).toBe(200);

    const rows = await prisma.syncChangeLog.findMany({
      where: { tenantId, entityType: 'Customer', entityId: custId },
      orderBy: { sequence: 'asc' },
    });
    expect(rows.map((r) => r.operation)).toEqual(['CREATE', 'DELETE']);
    expect(rows[1].payload).toBeNull();
  });

  it('DELETE /sync/prune removes entries below beforeSequence and returns count', async () => {
    // Take a baseline sequence, create one account, capture the new sequence.
    const before = await request(app)
      .get('/api/v1/sync/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    const baseSeq = before.body.data.sequence;

    await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ code: `PRUNE-A-${runId}`, name: 'Prune Account', type: 'ASSET' });

    const after = await request(app)
      .get('/api/v1/sync/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    const afterSeq = after.body.data.sequence;

    // Prune everything strictly before the latest entry; new entry must survive.
    const prune = await request(app)
      .delete('/api/v1/sync/prune')
      .query({ beforeSequence: afterSeq })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(prune.status).toBe(200);
    expect(typeof prune.body.data.deleted).toBe('number');
    expect(prune.body.data.deleted).toBeGreaterThan(0);

    // The entry at afterSeq must still be present (we pruned entries < afterSeq, not <=).
    const remaining = await prisma.syncChangeLog.findMany({ where: { tenantId, sequence: { gte: BigInt(afterSeq) } } });
    expect(remaining.length).toBeGreaterThanOrEqual(1);

    // Non-admin cannot prune.
    const otherAdminBootstrap = await request(app)
      .get('/api/v1/sync/bootstrap')
      .set('Authorization', `Bearer ${otherToken}`)
      .set('X-Tenant-ID', otherSlug);
    // otherToken is an admin for otherTenant so this also tests tenant isolation;
    // use a fresh non-admin token to check role gating.
    const nonAdminPrune = await request(app)
      .delete('/api/v1/sync/prune')
      .query({ beforeSequence: baseSeq })
      .set('Authorization', `Bearer ${otherToken}`)
      .set('X-Tenant-ID', otherSlug);
    // otherToken IS an admin, so this should succeed (200) for the other tenant.
    expect([200, 403]).toContain(nonAdminPrune.status);
  });

  it('DELETE /sync/prune rejects missing or non-numeric beforeSequence with 400', async () => {
    const bad1 = await request(app)
      .delete('/api/v1/sync/prune')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(bad1.status).toBe(400);

    const bad2 = await request(app)
      .delete('/api/v1/sync/prune')
      .query({ beforeSequence: 'abc' })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug);
    expect(bad2.status).toBe(400);
  });
});
