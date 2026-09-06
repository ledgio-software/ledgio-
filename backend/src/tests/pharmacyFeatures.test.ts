/**
 * pharmacyFeatures.test.ts
 *
 * Integration tests for the five pharmacy features shipped in the
 * claude/pending-instructions-4j0i78 branch:
 *
 *  1. GRA E-VAT   — evatInvoiceRef returned on dispense; stub mode (no env vars)
 *  2. NEPP        — POST /pharmacy/verify-nepp validates codes; stub returns patient data
 *  3. Barcode     — dispense after NEPP / E-VAT still works end-to-end (barcode
 *                   check is front-end only; API itself is the integration surface)
 *  4. ABC-FSN     — GET /pharmacy/inventory-matrix returns items with abcClass + fsnClass
 *  5. Bulk batch  — POST /inventory/items/bulk with batchNumber/expiryDate creates
 *                   InventoryBatch records and sets requiresBatchTracking = true
 *
 * External services (GRA VSDC, NEPP API) are mocked per CLAUDE.md:
 * "mocking external services is allowed for unit testing."
 */

import request from 'supertest';
import axios from 'axios';
import app from '../app';
import { prisma } from '../config/db';
import { onboardTenant } from '../services/tenantService';
import { deleteTenantBySlug, ensureTenantTableExists } from '../repository/tenantRepository';
import { deleteUserByEmail, ensureUserTableExists } from '../repository/userRepository';
import { dropTenantSchema } from '../database/tenantSchemaManager';
import { deleteAuditLogs } from './testHelpers';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ── helpers ──────────────────────────────────────────────────────────────────

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tenantSlug = `pharm-feat-${runId}`;
const tenantSchema = `tenant_pharm_feat_${runId}`;
const adminEmail = `admin_pharm_feat_${runId}@rx.test`;

// A non-PHARMACY tenant used to verify org-type gating
const bizSlug = `biz-feat-${runId}`;
const bizSchema = `tenant_biz_feat_${runId}`;
const bizEmail = `admin_biz_feat_${runId}@biz.test`;

let adminToken = '';
let tenantId = '';
let bizToken = '';
let warehouseId = '';
let itemId = '';
let itemId2 = '';
let rxId = '';

function req(method: 'get' | 'post' | 'patch', path: string, token = adminToken, slug = tenantSlug) {
  return (request(app) as any)[method](`/api/v1${path}`)
    .set('Authorization', `Bearer ${token}`)
    .set('X-Tenant-ID', slug);
}

function post(path: string, body: object = {}) { return req('post', path).send(body); }
function get(path: string, query: object = {}) { return req('get', path).query(query); }
function patch(path: string, body: object = {}) { return req('patch', path).send(body); }
function bizGet(path: string) { return req('get', path, bizToken, bizSlug); }

