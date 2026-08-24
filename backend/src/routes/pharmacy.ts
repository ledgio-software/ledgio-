import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { z } from 'zod';
import { validateBody } from '../middleware/validateBody';
import { actorFromRequest } from '../services/auditLogService';
import PDFDocument from 'pdfkit';

const router = Router();

router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/** Reject non-PHARMACY tenants with 403 before any pharmacy endpoint runs. */
async function requirePharmacyOrgType(req: Request, res: Response, next: Function): Promise<void> {
  const { tenantId } = requireTenantContext();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { orgType: true } });
  if (!tenant || tenant.orgType !== 'PHARMACY') {
    res.status(403).json({ success: false, error: 'This feature is only available for PHARMACY tenants.' });
    return;
  }
  next();
}

router.use(requirePharmacyOrgType as any);

// ─── Prescriptions ───────────────────────────────────────────────────────────

const prescriptionLineSchema = z.object({
  itemId: z.string().uuid(),
  prescribedQty: z.number().int().positive(),
  notes: z.string().max(500).optional().nullable(),
});

const createPrescriptionSchema = z.object({
  patientName: z.string().min(1).max(200),
  patientAge: z.number().int().positive().max(150).optional().nullable(),
  patientPhone: z.string().max(30).optional().nullable(),
  prescribingDoctor: z.string().min(1).max(200),
  prescriptionDate: z.string().datetime({ offset: true }),
  notes: z.string().max(1000).optional().nullable(),
  lines: z.array(prescriptionLineSchema).min(1).max(100),
});

/**
 * GET /api/v1/pharmacy/prescriptions
 * Lists prescriptions, newest first. Optional ?q= search on patientName / rxNumber.
 */
