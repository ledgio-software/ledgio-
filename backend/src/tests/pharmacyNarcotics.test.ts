import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import { onboardTenant } from '../services/tenantService';
import { deleteTenantBySlug, ensureTenantTableExists } from '../repository/tenantRepository';
import { deleteUserByEmail, ensureUserTableExists } from '../repository/userRepository';
import { dropTenantSchema } from '../database/tenantSchemaManager';
import { deleteAuditLogs } from './testHelpers';

describe('Pharmacy — Narcotics register, FEFO dispensing, and POS integration', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = `pharm-narc-${runId}`;
  const tenantSchema = `tenant_pharm_narc_${runId}`;
  const adminEmail = `admin_narc_${runId}@rx.com`;

  let adminToken: string;
  let tenantId: string;
  let warehouseId: string;
  let tillId: string;
  let controlledItemId: string;
  let batchTrackedItemId: string;

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

  /** Helper: receive a batch via POST /inventory/batches */
  async function receiveBatch(itemId: string, batchNumber: string, qty: number, daysUntilExpiry: number | null) {
    return post('/inventory/batches', {
      itemId,
      warehouseId,
      batchNumber,
      expiryDate: daysUntilExpiry !== null
        ? new Date(Date.now() + daysUntilExpiry * 86400000).toISOString()
        : undefined,
      quantity: qty,
      costPrice: 5,
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
    await ensureTenantTableExists(prisma);
    await ensureUserTableExists(prisma);
    await cleanupTestData();

    const onboard = await onboardTenant(prisma, {
      companyName: 'NarcPharm Ltd',
      slug: tenantSlug,
      adminEmail,
      adminPassword: 'Password123!',
      adminName: 'NP Admin',
      orgType: 'PHARMACY',
    });
    adminToken = onboard.token;
    tenantId = onboard.tenant.id;

    const wh = await post('/inventory/warehouses', { name: 'Controlled Store' });
    warehouseId = wh.body.data.warehouse.id;

    const controlled = await post('/inventory/items', {
      name: 'Fentanyl 50mcg',
      costPrice: 20,
      sellingPrice: 35,
      initialWarehouseId: warehouseId,
      initialQty: 0,
      regulatoryCategory: 'CONTROLLED',
      requiresBatchTracking: true,
    });
    controlledItemId = controlled.body.data.item.id;

    const batchTracked = await post('/inventory/items', {
      name: 'Codeine 15mg',
      costPrice: 3,
      sellingPrice: 5,
      initialWarehouseId: warehouseId,
      initialQty: 0,
      regulatoryCategory: 'SCHEDULED_A',
      requiresBatchTracking: true,
    });
    batchTrackedItemId = batchTracked.body.data.item.id;

    // Chart of Accounts required for POS journal entries
    await post('/accounts', { code: '1010', name: 'Cash on Hand', type: 'ASSET' });
    await post('/accounts', { code: '4010', name: 'Sales Revenue', type: 'REVENUE' });

    const till = await post('/tills/open', { warehouseId, openingCash: 500 });
    tillId = till.body.data.till.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // ─── Narcotics Register ───────────────────────────────────────────────────────

  it('POST /pharmacy/narcotics creates an entry with correct balanceAfter', async () => {
    // Seed via batch receive first so the item has a controlled log entry
    await receiveBatch(controlledItemId, 'FENT-001', 20, 180);

    // Manual entry: DISPENSED 3 units
    const res = await post('/pharmacy/narcotics', {
      itemId: controlledItemId,
      operationType: 'DISPENSED',
      quantity: 3,
      patientName: 'John Doe',
      prescriptionRef: 'RX-TEST-0001',
      notes: 'Manual dispense entry',
    });

    expect(res.status).toBe(201);
    const entry = res.body.data.entry;
    expect(entry.operationType).toBe('DISPENSED');
    expect(entry.quantity).toBe(3);
    // Balance was 20 after RECEIVED, now 20 - 3 = 17
    expect(entry.balanceAfter).toBe(17);
  });

  it('balance accumulates: RECEIVED increases, DISPENSED decreases, DESTROYED decreases', async () => {
    await post('/pharmacy/narcotics', {
      itemId: controlledItemId,
      operationType: 'RECEIVED',
      quantity: 10,
      supplierRef: 'SUPP-REF-42',
    });

    await post('/pharmacy/narcotics', {
      itemId: controlledItemId,
      operationType: 'DESTROYED',
      quantity: 2,
      notes: 'Damaged vials',
    });

    const narcotics = await get('/pharmacy/narcotics', { itemId: controlledItemId });
    const entries = narcotics.body.data.entries;
    const latest = entries[0]; // newest first
    // 17 (previous) + 10 (RECEIVED) - 2 (DESTROYED) = 25
    expect(latest.balanceAfter).toBe(25);
  });

  it('GET /pharmacy/narcotics lists entries newest first with item details', async () => {
    const res = await get('/pharmacy/narcotics', { itemId: controlledItemId });
    expect(res.status).toBe(200);
    const entries = res.body.data.entries;
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries[0].item.name).toBe('Fentanyl 50mcg');
    // Ordered by entryDate desc
    const dates = entries.map((e: any) => new Date(e.entryDate).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  it('GET /pharmacy/narcotics filters by date range', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const res = await get('/pharmacy/narcotics', {
      itemId: controlledItemId,
      from: new Date(Date.now() - 86400000).toISOString(),
      to: tomorrow,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.entries.length).toBeGreaterThan(0);
  });

  it('GET /pharmacy/narcotics/export.pdf returns a PDF with content-type application/pdf', async () => {
    const res = await get('/pharmacy/narcotics/export.pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/narcotics-register\.pdf/);
    // PDF magic bytes
    expect(res.body.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('POST /pharmacy/narcotics returns 400 for invalid operationType', async () => {
    const res = await post('/pharmacy/narcotics', {
      itemId: controlledItemId,
      operationType: 'SOLD', // invalid
      quantity: 1,
    });
    expect(res.status).toBe(400);
  });

  // ─── FEFO batch deduction via POS ────────────────────────────────────────────

  it('FEFO: POS sale deducts from nearest-expiry batch first', async () => {
    // Two batches: A expires in 5 days (nearest), B in 60 days
    await receiveBatch(batchTrackedItemId, 'CODE-NEAR', 10, 5);
    await receiveBatch(batchTrackedItemId, 'CODE-FAR', 10, 60);

    // Sell 12 units: should exhaust CODE-NEAR (10) and take 2 from CODE-FAR
    const sale = await post('/tills/sales', {
      tillId,
      items: [{ itemId: batchTrackedItemId, quantity: 12 }],
      cashGiven: 100,
    });
    expect(sale.status).toBe(201);

    // Verify batch quantities
    const batches = await get('/inventory/batches', { itemId: batchTrackedItemId });
    const near = batches.body.data.batches.find((b: any) => b.batchNumber === 'CODE-NEAR');
    const far = batches.body.data.batches.find((b: any) => b.batchNumber === 'CODE-FAR');
    expect(near.quantityOnHand).toBe(0);
    expect(far.quantityOnHand).toBe(8);
  });

  // ─── POS + CONTROLLED: warnings and auto narcotics log ───────────────────────

  it('POS sale of CONTROLLED item without rxNumber returns warnings', async () => {
    // Ensure stock exists
    await receiveBatch(controlledItemId, 'FENT-002', 5, 180);

    const sale = await post('/tills/sales', {
      tillId,
      items: [{ itemId: controlledItemId, quantity: 1 }],
      cashGiven: 50,
      customerName: 'Jane Smith',
      // rxNumber intentionally omitted
    });

    expect(sale.status).toBe(201);
    const warnings: string[] = sale.body.data.warnings;
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/CONTROLLED/i);
  });

  it('POS sale of CONTROLLED item auto-creates a narcotics DISPENSED log entry', async () => {
    const narcsBefore = await get('/pharmacy/narcotics', { itemId: controlledItemId });
    const countBefore = narcsBefore.body.data.entries.length;

    await post('/tills/sales', {
      tillId,
      items: [{ itemId: controlledItemId, quantity: 1 }],
      cashGiven: 50,
      customerName: 'Alice Osei',
      rxNumber: 'RX-DOCTOR-9999',
    });

    const narcsAfter = await get('/pharmacy/narcotics', { itemId: controlledItemId });
    const newEntries = narcsAfter.body.data.entries.filter((e: any) => e.operationType === 'DISPENSED');
    expect(newEntries.length).toBeGreaterThan(countBefore - narcsAfter.body.data.entries.filter((e: any) => e.operationType !== 'DISPENSED').length);

    const lastDispensed = narcsAfter.body.data.entries.find(
      (e: any) => e.operationType === 'DISPENSED' && e.prescriptionRef === 'RX-DOCTOR-9999'
    );
    expect(lastDispensed).toBeDefined();
    expect(lastDispensed.quantity).toBe(1);
  });

  it('POS sale of CONTROLLED item with rxNumber has no warnings in response', async () => {
    await receiveBatch(controlledItemId, 'FENT-003', 5, 180);

    const sale = await post('/tills/sales', {
      tillId,
      items: [{ itemId: controlledItemId, quantity: 1 }],
      cashGiven: 50,
      rxNumber: 'RX-VALID-1234',
    });

    expect(sale.status).toBe(201);
    expect(sale.body.data.warnings).toHaveLength(0);
  });

  // ─── Expiry alerts ────────────────────────────────────────────────────────────

  it('GET /pharmacy/expiry-alerts returns batches expiring within the day window', async () => {
    // CODE-NEAR expires in 5 days (but quantityOnHand is 0 after FEFO above — so it won't show)
    // Receive a fresh near-expiry batch of the controlled item
    await receiveBatch(controlledItemId, 'FENT-EXPIRE-SOON', 3, 4);

    const res = await get('/pharmacy/expiry-alerts', { days: 7 });
    expect(res.status).toBe(200);
    const batches = res.body.data.batches;
    const expiringSoon = batches.find((b: any) => b.batchNumber === 'FENT-EXPIRE-SOON');
    expect(expiringSoon).toBeDefined();
    expect(expiringSoon.daysRemaining).toBeLessThanOrEqual(7);
    expect(expiringSoon.quantityOnHand).toBeGreaterThan(0);
  });

  it('GET /pharmacy/expiry-alerts excludes batches with zero quantity', async () => {
    // CODE-NEAR was fully deducted by FEFO — should not appear
    const res = await get('/pharmacy/expiry-alerts', { days: 30 });
    const batchNums = res.body.data.batches.map((b: any) => b.batchNumber);
    expect(batchNums).not.toContain('CODE-NEAR');
  });
});
