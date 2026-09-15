import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { tenantContextMiddleware, requireTenantContext } from '../middleware/tenantContext';
import { requireRole } from '../middleware/rbac';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);

// ── Message templates ────────────────────────────────────────────────────────

const TEMPLATES: Record<string, (data: Record<string, string>) => string> = {
  FEE_REMINDER: (d) =>
    `Dear ${d.guardianName}, this is a reminder that ${d.studentName}'s school fees ` +
    `of ${d.currency}${d.amount} are due on ${d.dueDate}. Please contact the school office for payment. Thank you.`,

  ATTENDANCE: (d) =>
    `Dear ${d.guardianName}, ${d.studentName} was ${d.status} on ${d.date}. ` +
    `Please contact the school if this is unexpected. Thank you.`,

  RESULTS: (d) =>
    `Dear ${d.guardianName}, ${d.studentName}'s results for ${d.term} are now available. ` +
    `Overall average: ${d.average}%. Please visit the school to collect the report card. Thank you.`,

  GENERAL: (d) => d.message || '',
};

// GET /templates
router.get('/templates', (_req: Request, res: Response) => {
  res.json({
    templates: [
      {
        type: 'FEE_REMINDER',
        label: 'Fee Reminder',
        fields: ['guardianName', 'studentName', 'currency', 'amount', 'dueDate'],
        preview: TEMPLATES.FEE_REMINDER({
          guardianName: 'Mr. Mensah',
          studentName: 'Kofi Mensah',
          currency: 'GHS ',
          amount: '450.00',
          dueDate: '30 Sep 2026',
        }),
      },
      {
        type: 'ATTENDANCE',
        label: 'Attendance Alert',
        fields: ['guardianName', 'studentName', 'status', 'date'],
        preview: TEMPLATES.ATTENDANCE({
          guardianName: 'Mrs. Asante',
          studentName: 'Ama Asante',
          status: 'absent',
          date: '15 Sep 2026',
        }),
      },
      {
        type: 'RESULTS',
        label: 'Results Notification',
        fields: ['guardianName', 'studentName', 'term', 'average'],
        preview: TEMPLATES.RESULTS({
          guardianName: 'Mr. Owusu',
          studentName: 'Kwame Owusu',
          term: 'Term 1 2026',
          average: '78.5',
        }),
      },
      {
        type: 'GENERAL',
        label: 'General Message',
        fields: ['message'],
        preview: 'Dear Parent, [Your custom message here].',
      },
    ],
  });
});

// GET / — list messages
router.get('/', async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { studentId, type, channel, status, from, to, limit = '50', offset = '0' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { tenantId };
  if (studentId) where.studentId = studentId;
  if (type) where.type = type;
  if (channel) where.channel = channel;
  if (status) where.status = status;
  if (from || to) {
    where.sentAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [messages, total] = await Promise.all([
    prisma.parentMessage.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: Math.min(parseInt(limit), 200),
      skip: parseInt(offset),
    }),
    prisma.parentMessage.count({ where }),
  ]);

  // Enrich with student names
  const studentIds = [...new Set(messages.map((m) => m.studentId))];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, className: true },
  });
  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));

  res.json({
    total,
    messages: messages.map((m) => ({
      ...m,
      student: studentMap[m.studentId] ?? null,
    })),
  });
});

