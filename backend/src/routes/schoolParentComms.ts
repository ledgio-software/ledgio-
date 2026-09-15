import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTenantContext } from '../context/tenantContext';
import { prisma } from '../config/db';

const router = Router();
router.use(authenticateJwt, tenantContextMiddleware);

const db = prisma as unknown as {
  $queryRawUnsafe: <T = unknown>(sql: string, ...args: unknown[]) => Promise<T[]>;
  $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<number>;
};

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
router.get('/', requireRole('Admin', 'Accountant', 'HR'), async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext();
  const { studentId, type, channel, status, from, to, limit = '50', offset = '0' } = req.query as Record<string, string>;

  const conditions: string[] = ['m.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let p = 2;

  if (studentId) { conditions.push(`m.student_id = $${p++}`); params.push(studentId); }
  if (type)      { conditions.push(`m.type = $${p++}`);       params.push(type); }
  if (channel)   { conditions.push(`m.channel = $${p++}`);    params.push(channel); }
  if (status)    { conditions.push(`m.status = $${p++}`);     params.push(status); }
  if (from)      { conditions.push(`m.sent_at >= $${p++}`);   params.push(new Date(from)); }
  if (to)        { conditions.push(`m.sent_at <= $${p++}`);   params.push(new Date(to)); }

  const where = conditions.join(' AND ');
  const lim = Math.min(parseInt(limit) || 50, 200);
  const off = parseInt(offset) || 0;

  const [messages, countRows] = await Promise.all([
    db.$queryRawUnsafe<{
      id: string; student_id: string; type: string; channel: string;
      recipient: string; message: string; status: string;
      sent_at: string; sent_by: string | null; reference_id: string | null;
      first_name: string | null; last_name: string | null; class_name: string | null;
    }>(
      `SELECT m.id, m.student_id, m.type, m.channel, m.recipient, m.message, m.status,
              m.sent_at, m.sent_by, m.reference_id,
              s.first_name, s.last_name, s.class_name
       FROM parent_messages m
       LEFT JOIN students s ON s.id = m.student_id
       WHERE ${where}
       ORDER BY m.sent_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      ...params, lim, off,
    ),
    db.$queryRawUnsafe<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM parent_messages m WHERE ${where}`,
      ...params,
    ),
  ]);

  res.json({
    total: parseInt(countRows[0]?.cnt ?? '0'),
    messages: messages.map((m) => ({
      id: m.id,
      studentId: m.student_id,
      type: m.type,
      channel: m.channel,
      recipient: m.recipient,
      message: m.message,
      status: m.status,
      sentAt: m.sent_at,
      sentBy: m.sent_by,
      referenceId: m.reference_id,
      student: m.first_name
        ? { firstName: m.first_name, lastName: m.last_name, className: m.class_name }
        : null,
    })),
  });
});

// GET /stats
router.get('/stats', requireRole('Admin', 'Accountant', 'HR'), async (_req: Request, res: Response) => {
  const { tenantId } = requireTenantContext();

  const [totalRows, byTypeRows, byChannelRows, recentRows] = await Promise.all([
    db.$queryRawUnsafe<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM parent_messages WHERE tenant_id = $1`, tenantId,
    ),
    db.$queryRawUnsafe<{ type: string; cnt: string }>(
      `SELECT type, COUNT(*)::text AS cnt FROM parent_messages WHERE tenant_id = $1 GROUP BY type`, tenantId,
    ),
    db.$queryRawUnsafe<{ channel: string; cnt: string }>(
      `SELECT channel, COUNT(*)::text AS cnt FROM parent_messages WHERE tenant_id = $1 GROUP BY channel`, tenantId,
    ),
    db.$queryRawUnsafe<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM parent_messages WHERE tenant_id = $1 AND sent_at >= NOW() - INTERVAL '7 days'`, tenantId,
    ),
  ]);

  res.json({
    total: parseInt(totalRows[0]?.cnt ?? '0'),
    last7Days: parseInt(recentRows[0]?.cnt ?? '0'),
    byType: Object.fromEntries(byTypeRows.map((r) => [r.type, parseInt(r.cnt)])),
    byChannel: Object.fromEntries(byChannelRows.map((r) => [r.channel, parseInt(r.cnt)])),
  });
});

