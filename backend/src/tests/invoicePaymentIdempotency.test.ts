import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import { onboardTenant } from '../services/tenantService';
import { deleteTenantBySlug, ensureTenantTableExists } from '../repository/tenantRepository';
import { deleteUserByEmail, ensureUserTableExists } from '../repository/userRepository';
import { dropTenantSchema } from '../database/tenantSchemaManager';
import { deleteAuditLogs } from './testHelpers';

describe('Invoice payment idempotency (offline-sync retry safety)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = `inv-pay-idem-${runId}`;
  const tenantSchema = `tenant_inv_pay_idem_${runId}`;
  const adminEmail = `admin_invpayidem_${runId}@corp.com`;

  let tenantId: string;
  let adminToken: string;
  let customerId: string;

  async function cleanupTestData() {
    await deleteAuditLogs(prisma, { tenantId }).catch(() => {});
    await deleteTenantBySlug(prisma, tenantSlug).catch(() => {});
    await deleteUserByEmail(prisma, adminEmail).catch(() => {});
    await dropTenantSchema(prisma, tenantSchema).catch(() => {});
  }

  async function createInvoice(amount: number = 100) {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ customerId, items: [{ description: 'Service fee', quantity: 1, unitPrice: amount }] });
    expect(res.status).toBe(201);
    return res.body.data.invoice;
  }

  async function payInvoice(id: string, opts: { amount?: number; idempotencyKey?: string } = {}) {
    return request(app)
      .post(`/api/v1/invoices/${id}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send(opts);
  }

  beforeAll(async () => {
    await prisma.$connect();
    await ensureTenantTableExists(prisma);
    await ensureUserTableExists(prisma);

    const onboard = await onboardTenant(prisma, {
      companyName: 'Invoice Pay Idempotency Corp',
      slug: tenantSlug,
      adminEmail,
      adminPassword: 'Password123!',
      adminName: 'Idem Admin',
    });
    adminToken = onboard.token;
    tenantId = onboard.tenant.id;

    const customer = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-ID', tenantSlug)
      .send({ name: 'Idem Customer', email: 'idem@customer.com' });
    customerId = customer.body.data.customer.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('sequential retry: second payment with the same idempotencyKey returns the same invoice without creating a second payment record', async () => {
    const invoice = await createInvoice(200);
    const idempotencyKey = `pay-seq-${runId}`;

    const first = await payInvoice(invoice.id, { amount: 200, idempotencyKey });
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);

    const retry = await payInvoice(invoice.id, { amount: 200, idempotencyKey });
    expect(retry.status).toBe(200);
    expect(retry.body.success).toBe(true);

    // Invoice should appear the same in both responses (same ID, same status).
    expect(retry.body.data.invoice.id).toBe(first.body.data.invoice.id);

    // Only one InvoicePayment row must exist for this key.
    const payments = await prisma.invoicePayment.findMany({
      where: { tenantId, idempotencyKey },
    });
    expect(payments).toHaveLength(1);
  });

  it('concurrent race: two simultaneous requests with the same idempotencyKey create exactly one payment', async () => {
    const invoice = await createInvoice(150);
    const idempotencyKey = `pay-race-${runId}`;

    const [resA, resB] = await Promise.all([
      payInvoice(invoice.id, { amount: 150, idempotencyKey }),
      payInvoice(invoice.id, { amount: 150, idempotencyKey }),
    ]);

    // Both should succeed (200).
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // Exactly one payment row for this idempotency key.
    const payments = await prisma.invoicePayment.findMany({
      where: { tenantId, idempotencyKey },
    });
    expect(payments).toHaveLength(1);
  });

  it('different idempotencyKey values on the same invoice create distinct payment records (partial payments)', async () => {
    const invoice = await createInvoice(300);

    const first = await payInvoice(invoice.id, { amount: 100, idempotencyKey: `pay-part-a-${runId}` });
    expect(first.status).toBe(200);

    const second = await payInvoice(invoice.id, { amount: 100, idempotencyKey: `pay-part-b-${runId}` });
    expect(second.status).toBe(200);

    const payments = await prisma.invoicePayment.findMany({ where: { tenantId, invoiceId: invoice.id } });
    expect(payments.length).toBeGreaterThanOrEqual(2);
  });

  it('omitting idempotencyKey still works (backward compatibility) — each call creates its own payment', async () => {
    const invoice = await createInvoice(250);

    const first = await payInvoice(invoice.id, { amount: 100 });
    expect(first.status).toBe(200);

    const second = await payInvoice(invoice.id, { amount: 100 });
    expect(second.status).toBe(200);

    // Without idempotencyKey each call is independent — two distinct payments.
    const payments = await prisma.invoicePayment.findMany({ where: { tenantId, invoiceId: invoice.id } });
    expect(payments.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects an idempotencyKey that is not a non-empty string', async () => {
    const invoice = await createInvoice(50);

    const empty = await payInvoice(invoice.id, { amount: 50, idempotencyKey: '' });
    expect(empty.status).toBe(400);
  });

  it('cross-tenant: same idempotencyKey on two different tenants are fully independent', async () => {
    // Create a second tenant.
    const runId2 = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tenantSlug2 = `inv-pay-idem-b-${runId2}`;
    const tenantSchema2 = `tenant_inv_pay_idem_b_${runId2}`;
    const adminEmail2 = `admin_invpayidemb_${runId2}@corp.com`;

    let tenantId2 = '';
    let adminToken2 = '';
    let customerId2 = '';

    try {
      const onboard2 = await onboardTenant(prisma, {
        companyName: 'Invoice Pay Idempotency Corp B',
        slug: tenantSlug2,
        adminEmail: adminEmail2,
        adminPassword: 'Password123!',
        adminName: 'Idem Admin B',
      });
      adminToken2 = onboard2.token;
      tenantId2 = onboard2.tenant.id;

      const customer2 = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken2}`)
        .set('X-Tenant-ID', tenantSlug2)
        .send({ name: 'Idem Customer B', email: 'idemb@customer.com' });
      customerId2 = customer2.body.data.customer.id;

      const invoice2 = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${adminToken2}`)
        .set('X-Tenant-ID', tenantSlug2)
        .send({ customerId: customerId2, items: [{ description: 'Service', quantity: 1, unitPrice: 80 }] });
      expect(invoice2.status).toBe(201);
      const inv2Id = invoice2.body.data.invoice.id;

      // First tenant invoice.
      const invoice1 = await createInvoice(80);

      const sharedKey = `cross-tenant-shared-key-${runId}`;

      const [res1, res2] = await Promise.all([
        payInvoice(invoice1.id, { amount: 80, idempotencyKey: sharedKey }),
        request(app)
          .post(`/api/v1/invoices/${inv2Id}/pay`)
          .set('Authorization', `Bearer ${adminToken2}`)
          .set('X-Tenant-ID', tenantSlug2)
          .send({ amount: 80, idempotencyKey: sharedKey }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Each tenant has exactly one payment for the shared key — no bleeding.
      const paymentsT1 = await prisma.invoicePayment.findMany({ where: { tenantId, idempotencyKey: sharedKey } });
      const paymentsT2 = await prisma.invoicePayment.findMany({ where: { tenantId: tenantId2, idempotencyKey: sharedKey } });
      expect(paymentsT1).toHaveLength(1);
      expect(paymentsT2).toHaveLength(1);
    } finally {
      await deleteAuditLogs(prisma, { tenantId: tenantId2 }).catch(() => {});
      await deleteTenantBySlug(prisma, tenantSlug2).catch(() => {});
      await deleteUserByEmail(prisma, adminEmail2).catch(() => {});
      await dropTenantSchema(prisma, tenantSchema2).catch(() => {});
    }
  });
});
