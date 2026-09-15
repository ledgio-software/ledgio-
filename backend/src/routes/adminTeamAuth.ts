import { Router, Request, Response } from 'express';
import {
  getMemberPublicList,
  getAllMembersAdmin,
  authenticateTeamMember,
  updateMemberPin,
  issueTeamToken,
  verifyTeamToken,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  resetMemberPin,
  AdminTab,
} from '../services/teamMemberService';
import { verifyAdminSessionToken } from '../services/adminTotpService';
import { BroadcastService } from '../services/broadcastService';

const router = Router();

function isMasterAdmin(req: Request): boolean {
  const session = req.headers['x-admin-session'] as string | undefined;
  if (session && verifyAdminSessionToken(session)) return true;
  const passcode = req.headers['x-admin-passcode'] as string | undefined;
  if (passcode && BroadcastService.verifyPasscode(passcode)) return true;
  return false;
}

const VALID_COLORS = ['blue', 'cyan', 'emerald', 'rose', 'violet', 'amber', 'indigo', 'slate'];
const VALID_TABS: AdminTab[] = [
  'broadcast', 'health', 'performance', 'jobs', 'integrations',
  'schemas', 'audit', 'onboard', 'feedback', 'analytics', 'errors',
  'safety', 'referral', 'clienthealth', 'churnrisk', 'onboarding',
  'revenue', 'debuglogs',
  'tenantinspector', 'failedpayments', 'supportqueue', 'slowqueries', 'schemadiff', 'cohort',
];

/** GET /api/v1/admin/team/members — public roster for the login page */
router.get('/members', async (_req: Request, res: Response): Promise<void> => {
  const members = await getMemberPublicList();
  res.json({ success: true, data: members });
});

/** GET /api/v1/admin/team/members/all — full roster (master admin only, includes inactive) */
router.get('/members/all', async (req: Request, res: Response): Promise<void> => {
  if (!isMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'Master admin credentials required.' });
    return;
  }
  const members = await getAllMembersAdmin();
  res.json({ success: true, data: members });
});

/** POST /api/v1/admin/team/members — create a new team member (master admin only) */
router.post('/members', async (req: Request, res: Response): Promise<void> => {
  if (!isMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'Master admin credentials required.' });
    return;
  }

  const { id, name, role, color, assignedTabs } = req.body as {
    id?: string; name?: string; role?: string; color?: string; assignedTabs?: unknown;
  };

  if (!id || typeof id !== 'string' || !/^[a-z0-9_-]{2,40}$/.test(id)) {
    res.status(400).json({ success: false, error: 'id must be a lowercase alphanumeric slug (2–40 chars).' });
    return;
  }
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ success: false, error: 'name is required (min 2 chars).' });
    return;
  }
  if (!role || typeof role !== 'string' || role.trim().length < 2) {
    res.status(400).json({ success: false, error: 'role is required (min 2 chars).' });
    return;
  }
  if (color && !VALID_COLORS.includes(color)) {
    res.status(400).json({ success: false, error: `color must be one of: ${VALID_COLORS.join(', ')}.` });
    return;
  }
  if (!Array.isArray(assignedTabs) || !assignedTabs.every((t) => VALID_TABS.includes(t as AdminTab))) {
    res.status(400).json({ success: false, error: 'assignedTabs must be an array of valid tab IDs.' });
    return;
  }

  try {
    const member = await createTeamMember({
      id: id.trim(),
      name: name.trim(),
      role: role.trim(),
      color: (color ?? 'slate'),
      assignedTabs: assignedTabs as AdminTab[],
    });
    res.status(201).json({ success: true, data: member, message: 'Member created. Default PIN is 0000.' });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ success: false, error: 'A member with that id already exists.' });
    } else {
      throw err;
    }
  }
});

