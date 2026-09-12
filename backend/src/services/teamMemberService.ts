/**
 * AGOD Software Solutions — team member access service.
 *
 * Stores team members in the `team_members` DB table (Prisma).
 * On first use, seeds the table with the initial 8-member roster if empty.
 * Issues short-lived HS256 tokens scoped to the member's allowed tabs.
 */

import crypto from 'crypto';
import { prisma } from '../config/db';

const TEAM_TOKEN_TTL = 8 * 60 * 60; // 8 hours

export type AdminTab =
  | 'broadcast' | 'health' | 'performance' | 'jobs' | 'integrations'
  | 'schemas' | 'audit' | 'onboard' | 'feedback' | 'analytics' | 'errors'
  | 'safety' | 'referral' | 'clienthealth' | 'churnrisk' | 'onboarding'
  | 'revenue' | 'debuglogs'
  | 'tenantinspector' | 'failedpayments' | 'supportqueue' | 'slowqueries' | 'schemadiff' | 'cohort';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  assignedTabs: AdminTab[];
  pinHash: string;
  isActive: boolean;
}

const DEFAULT_PIN = '0000';

const INITIAL_ROSTER: Omit<TeamMember, 'pinHash' | 'isActive'>[] = [
  { id: 'michael',  name: 'Michael',         role: 'Frontend Engineer I',       color: 'blue',   assignedTabs: ['performance', 'debuglogs'] },
  { id: 'anthony',  name: 'Anthony',          role: 'Frontend Engineer II',      color: 'cyan',   assignedTabs: ['debuglogs', 'feedback', 'safety'] },
  { id: 'kingsley', name: 'Kingsley',         role: 'Backend Engineer',          color: 'emerald', assignedTabs: ['jobs', 'errors', 'debuglogs', 'schemas', 'slowqueries', 'schemadiff'] },
  { id: 'sandra',   name: 'Sandra',           role: 'Sales Executive',           color: 'rose',   assignedTabs: ['revenue', 'referral', 'analytics', 'tenantinspector', 'failedpayments', 'cohort', 'supportqueue'] },
  { id: 'innocent', name: 'Innocent',         role: 'AI Engineer',               color: 'violet', assignedTabs: ['safety', 'integrations', 'performance'] },
  { id: 'george',   name: 'George',           role: 'Researcher',                color: 'amber',  assignedTabs: ['analytics', 'feedback', 'churnrisk', 'onboarding', 'cohort', 'tenantinspector'] },
  { id: 'daniel',   name: 'Daniel',           role: 'Finance & Lead Architect',  color: 'indigo', assignedTabs: ['revenue', 'analytics', 'clienthealth', 'churnrisk', 'performance', 'errors', 'debuglogs', 'jobs', 'integrations', 'failedpayments', 'slowqueries', 'schemadiff'] },
  {
    id: 'pm', name: 'Project Manager', role: 'Project Manager', color: 'slate',
    assignedTabs: [
      'broadcast', 'audit', 'clienthealth', 'churnrisk', 'onboarding', 'analytics',
      'feedback', 'revenue', 'performance', 'health', 'jobs', 'integrations',
      'schemas', 'onboard', 'errors', 'safety', 'referral', 'debuglogs',
      'tenantinspector', 'failedpayments', 'supportqueue', 'slowqueries', 'schemadiff', 'cohort',
    ],
  },
];

// ── scrypt helpers ────────────────────────────────────────────────────────────

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

// ── DB row → domain object ────────────────────────────────────────────────────

function rowToMember(row: {
  id: string; name: string; role: string; color: string;
  assigned_tabs?: string[]; assignedTabs?: string[];
  pin_hash?: string; pinHash?: string;
  is_active?: boolean; isActive?: boolean;
}): TeamMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    color: row.color,
    assignedTabs: ((row.assigned_tabs ?? (row as any).assignedTabs ?? []) as string[]) as AdminTab[],
    pinHash: (row.pin_hash ?? (row as any).pinHash ?? ''),
    isActive: row.is_active ?? (row as any).isActive ?? true,
  };
}

// ── Seed on first use ─────────────────────────────────────────────────────────

let _seeded = false;