router.get('/prescriptions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;

    const prescriptions = await (prisma as any).prescription.findMany({
      where: {
        tenantId,
        ...(q ? {
          OR: [
            { patientName: { contains: q, mode: 'insensitive' } },
            { rxNumber: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: { lines: { include: { item: { select: { id: true, name: true, sku: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, data: { prescriptions } });
  } catch (error: any) {
    console.error('[Pharmacy] Error fetching prescriptions:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve prescriptions.' });
  }
});

/**
 * POST /api/v1/pharmacy/prescriptions
 * Creates a new prescription record.
 */
router.post(
  '/prescriptions',
  requireRole('Accountant', 'Shop Manager', 'Cashier'),
  validateBody(createPrescriptionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = requireTenantContext();
      const { patientName, patientAge, patientPhone, prescribingDoctor, prescriptionDate, notes, lines } = req.body;

      const rxNumber = `RX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const prescription = await (prisma as any).prescription.create({
        data: {
          tenantId,
          rxNumber,
          patientName,
          patientAge: patientAge ?? null,
          patientPhone: patientPhone ?? null,
          prescribingDoctor,
          prescriptionDate: new Date(prescriptionDate),
          notes: notes ?? null,
          lines: {
            create: lines.map((l: any) => ({
              itemId: l.itemId,
              prescribedQty: l.prescribedQty,
              notes: l.notes ?? null,
            })),
          },
        },
        include: { lines: { include: { item: { select: { id: true, name: true, sku: true } } } } },
      });

      res.status(201).json({ success: true, data: { prescription } });
    } catch (error: any) {
      console.error('[Pharmacy] Error creating prescription:', error);
      res.status(500).json({ success: false, error: 'Failed to create prescription.' });
    }
  }
);

/**
 * GET /api/v1/pharmacy/prescriptions/:id
 */
router.get('/prescriptions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const prescription = await (prisma as any).prescription.findFirst({
      where: { id: req.params.id, tenantId },
      include: { lines: { include: { item: { select: { id: true, name: true, sku: true } } } } },
    });
    if (!prescription) {
      res.status(404).json({ success: false, error: 'Prescription not found.' });
      return;
    }
    res.status(200).json({ success: true, data: { prescription } });
  } catch (error: any) {
    console.error('[Pharmacy] Error fetching prescription:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve prescription.' });
  }
});

/**
 * PATCH /api/v1/pharmacy/prescriptions/:id/dispense
 * Marks the prescription as dispensed, links to a CashSale if provided.
 */
router.patch(
  '/prescriptions/:id/dispense',
  requireRole('Accountant', 'Shop Manager', 'Cashier'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = requireTenantContext();
      const { cashSaleId, dispensedByName } = req.body;

      const existing = await (prisma as any).prescription.findFirst({
        where: { id: req.params.id, tenantId },
        include: { lines: true },
      });
      if (!existing) {
        res.status(404).json({ success: false, error: 'Prescription not found.' });
        return;
      }
      if (existing.dispensedAt) {
        res.status(400).json({ success: false, error: 'Prescription already dispensed.' });
        return;
      }

      const updated = await (prisma as any).prescription.update({
        where: { id: req.params.id },
        data: {
          dispensedAt: new Date(),
          dispensedByName: dispensedByName || req.user?.name || req.user?.email || null,
          cashSaleId: cashSaleId || null,
          lines: {
            updateMany: {
              where: { prescriptionId: req.params.id },
              data: { dispensedQty: { increment: 0 } }, // lines updated individually if needed
            },
          },
        },
        include: { lines: { include: { item: { select: { id: true, name: true, sku: true } } } } },
      });

      res.status(200).json({ success: true, data: { prescription: updated } });
    } catch (error: any) {
      console.error('[Pharmacy] Error dispensing prescription:', error);
      res.status(500).json({ success: false, error: 'Failed to dispense prescription.' });
    }
  }
);

// ─── Narcotics Register ───────────────────────────────────────────────────────

const createNarcoticsEntrySchema = z.object({
  itemId: z.string().uuid(),
  batchNumber: z.string().max(100).optional().nullable(),
  operationType: z.enum(['RECEIVED', 'DISPENSED', 'DESTROYED', 'RETURNED']),
  quantity: z.number().int().positive(),
  patientName: z.string().max(200).optional().nullable(),
  prescriptionRef: z.string().max(100).optional().nullable(),
  supplierRef: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  entryDate: z.string().datetime({ offset: true }).optional().nullable(),
});

/**
 * GET /api/v1/pharmacy/narcotics
 * Lists narcotics log entries. Optional ?itemId=, ?from=, ?to= filters.
 */
router.get('/narcotics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { itemId, from, to } = req.query;

    const where: any = { tenantId };
    if (itemId) where.itemId = String(itemId);
    if (from || to) {
      where.entryDate = {};
      if (from) where.entryDate.gte = new Date(String(from));
      if (to) where.entryDate.lte = new Date(String(to));
    }

    const entries = await (prisma as any).narcoticsLogEntry.findMany({
      where,
      include: { item: { select: { id: true, name: true, sku: true } } },
      orderBy: { entryDate: 'desc' },
    });

    res.status(200).json({ success: true, data: { entries } });
  } catch (error: any) {
    console.error('[Pharmacy] Error fetching narcotics log:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve narcotics log.' });
  }
});

/**
 * POST /api/v1/pharmacy/narcotics
 * Manual narcotics log entry (Admin/Accountant only).
 */
router.post(
  '/narcotics',
  requireRole('Accountant'),
  validateBody(createNarcoticsEntrySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = requireTenantContext();
      const { itemId, batchNumber, operationType, quantity, patientName, prescriptionRef, supplierRef, notes, entryDate } = req.body;

      // Compute balanceAfter from the last entry for this item
      const lastEntry = await (prisma as any).narcoticsLogEntry.findFirst({
        where: { tenantId, itemId },
        orderBy: { entryDate: 'desc' },
      });
      const previousBalance = lastEntry ? lastEntry.balanceAfter : 0;
      const delta = (operationType === 'RECEIVED' || operationType === 'RETURNED') ? quantity : -quantity;
      const balanceAfter = previousBalance + delta;

      const entry = await (prisma as any).narcoticsLogEntry.create({
        data: {
          tenantId,
          itemId,
          batchNumber: batchNumber ?? null,
          entryDate: entryDate ? new Date(entryDate) : new Date(),
          operationType,
          quantity,
          balanceAfter,
          patientName: patientName ?? null,
          prescriptionRef: prescriptionRef ?? null,
          supplierRef: supplierRef ?? null,
          recordedByName: req.user?.name || req.user?.email || 'Unknown',
          notes: notes ?? null,
        },
        include: { item: { select: { id: true, name: true, sku: true } } },
      });

      res.status(201).json({ success: true, data: { entry } });
    } catch (error: any) {
      console.error('[Pharmacy] Error creating narcotics entry:', error);
      res.status(500).json({ success: false, error: 'Failed to create narcotics log entry.' });
    }
  }
);

/**
 * GET /api/v1/pharmacy/narcotics/export.pdf
 * Ghana FDA-format narcotics register PDF.
 */
router.get('/narcotics/export.pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, tenantName } = requireTenantContext();
    const { itemId, from, to } = req.query;

    const where: any = { tenantId };
    if (itemId) where.itemId = String(itemId);
    if (from || to) {
      where.entryDate = {};
      if (from) where.entryDate.gte = new Date(String(from));
      if (to) where.entryDate.lte = new Date(String(to));
    }

    const entries = await (prisma as any).narcoticsLogEntry.findMany({
      where,
      include: { item: { select: { name: true, sku: true } } },
      orderBy: { entryDate: 'asc' },
    });

    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const headerDone = new Promise<void>((resolve) => {
      doc.on('end', resolve);
    });

    // Header
    doc.fontSize(14).font('Helvetica-Bold').text('CONTROLLED SUBSTANCES REGISTER', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${tenantName || 'Pharmacy'} — Generated: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
    doc.moveDown(0.8);

    // Table header
    const cols = { date: 36, drug: 110, batch: 230, op: 315, qtyIn: 390, qtyOut: 445, balance: 500, patient: 555, ref: 680 };
    const rowH = 16;
    const startY = doc.y;

    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('Date', cols.date, startY);
    doc.text('Drug Name', cols.drug, startY);
    doc.text('Batch', cols.batch, startY);
    doc.text('Operation', cols.op, startY);
    doc.text('Qty In', cols.qtyIn, startY);
    doc.text('Qty Out', cols.qtyOut, startY);
    doc.text('Balance', cols.balance, startY);
    doc.text('Patient', cols.patient, startY);
    doc.text('Rx/Ref', cols.ref, startY);
    doc.moveDown(0.4);
    doc.moveTo(36, doc.y).lineTo(doc.page.width - 36, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(7.5);
    for (const e of entries) {
      const y = doc.y;
      const isIn = e.operationType === 'RECEIVED' || e.operationType === 'RETURNED';
      doc.text(new Date(e.entryDate).toLocaleDateString('en-GB'), cols.date, y, { width: 70 });
      doc.text(e.item.name, cols.drug, y, { width: 115 });
      doc.text(e.batchNumber || '-', cols.batch, y, { width: 80 });
      doc.text(e.operationType, cols.op, y, { width: 70 });
      doc.text(isIn ? String(e.quantity) : '-', cols.qtyIn, y, { width: 50 });
      doc.text(!isIn ? String(e.quantity) : '-', cols.qtyOut, y, { width: 50 });
      doc.text(String(e.balanceAfter), cols.balance, y, { width: 50 });
      doc.text(e.patientName || '-', cols.patient, y, { width: 120 });
      doc.text(e.prescriptionRef || e.supplierRef || '-', cols.ref, y, { width: 100 });
      doc.moveDown(0.25);
    }

    if (entries.length === 0) {
      doc.text('No entries found for the selected filters.', { align: 'center' });
    }

    doc.end();
    await headerDone;

    const pdfBuffer = Buffer.concat(buffers);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="narcotics-register.pdf"');
    res.status(200).send(pdfBuffer);
  } catch (error: any) {
    console.error('[Pharmacy] Error generating narcotics PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to generate narcotics register PDF.' });
  }
});

// ─── Expiry Alerts ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/pharmacy/expiry-alerts
 * Returns batches expiring within ?days= days (default 30, max 365).
 */
router.get('/expiry-alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const batches = await (prisma as any).inventoryBatch.findMany({
      where: {
        tenantId,
        expiryDate: { not: null, lte: cutoff },
        quantityOnHand: { gt: 0 },
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const now = Date.now();
    const result = batches.map((b: any) => ({
      ...b,
      daysRemaining: b.expiryDate
        ? Math.ceil((new Date(b.expiryDate).getTime() - now) / 86400000)
        : null,
    }));

    res.status(200).json({ success: true, data: { batches: result } });
  } catch (error: any) {
    console.error('[Pharmacy] Error fetching expiry alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve expiry alerts.' });
  }
});

export default router;
