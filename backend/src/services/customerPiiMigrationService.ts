import { prisma } from '../config/db';
import { encryptCredential } from '../utils/credentialEncryption';

/** Returns true if a string looks like our ciphertext format ivHex:authTagHex:ciphertextHex. */
function isEncrypted(value: string | null): boolean {
  return value != null && value.split(':').length === 3;
}

/**
 * One-time idempotent backfill: encrypts email, phone, and tin for any customer
 * row whose email is still plaintext. Runs at server start after DB connect.
 */
export async function migrateCustomerPii(): Promise<void> {
  const customers = await prisma.customer.findMany({
    select: { id: true, email: true, phone: true, tin: true },
  });

  let migrated = 0;
  for (const c of customers) {
    if (isEncrypted(c.email)) continue;
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        email: encryptCredential(c.email),
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