async function ensureSeeded(): Promise<void> {
  if (_seeded) return;
  try {
    const count = await prisma.teamMember.count();
    if (count === 0) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await scryptHash(DEFAULT_PIN, salt);
      await prisma.teamMember.createMany({
        data: INITIAL_ROSTER.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          color: m.color,
          assignedTabs: m.assignedTabs as string[],
          pinHash: hash,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }
    _seeded = true;
  } catch (err) {
    // Table may not exist yet (migration pending); non-fatal — callers fall back to INITIAL_ROSTER
    console.warn('[teamMemberService] ensureSeeded failed (table may not exist yet):', (err as Error).message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getMemberPublicList(): Promise<Omit<TeamMember, 'pinHash'>[]> {
  await ensureSeeded();
  try {
    const rows = await prisma.teamMember.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => {
      const m = rowToMember(r as any);
      const { pinHash: _p, ...rest } = m;
      return rest;
    });
  } catch {
    // DB unavailable or table missing — return the static roster so the login page still works
    return INITIAL_ROSTER.map(({ id, name, role, color, assignedTabs }) => ({
      id, name, role, color, assignedTabs, isActive: true,
    }));
  }
}

export async function getAllMembersAdmin(): Promise<Omit<TeamMember, 'pinHash'>[]> {
  await ensureSeeded();
  const rows = await prisma.teamMember.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map((r) => {
    const m = rowToMember(r as any);
    const { pinHash: _p, ...rest } = m;
    return rest;
  });
}

export async function authenticateTeamMember(memberId: string, pin: string): Promise<TeamMember | null> {
  await ensureSeeded();
  const row = await prisma.teamMember.findFirst({ where: { id: memberId, isActive: true } });
  if (!row) return null;
  const m = rowToMember(row as any);
  const ok = await scryptVerify(pin, m.pinHash);
  return ok ? m : null;
}

export async function updateMemberPin(memberId: string, newPin: string): Promise<boolean> {
  await ensureSeeded();
  const row = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!row) return false;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptHash(newPin, salt);
  await prisma.teamMember.update({ where: { id: memberId }, data: { pinHash: hash } });
  return true;
}

export async function createTeamMember(data: {
  id: string; name: string; role: string; color: string; assignedTabs: AdminTab[];
}): Promise<Omit<TeamMember, 'pinHash'>> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptHash(DEFAULT_PIN, salt);
  const row = await prisma.teamMember.create({
    data: {
      id: data.id,
      name: data.name,
      role: data.role,
      color: data.color,
      assignedTabs: data.assignedTabs as string[],
      pinHash: hash,
    },
  });
  const m = rowToMember(row as any);
  const { pinHash: _p, ...rest } = m;
  return rest;
}

export async function updateTeamMember(
  memberId: string,
  data: Partial<{ name: string; role: string; color: string; assignedTabs: AdminTab[]; isActive: boolean }>,
): Promise<Omit<TeamMember, 'pinHash'> | null> {
  const existing = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!existing) return null;
  const row = await prisma.teamMember.update({
    where: { id: memberId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.assignedTabs !== undefined && { assignedTabs: data.assignedTabs as string[] }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
  const m = rowToMember(row as any);
  const { pinHash: _p, ...rest } = m;
  return rest;
}

export async function deleteTeamMember(memberId: string): Promise<boolean> {
  const existing = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!existing) return false;
  await prisma.teamMember.delete({ where: { id: memberId } });
  return true;
}

export async function resetMemberPin(memberId: string): Promise<boolean> {
  const existing = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!existing) return false;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptHash(DEFAULT_PIN, salt);
  await prisma.teamMember.update({ where: { id: memberId }, data: { pinHash: hash } });
  return true;
}

// ── Token helpers (HS256) ─────────────────────────────────────────────────────

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
  const payload = b64url(JSON.stringify({
    sub: member.id,
    name: member.name,
    role: member.role,
    tabs: member.assignedTabs,
    iat: now,
    exp: now + TEAM_TOKEN_TTL,
  }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

export interface TeamTokenPayload {
  sub: string; name: string; role: string; tabs: AdminTab[]; iat: number; exp: number;
}

export function verifyTeamToken(token: string): TeamTokenPayload | null {
  try {
    const secret = getSecret();
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expected = b64url(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest());
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