/** PATCH /api/v1/admin/team/members/:id — update name/role/color/tabs/isActive (master admin only) */
router.patch('/members/:id', async (req: Request, res: Response): Promise<void> => {
  if (!isMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'Master admin credentials required.' });
    return;
  }

  const { name, role, color, assignedTabs, isActive } = req.body as {
    name?: string; role?: string; color?: string; assignedTabs?: unknown; isActive?: unknown;
  };

  if (color !== undefined && !VALID_COLORS.includes(color)) {
    res.status(400).json({ success: false, error: `color must be one of: ${VALID_COLORS.join(', ')}.` });
    return;
  }
  if (assignedTabs !== undefined && (!Array.isArray(assignedTabs) || !assignedTabs.every((t) => VALID_TABS.includes(t as AdminTab)))) {
    res.status(400).json({ success: false, error: 'assignedTabs must be an array of valid tab IDs.' });
    return;
  }

  const updated = await updateTeamMember(req.params.id, {
    ...(name !== undefined && { name: name.trim() }),
    ...(role !== undefined && { role: role.trim() }),
    ...(color !== undefined && { color }),
    ...(assignedTabs !== undefined && { assignedTabs: assignedTabs as AdminTab[] }),
    ...(isActive !== undefined && { isActive: Boolean(isActive) }),
  });

  if (!updated) {
    res.status(404).json({ success: false, error: 'Member not found.' });
    return;
  }
  res.json({ success: true, data: updated });
});

/** DELETE /api/v1/admin/team/members/:id — permanently remove a member (master admin only) */
router.delete('/members/:id', async (req: Request, res: Response): Promise<void> => {
  if (!isMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'Master admin credentials required.' });
    return;
  }
  const ok = await deleteTeamMember(req.params.id);
  if (!ok) {
    res.status(404).json({ success: false, error: 'Member not found.' });
    return;
  }
  res.json({ success: true, message: 'Member deleted.' });
});

/** POST /api/v1/admin/team/members/:id/reset-pin — reset a member's PIN to 0000 (master admin only) */
router.post('/members/:id/reset-pin', async (req: Request, res: Response): Promise<void> => {
  if (!isMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'Master admin credentials required.' });
    return;
  }
  const ok = await resetMemberPin(req.params.id);
  if (!ok) {
    res.status(404).json({ success: false, error: 'Member not found.' });
    return;
  }
  res.json({ success: true, message: 'PIN reset to 0000.' });
});

/** POST /api/v1/admin/team/login — authenticate a team member */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { memberId, pin } = req.body as { memberId?: string; pin?: string };
  if (!memberId || !pin) {
    res.status(400).json({ success: false, error: 'memberId and pin are required.' });
    return;
  }
  if (typeof pin !== 'string' || pin.length < 4 || pin.length > 16) {
    res.status(400).json({ success: false, error: 'Invalid PIN format.' });
    return;
  }
  const member = await authenticateTeamMember(memberId, pin);
  if (!member) {
    res.status(401).json({ success: false, error: 'Invalid credentials.' });
    return;
  }
  const token = issueTeamToken(member);
  res.json({
    success: true,
    data: {
      token,
      member: {
        id: member.id,
        name: member.name,
        role: member.role,
        color: member.color,
        assignedTabs: member.assignedTabs,
      },
    },
  });
});

/** POST /api/v1/admin/team/change-pin — member changes their own PIN */
router.post('/change-pin', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers['x-team-token'] as string | undefined;
  if (!authHeader) {
    res.status(401).json({ success: false, error: 'Missing x-team-token header.' });
    return;
  }
  const payload = verifyTeamToken(authHeader);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired team token.' });
    return;
  }
  const { newPin } = req.body as { newPin?: string };
  if (!newPin || typeof newPin !== 'string' || newPin.length < 4 || newPin.length > 16) {
    res.status(400).json({ success: false, error: 'newPin must be 4–16 characters.' });
    return;
  }
  await updateMemberPin(payload.sub, newPin);
  res.json({ success: true, message: 'PIN updated.' });
});

/** GET /api/v1/admin/team/verify — verify a team token */
router.get('/verify', (req: Request, res: Response): void => {
  const token = req.headers['x-team-token'] as string | undefined;
  if (!token) {
    res.status(401).json({ success: false, error: 'Missing x-team-token header.' });
    return;
  }
  const payload = verifyTeamToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired team token.' });
    return;
  }
  res.json({ success: true, data: payload });
});

export default router;
