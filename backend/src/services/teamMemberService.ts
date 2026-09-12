/**
 * AGOD Software Solutions — team member access service.
 *
 * Stores the 8-member roster with bcrypt-hashed PINs and tab assignments.
 * Issues short-lived HS256 tokens scoped to the member's allowed tabs.
 * Uses the same BROADCAST_MASTER_SECRET as the master admin session.
 */

import crypto from 'crypto';

const TEAM_TOKEN_TTL = 8 * 60 * 60; // 8 hours

export type AdminTab =
  | 'broadcast' | 'health' | 'performance' | 'jobs' | 'integrations'
  | 'schemas' | 'audit' | 'onboard' | 'feedback' | 'analytics' | 'errors'
  | 'safety' | 'referral' | 'clienthealth' | 'churnrisk' | 'onboarding'
  | 'revenue' | 'debuglogs';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;       // tailwind color name for avatar
  assignedTabs: AdminTab[];
  pinHash: string;
}

// PINs are set to a temporary default "0000" (hashed below).
// Change each member's PIN via the admin console team settings once deployed.
const ROSTER: Omit<TeamMember, 'pinHash'>[] = [
  {
    id: 'michael',
    name: 'Michael',
    role: 'Frontend Engineer I',
    color: 'blue',
    assignedTabs: ['performance', 'debuglogs'],
  },
  {
    id: 'anthony',
    name: 'Anthony',
    role: 'Frontend Engineer II',
    color: 'cyan',
    assignedTabs: ['debuglogs', 'feedback', 'safety'],
  },
  {
    id: 'kingsley',
    name: 'Kingsley',
    role: 'Backend Engineer',
    color: 'emerald',
    assignedTabs: ['jobs', 'errors', 'debuglogs', 'schemas'],
  },
  {
    id: 'sandra',
    name: 'Sandra',
    role: 'Sales Executive',
    color: 'rose',
    assignedTabs: ['revenue', 'referral', 'analytics'],
  },
  {
    id: 'innocent',
    name: 'Innocent',
    role: 'AI Engineer',
    color: 'violet',
    assignedTabs: ['safety', 'integrations', 'performance'],
  },
  {
    id: 'george',
    name: 'George',
    role: 'Researcher',
    color: 'amber',
    assignedTabs: ['analytics', 'feedback', 'churnrisk', 'onboarding'],
  },
  {
    id: 'daniel',
    name: 'Daniel',
    role: 'Finance & Lead Architect',
    color: 'indigo',
    assignedTabs: [
      'revenue', 'analytics', 'clienthealth', 'churnrisk',
      'performance', 'errors', 'debuglogs', 'jobs', 'integrations',
    ],
  },
  {
    id: 'pm',
    name: 'Project Manager',
    role: 'Project Manager',
    color: 'slate',
    assignedTabs: [
      'broadcast', 'audit', 'clienthealth', 'churnrisk',
      'onboarding', 'analytics', 'feedback', 'revenue',
      'performance', 'health', 'jobs', 'integrations',
      'schemas', 'onboard', 'errors', 'safety', 'referral', 'debuglogs',
    ],
  },
];

const DEFAULT_PIN = '0000';

function scryptHash(pin: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, 32, (err, derived) => {
      if (err) reject(err);
      else resolve(`${salt}:${derived.toString('hex')}`);
    });
  });
}

function scryptVerify(pin: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, 32, (err, derived) => {
      if (err) reject(err);
      else {
        try {
          const expected = Buffer.from(hash, 'hex');
          resolve(expected.length === derived.length && crypto.timingSafeEqual(expected, derived));
        } catch {
          resolve(false);
        }
      }
    });
  });
}

let _members: TeamMember[] | null = null;

async function getMembers(): Promise<TeamMember[]> {
  if (_members) return _members;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptHash(DEFAULT_PIN, salt);
  _members = ROSTER.map((m) => ({ ...m, pinHash: hash }));
  return _members;
}

const _pinOverrides = new Map<string, string>();

export async function getMemberPublicList(): Promise<Omit<TeamMember, 'pinHash'>[]> {
  const members = await getMembers();
  return members.map(({ pinHash: _p, ...rest }) => rest);
}

export async function authenticateTeamMember(
  memberId: string,
  pin: string,
): Promise<TeamMember | null> {
  const members = await getMembers();
  const member = members.find((m) => m.id === memberId);
  if (!member) return null;

  const hash = _pinOverrides.get(memberId) ?? member.pinHash;
  const ok = await scryptVerify(pin, hash);
  return ok ? member : null;
}

export async function updateMemberPin(memberId: string, newPin: string): Promise<boolean> {
  const members = await getMembers();
  if (!members.find((m) => m.id === memberId)) return false;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptHash(newPin, salt);
  _pinOverrides.set(memberId, hash);
  return true;
}

// Token helpers — same HS256 pattern as adminTotpService
function b64url(input: Buffer | string): string {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getSecret(): string {
  const s = process.env.BROADCAST_MASTER_SECRET;
  if (!s) throw new Error('BROADCAST_MASTER_SECRET not set');
  return `team:${s}`;
}

export function issueTeamToken(member: TeamMember): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: member.id,
      name: member.name,
      role: member.role,
      tabs: member.assignedTabs,
      iat: now,
      exp: now + TEAM_TOKEN_TTL,
    }),
  );
  const sig = b64url(
    crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${sig}`;
}

export interface TeamTokenPayload {
  sub: string;
  name: string;
  role: string;
  tabs: AdminTab[];
  iat: number;
  exp: number;
}

export function verifyTeamToken(token: string): TeamTokenPayload | null {
  try {
    const secret = getSecret();
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, sig] = parts;
    const expected = b64url(
      crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest(),
    );

    const sigBuf = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const expBuf = Buffer.from(expected.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const decoded: TeamTokenPayload = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );

    if (Math.floor(Date.now() / 1000) > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}
