import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import { onboardTenant } from '../services/tenantService';
import { deleteTenantBySlug, ensureTenantTableExists } from '../repository/tenantRepository';
import { deleteUserByEmail, ensureUserTableExists } from '../repository/userRepository';
import { dropTenantSchema } from '../database/tenantSchemaManager';
import { deleteAuditLogs } from './testHelpers';

describe('Pharmacy — Prescription register', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = `pharm-rx-${runId}`;
  const tenantSchema = `tenant_pharm_rx_${runId}`;
  const adminEmail = `admin_pharm_rx_${runId}@rx.com`;

  // Non-PHARMACY tenant for gating tests
  const bizSlug = `biz-rx-${runId}`;
  const bizSchema = `tenant_biz_rx_${runId}`;
  const bizEmail = `admin_biz_rx_${runId}@biz.com`;

  let adminToken: string;
  let tenantId: string;
  let bizToken: string;
  let bizTenantId: string;
  let itemId: string;

  async function post(path: string, body: object, token = adminToken, tenant = tenantSlug) {
    return request(app)
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenant)
      .send(body);
  }

  async function get(path: string, query: object = {}, token = adminToken, tenant = tenantSlug) {
    return request(app)
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenant)
      .query(query);
  }

  async function patch(path: string, body: object = {}) {
    return request(app)
      .patch(`/api/v1${path}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send(body);
  }

  async function cleanupTestData() {
    if (tenantId) await deleteAuditLogs(prisma, { tenantId });
    if (bizTenantId) await deleteAuditLogs(prisma, { tenantId: bizTenantId });
    await deleteTenantBySlug(prisma, tenantSlug).catch(() => {});
    await deleteTenantBySlug(prisma, bizSlug).catch(() => {});
    await deleteUserByEmail(prisma, adminEmail).catch(() => {});
    await deleteUserByEmail(prisma, bizEmail).catch(() => {});
    await dropTenantSchema(prisma, tenantSchema).catch(() => {});
    await dropTenantSchema(prisma, bizSchema).catch(() => {});
  }

  beforeAll(async () => {
    await prisma.$connect();
    await ensureTenantTableExists(prisma);
    await ensureUserTableExists(prisma);
    await cleanupTestData();

    const onboard = await onboardTenant(prisma, {
      companyName: 'PharmaCare Ltd',
      slug: tenantSlug,
      adminEmail,
      adminPassword: 'Password123!',
      adminName: 'PC Admin',
      orgType: 'PHARMACY',
    });
    adminToken = onboard.token;
    tenantId = onboard.tenant.id;

    const biz = await onboardTenant(prisma, {
      companyName: 'Biz Corp',
      slug: bizSlug,
      adminEmail: bizEmail,
      adminPassword: 'Password123!',
      adminName: 'Biz Admin',
      orgType: 'BUSINESS',
    });
    bizToken = biz.token;
    bizTenantId = biz.tenant.id;

    const wh = await post('/inventory/warehouses', { name: 'Dispensary' });
    const warehouseId = wh.body.data.warehouse.id;

    const item = await post('/inventory/items', {
      name: 'Amoxicillin 500mg',
      costPrice: 1,
      sellingPrice: 2,
      initialWarehouseId: warehouseId,
      initialQty: 100,
      regulatoryCategory: 'PRESCRIPTION',
    });
    itemId = item.body.data.item.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('returns 403 for a non-PHARMACY tenant', async () => {
    const res = await get('/pharmacy/prescriptions', {}, bizToken, bizSlug);
    expect(res.status).toBe(403);
  });

  it('POST /pharmacy/prescriptions creates a prescription with auto-generated rxNumber', async () => {
    const res = await post('/pharmacy/prescriptions', {
      patientName: 'Kwame Mensah',
      patientAge: 35,
      patientPhone: '+233201234567',
      prescribingDoctor: 'Dr. Ama Owusu',
      prescriptionDate: new Date().toISOString(),
      notes: 'Take with food.',
      lines: [{ itemId, prescribedQty: 2, notes: 'Twice daily' }],
    });

    expect(res.status).toBe(201);
    const rx = res.body.data.prescription;
    expect(rx.rxNumber).toMatch(/^RX-\d+-\d{4}$/);
    expect(rx.patientName).toBe('Kwame Mensah');
    expect(rx.prescribingDoctor).toBe('Dr. Ama Owusu');
    expect(rx.lines).toHaveLength(1);
    expect(rx.lines[0].prescribedQty).toBe(2);
    expect(rx.dispensedAt).toBeNull();
  });

  it('GET /pharmacy/prescriptions lists prescriptions newest first', async () => {
    // Create a second prescription so we have >1
    await post('/pharmacy/prescriptions', {
      patientName: 'Abena Dankwa',
      patientAge: 50,
      prescribingDoctor: 'Dr. Kofi Asante',
      prescriptionDate: new Date().toISOString(),
      lines: [{ itemId, prescribedQty: 3 }],
    });

    const res = await get('/pharmacy/prescriptions');
    expect(res.status).toBe(200);
    const prescriptions = res.body.data.prescriptions;
    expect(prescriptions.length).toBeGreaterThanOrEqual(2);
    // Newest first — createdAt DESC
    const dates = prescriptions.map((p: any) => new Date(p.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  it('GET /pharmacy/prescriptions?q= filters by patient name', async () => {
    const res = await get('/pharmacy/prescriptions', { q: 'Kwame' });
    expect(res.status).toBe(200);
    const names = res.body.data.prescriptions.map((p: any) => p.patientName);
    expect(names.every((n: string) => n.toLowerCase().includes('kwame'))).toBe(true);
  });

  it('GET /pharmacy/prescriptions/:id returns the prescription with lines and item details', async () => {
    const list = await get('/pharmacy/prescriptions', { q: 'Kwame' });
    const rxId = list.body.data.prescriptions[0].id;

    const res = await get(`/pharmacy/prescriptions/${rxId}`);
    expect(res.status).toBe(200);
    const rx = res.body.data.prescription;
    expect(rx.id).toBe(rxId);
    expect(rx.lines[0].item.name).toBe('Amoxicillin 500mg');
  });

  it('returns 404 for an unknown prescription ID', async () => {
    const res = await get('/pharmacy/prescriptions/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('PATCH /pharmacy/prescriptions/:id/dispense marks the prescription dispensed', async () => {
    const list = await get('/pharmacy/prescriptions', { q: 'Kwame' });
    const rxId = list.body.data.prescriptions[0].id;

    const res = await patch(`/pharmacy/prescriptions/${rxId}/dispense`, {
      dispensedByName: 'Nurse Esi',
    });

    expect(res.status).toBe(200);
    const rx = res.body.data.prescription;
    expect(rx.dispensedAt).not.toBeNull();
    expect(rx.dispensedByName).toBe('Nurse Esi');
  });

  it('returns 400 when dispensing an already-dispensed prescription', async () => {
    const list = await get('/pharmacy/prescriptions', { q: 'Kwame' });
    const rxId = list.body.data.prescriptions[0].id;

    const res = await patch(`/pharmacy/prescriptions/${rxId}/dispense`, {
      dispensedByName: 'Nurse Esi',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already dispensed/i);
  });

  it('POST /pharmacy/prescriptions returns 400 for missing required fields', async () => {
    const res = await post('/pharmacy/prescriptions', {
      // patientName missing
      prescribingDoctor: 'Dr. X',
      prescriptionDate: new Date().toISOString(),
      lines: [{ itemId, prescribedQty: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it('POST /pharmacy/prescriptions returns 400 when lines array is empty', async () => {
    const res = await post('/pharmacy/prescriptions', {
      patientName: 'Test Patient',
      prescribingDoctor: 'Dr. Y',
      prescriptionDate: new Date().toISOString(),
      lines: [],
    });
    expect(res.status).toBe(400);
  });
});