async function cleanup() {
  if (tenantId) await deleteAuditLogs(prisma, { tenantId }).catch(() => {});
  await deleteTenantBySlug(prisma, tenantSlug).catch(() => {});
  await deleteTenantBySlug(prisma, bizSlug).catch(() => {});
  await deleteUserByEmail(prisma, adminEmail).catch(() => {});
  await deleteUserByEmail(prisma, bizEmail).catch(() => {});
  await dropTenantSchema(prisma, tenantSchema).catch(() => {});
  await dropTenantSchema(prisma, bizSchema).catch(() => {});
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.$connect();
  await ensureTenantTableExists(prisma);
  await ensureUserTableExists(prisma);
  await cleanup();

  const pharm = await onboardTenant(prisma, {
    companyName: 'PharmaTest Ltd',
    slug: tenantSlug,
    adminEmail,
    adminPassword: 'Password123!',
    adminName: 'PT Admin',
    orgType: 'PHARMACY',
  });
  adminToken = pharm.token;
  tenantId = pharm.tenant.id;

  const biz = await onboardTenant(prisma, {
    companyName: 'Biz Corp',
    slug: bizSlug,
    adminEmail: bizEmail,
    adminPassword: 'Password123!',
    adminName: 'Biz Admin',
    orgType: 'BUSINESS',
  });
  bizToken = biz.token;

  // Warehouse
  const wh = await post('/inventory/warehouses', { name: 'Dispensary' });
  warehouseId = wh.body.data.warehouse.id;

  // Two items with stock (needed for ABC-FSN and Rx lines)
  const i1 = await post('/inventory/items', {
    name: 'Amoxicillin 500mg',
    costPrice: 5,
    sellingPrice: 8,
    initialWarehouseId: warehouseId,
    initialQty: 200,
    regulatoryCategory: 'PRESCRIPTION',
  });
  itemId = i1.body.data.item.id;

  const i2 = await post('/inventory/items', {
    name: 'Paracetamol 500mg',
    costPrice: 1,
    sellingPrice: 2,
    initialWarehouseId: warehouseId,
    initialQty: 50,
    regulatoryCategory: 'OTC',
  });
  itemId2 = i2.body.data.item.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

// ── 1. GRA E-VAT ─────────────────────────────────────────────────────────────

describe('1 · GRA E-VAT — evatInvoiceRef on dispense', () => {
  let localRxId: string;

  it('creates a prescription', async () => {
    const res = await post('/pharmacy/prescriptions', {
      patientName: 'Kwame Test',
      patientAge: 30,
      patientPhone: '+233201111111',
      prescribingDoctor: 'Dr. Ama',
      prescriptionDate: new Date().toISOString(),
      lines: [{ itemId, prescribedQty: 2 }],
    });
    expect(res.status).toBe(201);
    localRxId = res.body.data.prescription.id;
    rxId = localRxId; // share for later suites
  });

  it('stub mode: dispensing returns an evatInvoiceRef when no GRA env vars are set', async () => {
    // Ensure env vars absent so EvatService falls back to SHA-256 stub
    delete process.env.GRA_EVAT_ENDPOINT;
    delete process.env.GRA_EVAT_CLIENT_ID;

    const res = await patch(`/pharmacy/prescriptions/${localRxId}/dispense`);
    expect(res.status).toBe(200);

    const rx = res.body.data.prescription;
    expect(rx.dispensedAt).not.toBeNull();
    // Stub always produces a ref — either "STUB-..." or a real format
    expect(typeof rx.evatInvoiceRef).toBe('string');
    expect(rx.evatInvoiceRef.length).toBeGreaterThan(0);
  });

  it('real mode: uses GRA API response when env vars present', async () => {
    // Create fresh Rx for this test
    const createRes = await post('/pharmacy/prescriptions', {
      patientName: 'Ama Real',
      patientAge: 25,
      prescribingDoctor: 'Dr. Kofi',
      prescriptionDate: new Date().toISOString(),
      lines: [{ itemId, prescribedQty: 1 }],
    });
    const realRxId = createRes.body.data.prescription.id;

    process.env.GRA_EVAT_ENDPOINT = 'https://evat.example.com/vsdc';
    process.env.GRA_EVAT_CLIENT_ID = 'TEST_CLIENT';
    process.env.GRA_EVAT_SECURITY_KEY = 'TEST_KEY';

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        response: {
          status: 'SUCCESS',
          distributor_tin: 'C0034186913',
          mesaage: {
            num: 'NS230724-9000001',
            ysdcid: 'EV-260623-001',
            ysdcrecnum: '83NS',
            ysdcintdata: 'NUGABIDWABF5MRRN2EXDUSJ7M4',
            ysdcregsig: 'E4OFBGZX2MT6YBTQ',
            ysdcmrc: '2b60f37f175c7c',
            ysdcmrctim: '2023/07/24 09:09:36',
            ysdctime: '2023/07/24 09:09:36',
            flag: 'INVOICE',
            ysdcitems: '1',
          },
          qr_code: 'https://verification.vat-gh.com?data=abc123&v=1.0',
        },
      },
    });

    const res = await patch(`/pharmacy/prescriptions/${realRxId}/dispense`);
    expect(res.status).toBe(200);
    const rx = res.body.data.prescription;
    expect(rx.evatInvoiceRef).toBeTruthy();

    // Cleanup env
    delete process.env.GRA_EVAT_ENDPOINT;
    delete process.env.GRA_EVAT_CLIENT_ID;
    delete process.env.GRA_EVAT_SECURITY_KEY;
  });

  it('non-PHARMACY tenant cannot dispense via pharmacy route', async () => {
    const res = await (request(app) as any)
      .patch(`/api/v1/pharmacy/prescriptions/${localRxId}/dispense`)
      .set('Authorization', `Bearer ${bizToken}`)
      .set('X-Tenant-ID', bizSlug)
      .send({});
    expect(res.status).toBe(403);
  });
});

// ── 2. NEPP verification ──────────────────────────────────────────────────────

