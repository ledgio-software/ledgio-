/**
 * Creates the Hapa Solutions demo account.
 * Plain Node.js — no TypeScript or ts-node needed.
 *
 * Run from the backend directory (/app):
 *   DEMO_PASSWORD="YourChoice123!" node scripts/createDemoAccount.js
 */

'use strict';

const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEMO_EMAIL    = 'demo@hapasolutions.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const DEMO_NAME     = 'Hapa Solutions Demo';
const TENANT_NAME   = 'Hapa Solutions';
const TENANT_SLUG   = 'hapa-solutions-demo';
const TENANT_SCHEMA = 'hapa_solutions_demo';

function hashPassword(password) {
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
    console.error('❌  Set DEMO_PASSWORD before running.');
    console.error('    Example: DEMO_PASSWORD="YourChoice123!" node scripts/createDemoAccount.js');
    process.exit(1);
  }

  console.log('Creating Hapa Solutions demo account...\n');

  // 1. Tenant
  let tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (tenant) {
    console.log(`⚠️  Tenant "${TENANT_SLUG}" already exists (id: ${tenant.id}). Skipping tenant creation.`);
  } else {
    tenant = await prisma.tenant.create({
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
  }

  // 2. User
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existingUser) {
    console.log(`⚠️  User "${DEMO_EMAIL}" already exists. No changes made.`);
  } else {
    const user = await prisma.user.create({
      data: {
        email:           DEMO_EMAIL,
        password:        hashPassword(DEMO_PASSWORD),
        name:            DEMO_NAME,
        role:            'Owner',
        tenantId:        tenant.id,
        isActive:        true,
        isEmailVerified: true,
        isPhoneVerified: false,
        isMfaEnabled:    false,
      },
    });
    console.log(`✅ User: ${user.name} <${user.email}> (role: ${user.role})`);
  }

  console.log('\n── Demo credentials ─────────────────────────');
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log('─────────────────────────────────────────────');
  console.log('\nDone. Share these with Hapa Solutions.\n');
}

main()
  .catch((e) => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
