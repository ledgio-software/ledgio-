import { Router, Request, Response } from 'express';
import {
  getMemberPublicList,
  authenticateTeamMember,
  updateMemberPin,
  issueTeamToken,
  verifyTeamToken,
} from '../services/teamMemberService';

const router = Router();

/** GET /api/v1/admin/team/members — public roster (no pins) */
router.get('/members', async (_req: Request, res: Response): Promise<void> => {
  const members = await getMemberPublicList();
  res.json({ success: true, data: members });
});

/** POST /api/v1/admin/team/login — authenticate a team member and issue a scoped token */
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

/** POST /api/v1/admin/team/change-pin — member changes their own PIN using current token */
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

/** GET /api/v1/admin/team/verify — verify a team token and return the payload */
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