describe('2 · NEPP — POST /pharmacy/verify-nepp', () => {
  it('stub mode: returns patient data for any non-empty code', async () => {
    delete process.env.NEPP_API_ENDPOINT;
    delete process.env.NEPP_API_KEY;

    const res = await post('/pharmacy/verify-nepp', { neppCode: 'NEPP-2025-ABC123' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      valid: true,
      patientName: expect.any(String),
      patientPhone: expect.any(String),
    });
  });

  it('stub mode: rejects empty / missing code', async () => {
    const res = await post('/pharmacy/verify-nepp', { neppCode: '' });
    expect(res.status).toBe(400);
  });

  it('real mode: forwards code to NEPP API and returns validated data', async () => {
    process.env.NEPP_API_ENDPOINT = 'https://nepp.example.gov.gh/validate';
    process.env.NEPP_API_KEY = 'NEPP_TEST_KEY';

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        valid: true,
        patientName: 'Yaa Asantewaa',
        patientPhone: '+233244000000',
        prescribingFacility: 'Komfo Anokye Teaching Hospital',
      },
    });

    const res = await post('/pharmacy/verify-nepp', { neppCode: 'NEPP-2025-REAL' });
    expect(res.status).toBe(200);
    expect(res.body.data.patientName).toBe('Yaa Asantewaa');
    expect(res.body.data.valid).toBe(true);

    delete process.env.NEPP_API_ENDPOINT;
    delete process.env.NEPP_API_KEY;
  });

  it('real mode: surfaces NEPP API rejection as invalid', async () => {
    process.env.NEPP_API_ENDPOINT = 'https://nepp.example.gov.gh/validate';
    process.env.NEPP_API_KEY = 'NEPP_TEST_KEY';

    mockedAxios.post.mockResolvedValueOnce({
      data: { valid: false, reason: 'Code expired' },
    });

    const res = await post('/pharmacy/verify-nepp', { neppCode: 'NEPP-2020-EXPIRED' });
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);

    delete process.env.NEPP_API_ENDPOINT;
    delete process.env.NEPP_API_KEY;
  });

  it('non-PHARMACY tenant gets 403', async () => {
    const res = await (request(app) as any)
      .post('/api/v1/pharmacy/verify-nepp')
      .set('Authorization', `Bearer ${bizToken}`)
      .set('X-Tenant-ID', bizSlug)
      .send({ neppCode: 'NEPP-2025-XYZ' });
    expect(res.status).toBe(403);
  });
});

// ── 3. Barcode enforcement (API surface) ─────────────────────────────────────

describe('3 · Barcode enforcement — dispense is the hard gate', () => {
  it('prescription with neppCode stored is dispensed correctly', async () => {
    const createRes = await post('/pharmacy/prescriptions', {
      patientName: 'Barcode Patient',
      patientAge: 40,
      prescribingDoctor: 'Dr. Scan',
      prescriptionDate: new Date().toISOString(),
      neppCode: 'NEPP-2025-BCODE',
      lines: [{ itemId, prescribedQty: 1 }, { itemId: itemId2, prescribedQty: 2 }],
    });
    expect(createRes.status).toBe(201);
    const barcodeRxId = createRes.body.data.prescription.id;
    expect(createRes.body.data.prescription.neppCode).toBe('NEPP-2025-BCODE');

    delete process.env.GRA_EVAT_ENDPOINT;
    const dispenseRes = await patch(`/pharmacy/prescriptions/${barcodeRxId}/dispense`);
    expect(dispenseRes.status).toBe(200);
    expect(dispenseRes.body.data.prescription.dispensedAt).not.toBeNull();
    // evatReceipt should always be present (stub or real)
    expect(dispenseRes.body.data.evatReceipt).toBeDefined();
  });

  it('dispensing an already-dispensed Rx returns 409', async () => {
    // rxId was dispensed in suite 1
    const res = await patch(`/pharmacy/prescriptions/${rxId}/dispense`);
    expect(res.status).toBe(409);
  });
});

// ── 4. ABC-FSN inventory matrix ───────────────────────────────────────────────

describe('4 · ABC-FSN — GET /pharmacy/inventory-matrix', () => {
  it('returns items with abcClass and fsnClass fields', async () => {
    const res = await get('/pharmacy/inventory-matrix');
    expect(res.status).toBe(200);
    const items = res.body.data.items;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);

    for (const item of items) {
      expect(['A', 'B', 'C']).toContain(item.abcClass);
      expect(['F', 'S', 'N']).toContain(item.fsnClass);
      expect(typeof item.totalValue).toBe('number');
      expect(typeof item.totalQty).toBe('number');
    }
  });

  it('ABC classes are mutually exclusive and cover all items', async () => {
    const res = await get('/pharmacy/inventory-matrix');
    const items = res.body.data.items;
    const counts = { A: 0, B: 0, C: 0 };
    for (const item of items) counts[item.abcClass as 'A' | 'B' | 'C']++;
    expect(counts.A + counts.B + counts.C).toBe(items.length);
  });

  it('FSN classes are mutually exclusive and cover all items', async () => {
    const res = await get('/pharmacy/inventory-matrix');
    const items = res.body.data.items;
    const counts = { F: 0, S: 0, N: 0 };
    for (const item of items) counts[item.fsnClass as 'F' | 'S' | 'N']++;
    expect(counts.F + counts.S + counts.N).toBe(items.length);
  });

  it('non-PHARMACY tenant gets 403', async () => {
    const res = await bizGet('/pharmacy/inventory-matrix');
    expect(res.status).toBe(403);
  });
});