// GET /stats
router.get('/stats', async (_req: Request, res: Response) => {
  const tenantId = requireTenantContext();

  const [total, byType, byChannel, recent] = await Promise.all([
    prisma.parentMessage.count({ where: { tenantId } }),
    prisma.parentMessage.groupBy({
      by: ['type'],
      where: { tenantId },
      _count: { id: true },
    }),
    prisma.parentMessage.groupBy({
      by: ['channel'],
      where: { tenantId },
      _count: { id: true },
    }),
    prisma.parentMessage.count({
      where: {
        tenantId,
        sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  res.json({
    total,
    last7Days: recent,
    byType: Object.fromEntries(byType.map((r) => [r.type, r._count.id])),
    byChannel: Object.fromEntries(byChannel.map((r) => [r.channel, r._count.id])),
  });
});

// POST /send — single student message
router.post('/send', requireRole('Admin', 'Manager', 'Staff'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { studentId, type, channel, templateData, customMessage } = req.body as {
    studentId: string;
    type: string;
    channel: string;
    templateData?: Record<string, string>;
    customMessage?: string;
  };

  if (!studentId || !type || !channel) {
    return res.status(400).json({ error: 'studentId, type, and channel are required' });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
  });
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const recipient =
    channel === 'EMAIL'
      ? student.guardianEmail || ''
      : student.guardianPhone;

  if (!recipient) {
    return res.status(400).json({
      error: `No ${channel === 'EMAIL' ? 'email' : 'phone number'} on record for this student's guardian`,
    });
  }

  const templateFn = TEMPLATES[type];
  if (!templateFn) return res.status(400).json({ error: `Unknown message type: ${type}` });

  const mergedData = {
    guardianName: student.guardianName,
    studentName: `${student.firstName} ${student.lastName}`,
    currency: 'GHS ',
    ...(templateData || {}),
    message: customMessage || '',
  };
  const message = type === 'GENERAL' && customMessage ? customMessage : templateFn(mergedData);

  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;

  const record = await prisma.parentMessage.create({
    data: {
      tenantId,
      studentId,
      type,
      channel,
      recipient,
      message,
      status: 'SENT',
      sentBy: userId,
      referenceId: templateData?.referenceId,
    },
  });

  res.status(201).json({ message: record });
});

// POST /bulk — bulk messages by trigger type
router.post('/bulk', requireRole('Admin', 'Manager'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { trigger, channel = 'SMS', termId, date, className } = req.body as {
    trigger: 'FEE_DEFAULTERS' | 'ABSENT_TODAY' | 'RESULTS_READY';
    channel?: string;
    termId?: string;
    date?: string;
    className?: string;
  };

  if (!trigger) return res.status(400).json({ error: 'trigger is required' });

  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;
  let records: Array<{
    tenantId: string; studentId: string; type: string; channel: string;
    recipient: string; message: string; status: string; sentBy?: string; referenceId?: string;
  }> = [];

  if (trigger === 'FEE_DEFAULTERS') {
    // Students with outstanding invoices (status UNPAID or PARTIAL)
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ['UNPAID', 'PARTIAL'] },
        clientTxnId: { startsWith: 'SF:' },
      },
      select: { clientId: true, amountDue: true, dueDate: true, clientTxnId: true },
    });

    const studentIds = [...new Set(invoices.map((i) => i.clientId).filter(Boolean))] as string[];
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, tenantId, isActive: true },
    });

    for (const s of students) {
      const inv = invoices.find((i) => i.clientId === s.id);
      if (!inv) continue;
      const recipient = channel === 'EMAIL' ? s.guardianEmail : s.guardianPhone;
      if (!recipient) continue;
      const amount = inv.amountDue?.toString() ?? '0.00';
      const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-GB') : 'soon';
      records.push({
        tenantId,
        studentId: s.id,
        type: 'FEE_REMINDER',
        channel,
        recipient,
        message: TEMPLATES.FEE_REMINDER({
          guardianName: s.guardianName,
          studentName: `${s.firstName} ${s.lastName}`,
          currency: 'GHS ',
          amount,
          dueDate,
        }),
        status: 'SENT',
        sentBy: userId,
        referenceId: inv.clientTxnId,
      });
    }
  } else if (trigger === 'ABSENT_TODAY') {
    const checkDate = date ? new Date(date) : new Date();
    const dateStr = checkDate.toISOString().split('T')[0];

    const attendanceWhere: Record<string, unknown> = {
      tenantId,
      date: { gte: new Date(dateStr), lt: new Date(new Date(dateStr).getTime() + 86400000) },
      status: 'ABSENT',
    };
    if (className) attendanceWhere.className = className;

    const absentRecords = await prisma.attendanceRecord.findMany({
      where: attendanceWhere,
      select: { studentId: true },
    });

    const absentIds = [...new Set(absentRecords.map((a) => a.studentId))];
    const students = await prisma.student.findMany({
      where: { id: { in: absentIds }, tenantId, isActive: true },
    });

    const displayDate = checkDate.toLocaleDateString('en-GB');
    for (const s of students) {
      const recipient = channel === 'EMAIL' ? s.guardianEmail : s.guardianPhone;
      if (!recipient) continue;
      records.push({
        tenantId,
        studentId: s.id,
        type: 'ATTENDANCE',
        channel,
        recipient,
        message: TEMPLATES.ATTENDANCE({
          guardianName: s.guardianName,
          studentName: `${s.firstName} ${s.lastName}`,
          status: 'absent',
          date: displayDate,
        }),
        status: 'SENT',
        sentBy: userId,
        referenceId: dateStr,
      });
    }
  } else if (trigger === 'RESULTS_READY') {
    if (!termId) return res.status(400).json({ error: 'termId is required for RESULTS_READY' });

    const term = await prisma.academicTerm.findFirst({ where: { id: termId, tenantId } });
    if (!term) return res.status(404).json({ error: 'Term not found' });

    const studentWhere: Record<string, unknown> = { tenantId, isActive: true };
    if (className) studentWhere.className = className;

    const students = await prisma.student.findMany({ where: studentWhere });

    // Compute each student's average from assessments in the term
    const assessments = await prisma.studentAssessment.findMany({
      where: { tenantId, termId },
      select: { studentId: true, totalScore: true, maxScore: true },
    });

    const avgMap: Record<string, { sum: number; max: number; count: number }> = {};
    for (const a of assessments) {
      if (!avgMap[a.studentId]) avgMap[a.studentId] = { sum: 0, max: 0, count: 0 };
      avgMap[a.studentId].sum += Number(a.totalScore ?? 0);
      avgMap[a.studentId].max += Number(a.maxScore ?? 100);
      avgMap[a.studentId].count += 1;
    }

    for (const s of students) {
      const recipient = channel === 'EMAIL' ? s.guardianEmail : s.guardianPhone;
      if (!recipient) continue;
      const agg = avgMap[s.id];
      const avg = agg && agg.max > 0 ? ((agg.sum / agg.max) * 100).toFixed(1) : 'N/A';
      records.push({
        tenantId,
        studentId: s.id,
        type: 'RESULTS',
        channel,
        recipient,
        message: TEMPLATES.RESULTS({
          guardianName: s.guardianName,
          studentName: `${s.firstName} ${s.lastName}`,
          term: term.name,
          average: avg,
        }),
        status: 'SENT',
        sentBy: userId,
        referenceId: termId,
      });
    }
  }

  if (records.length === 0) {
    return res.json({ sent: 0, message: 'No eligible recipients found' });
  }

  const created = await prisma.parentMessage.createMany({ data: records });
  res.status(201).json({ sent: created.count });
});

// DELETE /:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response) => {
  const tenantId = requireTenantContext();
  const { id } = req.params;

  const msg = await prisma.parentMessage.findFirst({ where: { id, tenantId } });
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  await prisma.parentMessage.delete({ where: { id } });
  res.status(204).send();
});

export default router;
