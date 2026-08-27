import { prisma } from '../config/db';
import { encryptCredential } from '../utils/credentialEncryption';

/** Returns true if a string looks like our ciphertext format ivHex:authTagHex:ciphertextHex. */
function isEncrypted(value: string | null): boolean {
  return value != null && value.split(':').length === 3;
}

/**
 * One-time idempotent backfill: encrypts email, phone, and tin for any customer
 * row whose email is still plaintext. Runs at server start after DB connect.
 *
 * Uses a SQL filter so only unencrypted rows are fetched — when all customers are
 * already encrypted the query returns 0 rows immediately, avoiding a full-table scan.
 * Ciphertext format is "ivHex:authTagHex:ciphertextHex" (always has 2 colons);
 * plaintext emails contain "@" but never two colons.
 */
export async function migrateCustomerPii(): Promise<void> {
  const unencrypted = await prisma.$queryRaw<
    { id: string; email: string | null; phone: string | null; tin: string | null }[]
  >`SELECT id, email, phone, tin
    FROM customers
    WHERE email IS NULL
       OR email NOT LIKE '%:%:%'
    LIMIT 1000`;

  let migrated = 0;
  for (const c of unencrypted) {
    if (isEncrypted(c.email)) continue;
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        ...(c.email ? { email: encryptCredential(c.email) } : {}),
        phone: c.phone ? encryptCredential(c.phone) : null,
        tin: c.tin ? encryptCredential(c.tin) : null,
      },
    });
    migrated++;
  }

  if (migrated > 0) {
    console.log(`[CustomerPiiMigration] Encrypted PII for ${migrated} customer row(s).`);
  }
}