// ── 5. Bulk Quick-Add with batch/expiry ──────────────────────────────────────

describe('5 · Bulk Quick-Add — batchNumber + expiryDate via POST /inventory/items/bulk', () => {
  it('creates items with InventoryBatch records when batchNumber is supplied', async () => {
    const expiryDate = '2027-12-31';
    const res = await post('/inventory/items/bulk', {
      items: [
        {
          name: `Metronidazole 400mg ${runId}`,
          costPrice: 2,
          sellingPrice: 3.5,
          initialWarehouseId: warehouseId,
          initialQty: 100,
          batchNumber: 'BN-TEST-001',
          expiryDate,
        },
        {
          name: `Doxycycline 100mg ${runId}`,
          costPrice: 1.5,
          sellingPrice: 2.5,
          initialWarehouseId: warehouseId,
          initialQty: 60,
          // No batch number — should NOT set requiresBatchTracking
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.created.length).toBe(2);
    expect(res.body.data.failed.length).toBe(0);

    const metronidazoleId = res.body.data.created.find(
      (it: any) => it.name.startsWith('Metronidazole'),
    )?.id;
    expect(metronidazoleId).toBeTruthy();

    // Verify InventoryBatch record was created
    const batches = await (prisma as any).inventoryBatch.findMany({
      where: { itemId: metronidazoleId, batchNumber: 'BN-TEST-001' },
    });
    expect(batches.length).toBe(1);
    expect(new Date(batches[0].expiryDate).toISOString().startsWith('2027-12-31')).toBe(true);
    expect(batches[0].quantity).toBe(100);

    // Verify requiresBatchTracking was set
    const item = await (prisma as any).inventoryItem.findUnique({ where: { id: metronidazoleId } });
    expect(item.requiresBatchTracking).toBe(true);
  });

  it('item without batchNumber does NOT get requiresBatchTracking = true', async () => {
    const res = await post('/inventory/items/bulk', {
      items: [
        {
          name: `OTC NoBatch ${runId}`,
          costPrice: 1,
          sellingPrice: 2,
          initialWarehouseId: warehouseId,
          initialQty: 20,
        },
      ],
    });
    expect(res.status).toBe(201);
    const createdId = res.body.data.created[0]?.id;
    expect(createdId).toBeTruthy();

    const item = await (prisma as any).inventoryItem.findUnique({ where: { id: createdId } });
    expect(item.requiresBatchTracking).toBe(false);
  });

  it('accepts rows without expiryDate — batch record still created', async () => {
    const res = await post('/inventory/items/bulk', {
      items: [
        {
          name: `Ibuprofen 200mg ${runId}`,
          costPrice: 0.8,
          sellingPrice: 1.5,
          initialWarehouseId: warehouseId,
          initialQty: 300,
          batchNumber: 'BN-NO-EXPIRY',
        },
      ],
    });
    expect(res.status).toBe(201);
    const createdId = res.body.data.created[0]?.id;
    const batches = await (prisma as any).inventoryBatch.findMany({
      where: { itemId: createdId, batchNumber: 'BN-NO-EXPIRY' },
    });
    expect(batches.length).toBe(1);
    expect(batches[0].expiryDate).toBeNull();
  });

  it('partial batch: failed rows do not block successful ones', async () => {
    const res = await post('/inventory/items/bulk', {
      items: [
        {
          name: `Good Drug ${runId}`,
          costPrice: 3,
          sellingPrice: 5,
          initialWarehouseId: warehouseId,
          initialQty: 10,
          batchNumber: 'BN-GOOD',
        },
        {
          // Missing costPrice — should fail validation
          name: `Bad Drug ${runId}`,
          sellingPrice: 5,
        },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.created.length).toBe(1);
    expect(res.body.data.failed.length).toBe(1);
    expect(res.body.data.failed[0].error).toMatch(/cost price/i);
  });
});
