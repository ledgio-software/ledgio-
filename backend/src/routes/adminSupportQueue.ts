import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';

const router = Router();

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** GET /admin/support-queue?status=OPEN&assignedTo=michael */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const where: any = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json({ success: true, data: tickets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /admin/support-queue */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { title, description, priority, assignedTo, tenantId, tenantName, errorLogRef, notes } =
    req.body as Record<string, string | undefined>;

  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({ success: false, error: 'title and description are required.' });
    return;
  }
  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        priority: VALID_PRIORITIES.includes(priority ?? '') ? priority! : 'MEDIUM',
        assignedTo: assignedTo || null,
        tenantId: tenantId || null,
        tenantName: tenantName || null,
        errorLogRef: errorLogRef || null,
        notes: notes || null,
      },
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** PATCH /admin/support-queue/:id */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { status, priority, assignedTo, notes, title, description } =
    req.body as Record<string, string | undefined>;
  try {
    const data: any = { updatedAt: new Date() };
    if (status && VALID_STATUSES.includes(status)) data.status = status;
    if (priority && VALID_PRIORITIES.includes(priority)) data.priority = priority;
    if (assignedTo !== undefined) data.assignedTo = assignedTo || null;
    if (notes !== undefined) data.notes = notes || null;
    if (title?.trim()) data.title = title.trim();
    if (description?.trim()) data.description = description.trim();

    const ticket = await prisma.supportTicket.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: ticket });
  } catch (err: any) {
    res.status(err.code === 'P2025' ? 404 : 500).json({ success: false, error: err.message });
  }
});

/** DELETE /admin/support-queue/:id */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.supportTicket.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.code === 'P2025' ? 404 : 500).json({ success: false, error: err.message });
  }
});

export default router;