// POST /send — single student message
router.post('/send', requireRole('Admin', 'HR'), async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext();
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

  const students = await db.$queryRawUnsafe<{
    id: string; first_name: string; last_name: string;
    guardian_name: string; guardian_phone: string; guardian_email: string | null;
  }>(
    `SELECT id, first_name, last_name, guardian_name, guardian_phone, guardian_email
     FROM students WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    studentId, tenantId,
  );
  if (students.length === 0) return res.status(404).json({ error: 'Student not found' });
  const student = students[0];

  const recipient = channel === 'EMAIL' ? (student.guardian_email || '') : student.guardian_phone;
  if (!recipient) {
    return res.status(400).json({
      error: `No ${channel === 'EMAIL' ? 'email' : 'phone number'} on record for this student's guardian`,
    });
  }

  const templateFn = TEMPLATES[type];
  if (!templateFn) return res.status(400).json({ error: `Unknown message type: ${type}` });

  const mergedData = {
    guardianName: student.guardian_name,
    studentName: `${student.first_name} ${student.last_name}`,
    currency: 'GHS ',
    ...(templateData || {}),
    message: customMessage || '',
  };
  const messageText = type === 'GENERAL' && customMessage ? customMessage : templateFn(mergedData);

  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;

  const [record] = await db.$queryRawUnsafe<{ id: string; sent_at: string }>(
    `INSERT INTO parent_messages (tenant_id, student_id, type, channel, recipient, message, status, sent_by, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'SENT', $7, $8)
     RETURNING id, sent_at`,
    tenantId, studentId, type, channel, recipient, messageText, userId ?? null, templateData?.referenceId ?? null,
  );

  res.status(201).json({ message: { id: record.id, sentAt: record.sent_at } });
});

