/**
 * Creates the Hapa Solutions demo account.
 * Run from the backend directory:
 *   npx ts-node --require tsconfig-paths/register scripts/createDemoAccount.ts
 *
 * The account is created with:
 *  - Email pre-verified (no verification email sent)
 *  - MFA disabled
 *  - Role: Owner
 *  - Tier 3 (full feature access for demo purposes)
 */

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Credentials ──────────────────────────────────────────────────────────────
// Set DEMO_PASSWORD in your environment before running, e.g.:
//   DEMO_PASSWORD="YourChoice123!" npx ts-node ...
const DEMO_EMAIL    = 'demo@hapasolutions.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const DEMO_NAME     = 'Hapa Solutions Demo';
const TENANT_NAME   = 'Hapa Solutions';
const TENANT_SLUG   = 'hapa-solutions-demo';
const TENANT_SCHEMA = 'hapa_solutions_demo';
// ─────────────────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  const iterations = 100000;
  const saltLength = 16;
  const keyLength  = 64;
  const digest     = 'sha512';
  const salt       = crypto.randomBytes(saltLength).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);
  return `$pbkdf2$${iterations}$${salt}$${derivedKey.toString('hex')}`;
}

async function main() {
  if (!DEMO_PASSWORD) {
    console.error('❌  Set DEMO_PASSWORD in your environment before running.\n   Example: DEMO_PASSWORD="YourChoice123!" npx ts-node --require tsconfig-paths/register scripts/createDemoAccount.ts');
    process.exit(1);
  }

  console.log('Creating Hapa Solutions demo account...\n');

  // 1. Check if tenant already exists
  const existing = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (existing) {
    console.log(`⚠️  Tenant "${TENANT_SLUG}" already exists (id: ${existing.id}). Skipping tenant creation.`);
  }

  const tenant = existing ?? await prisma.tenant.create({
    data: {
      name:         TENANT_NAME,
      slug:         TENANT_SLUG,
      schema:       TENANT_SCHEMA,
      tier:         3,
      baseCurrency: 'GHS',
      orgType:      'BUSINESS',
    },
  });

  console.log(`✅ Tenant: ${tenant.name} (id: ${tenant.id})`);

  // 2. Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existingUser) {
    console.log(`⚠️  User "${DEMO_EMAIL}" already exists. Skipping user creation.`);
    console.log('\n── Demo credentials ─────────────────────────');
    console.log(`   Email:    ${DEMO_EMAIL}`);
    console.log(`   Password: ${DEMO_PASSWORD}`);
    console.log('─────────────────────────────────────────────\n');
    return;
  }

  const user = await prisma.user.create({
    data: {
      email:           DEMO_EMAIL,
      password:        hashPassword(DEMO_PASSWORD as string),
      name:            DEMO_NAME,
      role:            'Owner',
      tenantId:        tenant.id,
      isActive:        true,
      isEmailVerified: true,   // skip email verification gate
      isPhoneVerified: false,
      isMfaEnabled:    false,
    },
  });

  console.log(`✅ User:   ${user.name} <${user.email}> (role: ${user.role})`);
  console.log('\n── Demo credentials ─────────────────────────');
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD as string}`);
  console.log('─────────────────────────────────────────────');
  console.log('\nShare these with Hapa Solutions. They can change the password after first login.\n');
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
