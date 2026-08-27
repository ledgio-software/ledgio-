import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import { onboardTenant } from '../services/tenantService';
import { deleteTenantBySlug, ensureTenantTableExists } from '../repository/tenantRepository';
import { deleteUserByEmail, ensureUserTableExists } from '../repository/userRepository';
import { dropTenantSchema } from '../database/tenantSchemaManager';
import { deleteAuditLogs } from './testHelpers';

describe('Pharmacy — Batch tracking (POST/GET /inventory/batches)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = `pharm-bat-${runId}`;
  const tenantSchema = `tenant_pharm_bat_${runId}`;
  const adminEmail = `admin_pharm_bat_${runId}@rx.com`;

  let adminToken: string;
  let tenantId: string;
  let warehouseId: string;
  let regularItemId: string;
  let controlledItemId: string;

  const auth = () => ({
    auth: adminToken,
    tenant: tenantSlug,
  });

  async function post(path: string, body: object) {
    return request(app)
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send(body);
  }

  async function get(path: string, query: object = {}) {
    return request(app)
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .query(query);
  }

  async function cleanupTestData() {
    if (tenantId) await deleteAuditLogs(prisma, { tenantId });
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
      companyName: 'PharmaBatch Corp',
      slug: tenantSlug,
      adminEmail,
      adminPassword: 'Password123!',
      adminName: 'PB Admin',
      orgType: 'PHARMACY',
    });
    adminToken = onboard.token;
    tenantId = onboard.tenant.id;

    const wh = await post('/inventory/warehouses', { name: 'Main Dispensary' });
    warehouseId = wh.body.data.warehouse.id;

    const regular = await post('/inventory/items', {
      name: 'Paracetamol 500mg',
      costPrice: 0.5,
      sellingPrice: 1.0,
      initialWarehouseId: warehouseId,
      initialQty: 0,
      regulatoryCategory: 'PRESCRIPTION',
      requiresBatchTracking: true,
    });
    regularItemId = regular.body.data.item.id;

    const controlled = await post('/inventory/items', {
      name: 'Morphine 10mg',
      costPrice: 5,
      sellingPrice: 10,
      initialWarehouseId: warehouseId,
      initialQty: 0,
      regulatoryCategory: 'CONTROLLED',
      requiresBatchTracking: true,
    });
    controlledItemId = controlled.body.data.item.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('creates a batch and increments warehouseStock', async () => {
    const res = await post('/inventory/batches', {
      itemId: regularItemId,
      warehouseId,
      batchNumber: 'PCM-2025-001',
      expiryDate: new Date(Date.now() + 90 * 86400000).toISOString(),
      quantity: 200,
      costPrice: 0.5,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.batch.batchNumber).toBe('PCM-2025-001');
    expect(res.body.data.batch.quantityOnHand).toBe(200);

    // warehouseStock total must reflect the batch
    const warehouses = await get('/inventory/warehouses');
    const wh = warehouses.body.data.warehouses.find((w: any) => w.id === warehouseId);
    const stock = wh.stocks.find((s: any) => s.itemId === regularItemId);
    expect(stock.quantityOnHand).toBe(200);
  });

  it('upserts an existing batch number instead of duplicating', async () => {
    // Receive 50 more units of the same batch
    const res = await post('/inventory/batches', {
      itemId: regularItemId,
      warehouseId,
      batchNumber: 'PCM-2025-001',
      quantity: 50,
      costPrice: 0.5,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.batch.quantityOnHand).toBe(250);
  });

  it('GET /inventory/batches?itemId= lists batches for that item', async () => {
    const res = await get('/inventory/batches', { itemId: regularItemId });
    expect(res.status).toBe(200);
    expect(res.body.data.batches.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.batches[0].batchNumber).toBe('PCM-2025-001');
  });

  it('GET /inventory/batches?expiringSoon=7 omits batches expiring after 7 days', async () => {
    // PCM-2025-001 expires in ~90 days — should not appear in a 7-day window
    const res = await get('/inventory/batches', { itemId: regularItemId, expiringSoon: 7 });
    expect(res.status).toBe(200);
    const batchNums = res.body.data.batches.map((b: any) => b.batchNumber);
    expect(batchNums).not.toContain('PCM-2025-001');
  });

  it('GET /inventory/batches?expiringSoon=180 includes batches expiring within 180 days', async () => {
    const res = await get('/inventory/batches', { itemId: regularItemId, expiringSoon: 180 });
    expect(res.status).toBe(200);
    const batchNums = res.body.data.batches.map((b: any) => b.batchNumber);
    expect(batchNums).toContain('PCM-2025-001');
  });

  it('auto-creates a narcotics RECEIVED log entry when receiving a CONTROLLED batch', async () => {
    const res = await post('/inventory/batches', {
      itemId: controlledItemId,
      warehouseId,
      batchNumber: 'MORPH-2025-A',
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      quantity: 10,
      costPrice: 5,
    });

    expect(res.status).toBe(201);

    // Narcotics log must have a RECEIVED entry for this item
    const narcotics = await get('/pharmacy/narcotics', { itemId: controlledItemId });
    expect(narcotics.status).toBe(200);
    const received = narcotics.body.data.entries.find(
      (e: any) => e.operationType === 'RECEIVED' && e.itemId === controlledItemId
    );
    expect(received).toBeDefined();
    expect(received.quantity).toBe(10);
    expect(received.balanceAfter).toBe(10);
  });

  it('narcotics balance accumulates across multiple RECEIVED entries', async () => {
    await post('/inventory/batches', {
      itemId: controlledItemId,
      warehouseId,
      batchNumber: 'MORPH-2025-B',
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      quantity: 5,
      costPrice: 5,
    });

    const narcotics = await get('/pharmacy/narcotics', { itemId: controlledItemId });
    const entries = narcotics.body.data.entries.filter((e: any) => e.itemId === controlledItemId);
    const latest = entries[0]; // ordered by entryDate desc
    expect(latest.balanceAfter).toBe(15);
  });

  it('returns 400 when required batch fields are missing', async () => {
    const res = await post('/inventory/batches', {
      itemId: regularItemId,
      warehouseId,
      // batchNumber omitted
      quantity: 10,
      costPrice: 0.5,
    });
    expect(res.status).toBe(400);
  });
});
