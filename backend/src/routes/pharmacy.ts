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
      const { patientName, patientAge, patientPhone, prescribingDoctor, prescriptionDate, notes, lines, billingType, patientId } = req.body;

      const rxNumber = `RX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const resolvedBillingType = ['CASH', 'NHIS', 'INSURANCE'].includes(billingType) ? billingType : 'CASH';

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
          billingType: resolvedBillingType,
          patientId: patientId || null,
          lines: {
            create: lines.map((l: any) => ({
              itemId: l.itemId,
              prescribedQty: l.prescribedQty,
              notes: l.notes ?? null,
            })),
          },
        },
        include: {
          lines: { include: { item: { select: { id: true, name: true, sku: true } } } },
          patient: { select: { id: true, name: true, nhisCardNumber: true, allergies: true } },
        },
      });

      res.status(201).json({ success: true, data: { prescription } });
    } catch (error: any) {
      console.error('[Pharmacy] Error creating prescription:', error);
      res.status(500).json({ success: false, error: 'Failed to create prescription.' });
    }
  }
);

/**
 * POST /api/v1/pharmacy/prescriptions/:id/send-refill-reminder
 * Sends an SMS refill reminder to the patient's phone.
 */
router.post('/prescriptions/:id/send-refill-reminder', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const prescription = await (prisma as any).prescription.findFirst({
      where: { id: req.params.id, tenantId },
      include: { lines: { include: { item: { select: { name: true } } } } },
    });
    if (!prescription) {
      res.status(404).json({ success: false, error: 'Prescription not found.' });
      return;
    }
    if (!prescription.patientPhone) {
      res.status(400).json({ success: false, error: 'Prescription has no patient phone number.' });
      return;
    }

    const drugList = prescription.lines.map((l: any) => l.item.name).join(', ');
    const message = `Hi ${prescription.patientName}, your medication refill reminder from your pharmacy. Drugs: ${drugList}. Please visit us to renew your prescription (Rx: ${prescription.rxNumber}).`;

    const { SmsService } = require('../services/smsService');
    await SmsService.send(prescription.patientPhone, message);

    res.status(200).json({ success: true, data: { sent: true, phone: prescription.patientPhone } });
  } catch (error: any) {
    console.error('[Pharmacy] Error sending refill reminder:', error);
    res.status(500).json({ success: false, error: 'Failed to send refill reminder.' });
  }
});

// ─── Patient Registry ─────────────────────────────────────────────────────────

const createPatientSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().nullable(),
  dateOfBirth: z.string().datetime({ offset: true }).optional().nullable(),
  nhisCardNumber: z.string().max(50).optional().nullable(),
  allergies: z.array(z.string().max(100)).max(50).optional().default([]),
  chronicConditions: z.string().max(1000).optional().nullable(),
});

/**
 * GET /api/v1/pharmacy/patients
 * Lists patients. Optional ?q= search on name/phone.
 */
router.get('/patients', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;

    const patients = await (prisma as any).pharmacyPatient.findMany({
      where: {
        tenantId,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { nhisCardNumber: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ success: true, data: { patients } });
  } catch (error: any) {
    console.error('[Pharmacy] Error fetching patients:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve patients.' });
  }
});

/**
 * POST /api/v1/pharmacy/patients
 * Creates a new patient record.
 */
router.post('/patients', requireRole('Accountant', 'Shop Manager', 'Cashier'), validateBody(createPatientSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { name, phone, dateOfBirth, nhisCardNumber, allergies, chronicConditions } = req.body;

    const patient = await (prisma as any).pharmacyPatient.create({
      data: {
        tenantId,
        name,
        phone: phone ?? null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        nhisCardNumber: nhisCardNumber ?? null,
        allergies: allergies ?? [],
        chronicConditions: chronicConditions ?? null,
      },
    });

    res.status(201).json({ success: true, data: { patient } });
  } catch (error: any) {
    console.error('[Pharmacy] Error creating patient:', error);
    res.status(500).json({ success: false, error: 'Failed to create patient.' });
  }
});

/**
 * PUT /api/v1/pharmacy/patients/:id
 * Updates a patient's details (allergies, NHIS card, etc).
 */
router.put('/patients/:id', requireRole('Accountant', 'Shop Manager', 'Cashier'), validateBody(createPatientSchema.partial()), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const existing = await (prisma as any).pharmacyPatient.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Patient not found.' });
      return;
    }

    const { name, phone, dateOfBirth, nhisCardNumber, allergies, chronicConditions } = req.body;
    const patient = await (prisma as any).pharmacyPatient.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone: phone ?? null } : {}),
        ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
        ...(nhisCardNumber !== undefined ? { nhisCardNumber: nhisCardNumber ?? null } : {}),
        ...(allergies !== undefined ? { allergies } : {}),
        ...(chronicConditions !== undefined ? { chronicConditions: chronicConditions ?? null } : {}),
      },
    });

    res.status(200).json({ success: true, data: { patient } });
  } catch (error: any) {
    console.error('[Pharmacy] Error updating patient:', error);
    res.status(500).json({ success: false, error: 'Failed to update patient.' });
  }
});

// ─── NHIS Claims ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/pharmacy/nhis-claims?from=&to=
 * Returns all NHIS-billed prescriptions in the date range for claim submission.
 */
router.get('/nhis-claims', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    to.setHours(23, 59, 59, 999);

    const prescriptions = await (prisma as any).prescription.findMany({
      where: {
        tenantId,
        billingType: 'NHIS',
        prescriptionDate: { gte: from, lte: to },
      },
      include: {
        lines: { include: { item: { select: { name: true, sku: true } } } },
        patient: { select: { name: true, nhisCardNumber: true, dateOfBirth: true } },
      },
      orderBy: { prescriptionDate: 'asc' },
    });

    const totalClaims = prescriptions.length;
    const dispensedClaims = prescriptions.filter((p: any) => p.dispensedAt).length;

    res.status(200).json({ success: true, data: { prescriptions, totalClaims, dispensedClaims, from, to } });
  } catch (error: any) {
    console.error('[Pharmacy] Error fetching NHIS claims:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve NHIS claims.' });
  }
});

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
  operationType: z.enum(['RECEIVED', 'DISPENSED', 'DESTROYED', 'RETURNED', 'DAILY_COUNT']),
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

      // Compute balanceAfter from the last entry for this item.
      // DAILY_COUNT is an absolute override: balanceAfter = the counted quantity.
      const lastEntry = await (prisma as any).narcoticsLogEntry.findFirst({
        where: { tenantId, itemId },
        orderBy: { entryDate: 'desc' },
      });
      const previousBalance = lastEntry ? lastEntry.balanceAfter : 0;
      let balanceAfter: number;
      if (operationType === 'DAILY_COUNT') {
        balanceAfter = quantity;
      } else {
        const delta = (operationType === 'RECEIVED' || operationType === 'RETURNED') ? quantity : -quantity;
        balanceAfter = previousBalance + delta;
      }

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
 * POST /api/v1/pharmacy/narcotics/daily-count
 * Records a physical end-of-day count of a controlled substance.
 * Requires Accountant role (Ghana FDA compliance).
 * balanceAfter is set to countedQty (absolute physical count overrides running total).
 */
const dailyCountSchema = z.object({
  itemId: z.string().uuid(),
  countedQty: z.number().int().min(0),
  notes: z.string().min(1).max(1000),
});

router.post(
  '/narcotics/daily-count',
  requireRole('Accountant'),
  validateBody(dailyCountSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = requireTenantContext();
      const { itemId, countedQty, notes } = req.body;

      const lastEntry = await (prisma as any).narcoticsLogEntry.findFirst({
        where: { tenantId, itemId },
        orderBy: { entryDate: 'desc' },
      });
      const previousBalance = lastEntry ? lastEntry.balanceAfter : 0;
      const discrepancy = countedQty - previousBalance;
      const discrepancyNote = discrepancy !== 0
        ? ` [Discrepancy: ${discrepancy > 0 ? '+' : ''}${discrepancy}]`
        : ' [Count matches register]';

      const entry = await (prisma as any).narcoticsLogEntry.create({
        data: {
          tenantId,
          itemId,
          entryDate: new Date(),
          operationType: 'DAILY_COUNT',
          quantity: countedQty,
          balanceAfter: countedQty,
          recordedByName: req.user?.name || req.user?.email || 'Unknown',
          notes: notes + discrepancyNote,
        },
        include: { item: { select: { id: true, name: true, sku: true } } },
      });

      res.status(201).json({ success: true, data: { entry } });
    } catch (error: any) {
      console.error('[Pharmacy] Error recording daily count:', error);
      res.status(500).json({ success: false, error: 'Failed to record daily count.' });
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
      const isDailyCount = e.operationType === 'DAILY_COUNT';
      const isIn = !isDailyCount && (e.operationType === 'RECEIVED' || e.operationType === 'RETURNED');
      const opLabel = isDailyCount ? '[COUNT]' : e.operationType;

      // Shade DAILY_COUNT rows lightly to distinguish them from movement rows
      if (isDailyCount) {
        doc.fillColor('#f3f4f6').rect(36, y - 1, doc.page.width - 72, rowH).fill().fillColor('black');
      }

      doc.text(new Date(e.entryDate).toLocaleDateString('en-GB'), cols.date, y, { width: 70 });
      doc.text(e.item.name, cols.drug, y, { width: 115 });
      doc.text(e.batchNumber || '-', cols.batch, y, { width: 80 });
      doc.text(opLabel, cols.op, y, { width: 70 });
      doc.text(isDailyCount ? '—' : (isIn ? String(e.quantity) : '-'), cols.qtyIn, y, { width: 50 });
      doc.text(isDailyCount ? '—' : (!isIn ? String(e.quantity) : '-'), cols.qtyOut, y, { width: 50 });

      // For DAILY_COUNT show balance with any discrepancy annotation extracted from notes
      const discMatch = (e.notes || '').match(/\[Discrepancy: ([^\]]+)\]/);
      const balanceCell = isDailyCount && discMatch
        ? `${e.balanceAfter} (Δ${discMatch[1]})`
        : String(e.balanceAfter);
      doc.text(balanceCell, cols.balance, y, { width: 80 });
      doc.text(isDailyCount ? '-' : (e.patientName || '-'), cols.patient, y, { width: 120 });
      doc.text(isDailyCount ? '-' : (e.prescriptionRef || e.supplierRef || '-'), cols.ref, y, { width: 100 });
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