// POST /bulk — bulk messages by trigger type
router.post('/bulk', requireRole('Admin'), async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext();
  const { trigger, channel = 'SMS', termId, date, className } = req.body as {
    trigger: 'FEE_DEFAULTERS' | 'ABSENT_TODAY' | 'RESULTS_READY';
    channel?: string;
    termId?: string;
    date?: string;
    className?: string;
  };

  if (!trigger) return res.status(400).json({ error: 'trigger is required' });

  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;

  interface BulkRecord {
    tenantId: string; studentId: string; type: string; channel: string;
    recipient: string; message: string; status: string; sentBy: string | null; referenceId: string | null;
  }
  const records: BulkRecord[] = [];

  if (trigger === 'FEE_DEFAULTERS') {
    // Outstanding school-fee invoices (client_txn_id starts with 'SF:')
    const rows = await db.$queryRawUnsafe<{
      student_id: string; first_name: string; last_name: string;
      guardian_name: string; guardian_phone: string; guardian_email: string | null;
      amount_due: string; due_date: string | null; client_txn_id: string | null;
    }>(
      `SELECT s.id AS student_id, s.first_name, s.last_name,
              s.guardian_name, s.guardian_phone, s.guardian_email,
              (i.total - i.amount_paid)::text AS amount_due,
              i.due_date, i.client_txn_id
       FROM invoices i
       JOIN students s ON s.id = i.customer_id
       WHERE i.tenant_id = $1
         AND i.status IN ('SENT', 'PARTIALLY_PAID')
         AND i.client_txn_id LIKE 'SF:%'
         AND s.is_active = true
       ORDER BY s.last_name, s.first_name`,
      tenantId,
    );

    for (const r of rows) {
      const recipient = channel === 'EMAIL' ? (r.guardian_email || '') : r.guardian_phone;
      if (!recipient) continue;
      const dueDate = r.due_date ? new Date(r.due_date).toLocaleDateString('en-GB') : 'soon';
      records.push({
        tenantId,
        studentId: r.student_id,
        type: 'FEE_REMINDER',
        channel,
        recipient,
        message: TEMPLATES.FEE_REMINDER({
          guardianName: r.guardian_name,
          studentName: `${r.first_name} ${r.last_name}`,
          currency: 'GHS ',
          amount: r.amount_due,
          dueDate,
        }),
        status: 'SENT',
        sentBy: userId ?? null,
        referenceId: r.client_txn_id,
      });
    }
  } else if (trigger === 'ABSENT_TODAY') {
    const checkDate = date ? new Date(date) : new Date();
    const dateStr = checkDate.toISOString().split('T')[0];
    const displayDate = checkDate.toLocaleDateString('en-GB');

    const classFilter = className ? ` AND s.class_name = $3` : '';
    const params: unknown[] = [tenantId, dateStr];
    if (className) params.push(className);

    const rows = await db.$queryRawUnsafe<{
      student_id: string; first_name: string; last_name: string;
      guardian_name: string; guardian_phone: string; guardian_email: string | null;
    }>(
      `SELECT DISTINCT s.id AS student_id, s.first_name, s.last_name,
              s.guardian_name, s.guardian_phone, s.guardian_email
       FROM school_attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.tenant_id = $1
         AND a.date = $2::date
         AND a.status = 'ABSENT'
         AND s.is_active = true${classFilter}
       ORDER BY s.last_name, s.first_name`,
      ...params,
    );

    for (const r of rows) {
      const recipient = channel === 'EMAIL' ? (r.guardian_email || '') : r.guardian_phone;
      if (!recipient) continue;
      records.push({
        tenantId,
        studentId: r.student_id,
        type: 'ATTENDANCE',
        channel,
        recipient,
        message: TEMPLATES.ATTENDANCE({
          guardianName: r.guardian_name,
          studentName: `${r.first_name} ${r.last_name}`,
          status: 'absent',
          date: displayDate,
        }),
        status: 'SENT',
        sentBy: userId ?? null,
        referenceId: dateStr,
      });
    }
  } else if (trigger === 'RESULTS_READY') {
    if (!termId) return res.status(400).json({ error: 'termId is required for RESULTS_READY' });

    const terms = await db.$queryRawUnsafe<{ id: string; name: string }>(
      `SELECT id, name FROM academic_terms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      termId, tenantId,
    );
    if (terms.length === 0) return res.status(404).json({ error: 'Term not found' });
    const termName = terms[0].name;

    const classFilter = className ? ` AND s.class_name = $3` : '';
    const sparams: unknown[] = [tenantId, termId];
    if (className) sparams.push(className);

    const rows = await db.$queryRawUnsafe<{
      student_id: string; first_name: string; last_name: string;
      guardian_name: string; guardian_phone: string; guardian_email: string | null;
      total_score: string | null; max_score: string | null;
    }>(
      `SELECT s.id AS student_id, s.first_name, s.last_name,
              s.guardian_name, s.guardian_phone, s.guardian_email,
              SUM(a.total_score)::text AS total_score,
              SUM(a.max_score)::text AS max_score
       FROM students s
       LEFT JOIN student_assessments a ON a.student_id = s.id AND a.term_id = $2
       WHERE s.tenant_id = $1 AND s.is_active = true${classFilter}
       GROUP BY s.id, s.first_name, s.last_name, s.guardian_name, s.guardian_phone, s.guardian_email
       ORDER BY s.last_name, s.first_name`,
      ...sparams,
    );

    for (const r of rows) {
      const recipient = channel === 'EMAIL' ? (r.guardian_email || '') : r.guardian_phone;
      if (!recipient) continue;
      const totalScore = parseFloat(r.total_score ?? '0');
      const maxScore = parseFloat(r.max_score ?? '0');
      const avg = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 'N/A';
      records.push({
        tenantId,
        studentId: r.student_id,
        type: 'RESULTS',
        channel,
        recipient,
        message: TEMPLATES.RESULTS({
          guardianName: r.guardian_name,
          studentName: `${r.first_name} ${r.last_name}`,
          term: termName,
          average: avg,
        }),
        status: 'SENT',
        sentBy: userId ?? null,
        referenceId: termId,
      });
    }
  }

  if (records.length === 0) {
    return res.json({ sent: 0, message: 'No eligible recipients found' });
  }

  for (const r of records) {
    await db.$executeRawUnsafe(
      `INSERT INTO parent_messages (tenant_id, student_id, type, channel, recipient, message, status, sent_by, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      r.tenantId, r.studentId, r.type, r.channel, r.recipient, r.message, r.status, r.sentBy, r.referenceId,
    );
  }

  res.status(201).json({ sent: records.length });
});

// DELETE /:id
router.delete('/:id', requireRole('Admin'), async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext();
  const { id } = req.params;

  const rows = await db.$queryRawUnsafe<{ id: string }>(
    `SELECT id FROM parent_messages WHERE id = $1 AND tenant_id = $2`, id, tenantId,
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Message not found' });

  await db.$executeRawUnsafe(`DELETE FROM parent_messages WHERE id = $1`, id);
  res.status(204).send();
});

export default router;
