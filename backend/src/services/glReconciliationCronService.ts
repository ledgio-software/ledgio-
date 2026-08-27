import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { runWithTenantContext, TenantContextData } from '../context/tenantContext';
import { recordAuditLog } from './auditLogService';
import { EmailService } from './EmailService';

const TOLERANCE = 0.01; // GHS 0.01 tolerance for floating-point rounding

/**
 * Daily cron (2:30 AM) that reconciles the Accounts Receivable and Accounts
 * Payable subledger balances against the corresponding GL control account
 * balances for every tenant. Discrepancies > GHS 0.01 are written to the
 * audit log and emailed to the tenant's Admin user(s).
 */
export class GlReconciliationCronService {
  private static task: ScheduledTask | null = null;

  public static init(): void {
    if (this.task) return;

    this.task = cron.schedule('30 2 * * *', async () => {
      console.log('[GlReconCron] Running daily GL vs subledger reconciliation...');
      await this.runJob();
    });

    console.log('[GlReconCron] Daily GL Reconciliation Cron Initialized.');
  }

  public static async runJob(): Promise<void> {
    let tenants: any[];
    try {
      tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true, schema: true } });
    } catch (err: any) {
      console.error('[GlReconCron] Failed to fetch tenants:', err.message);
      return;
    }

    for (const tenant of tenants) {
      try {
        const ctx: TenantContextData = { tenantId: tenant.id, tenantSchema: tenant.schema, tenantName: tenant.name, tenantSlug: tenant.slug };
        await runWithTenantContext(ctx, () => this.reconcileTenant(tenant));
      } catch (err: any) {
        console.error(`[GlReconCron] Error reconciling tenant ${tenant.slug}:`, err.message);
      }
    }
  }

  private static async reconcileTenant(tenant: { id: string; slug: string; name: string }): Promise<void> {
    await withCurrentTenantDb(prisma, async (client: any) => {
      // ── AR reconciliation ─────────────────────────────────────────────────
      // Subledger: sum of (total - amountPaid) on open invoices
      const arSubledger: { balance: string }[] = await client.$queryRawUnsafe(
        `SELECT COALESCE(SUM(total - amount_paid), 0)::TEXT AS balance
         FROM invoices
         WHERE tenant_id = $1 AND status NOT IN ('PAID', 'VOID', 'CANCELLED')`,
        tenant.id
      );

      // GL control: net balance on the ACCOUNTS_RECEIVABLE account
      const arGl: { balance: string }[] = await client.$queryRawUnsafe(
        `SELECT COALESCE(SUM(
           CASE WHEN jel.type = 'DEBIT' THEN jel.amount ELSE -jel.amount END
         ), 0)::TEXT AS balance
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.journal_entry_id
         JOIN accounts a ON a.id = jel.account_id
         WHERE jel.tenant_id = $1
           AND je.status = 'POSTED'
           AND a.default_role = 'ACCOUNTS_RECEIVABLE'`,
        tenant.id
      );

      const arSubBal = parseFloat(arSubledger[0]?.balance ?? '0');
      const arGlBal = parseFloat(arGl[0]?.balance ?? '0');
      const arDiff = Math.abs(arSubBal - arGlBal);

      if (arDiff > TOLERANCE) {
        await this.reportDiscrepancy(tenant, 'AR', arSubBal, arGlBal, arDiff, client);
      }

      // ── AP reconciliation ─────────────────────────────────────────────────
      // Subledger: sum of (total - amountPaid) on outstanding vendor bills
      const apSubledger: { balance: string }[] = await client.$queryRawUnsafe(
        `SELECT COALESCE(SUM(total_amount - amount_paid), 0)::TEXT AS balance
         FROM bills
         WHERE tenant_id = $1 AND status NOT IN ('PAID', 'VOID', 'CANCELLED')`,
        tenant.id
      );

      const apGl: { balance: string }[] = await client.$queryRawUnsafe(
        `SELECT COALESCE(SUM(
           CASE WHEN jel.type = 'CREDIT' THEN jel.amount ELSE -jel.amount END
         ), 0)::TEXT AS balance
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.journal_entry_id
         JOIN accounts a ON a.id = jel.account_id
         WHERE jel.tenant_id = $1
           AND je.status = 'POSTED'
           AND a.default_role = 'ACCOUNTS_PAYABLE'`,
        tenant.id
      );

      const apSubBal = parseFloat(apSubledger[0]?.balance ?? '0');
      const apGlBal = parseFloat(apGl[0]?.balance ?? '0');
      const apDiff = Math.abs(apSubBal - apGlBal);

      if (apDiff > TOLERANCE) {
        await this.reportDiscrepancy(tenant, 'AP', apSubBal, apGlBal, apDiff, client);
      }
    });
  }

  private static async reportDiscrepancy(
    tenant: { id: string; name: string },
    type: 'AR' | 'AP',
    subledgerBal: number,
    glBal: number,
    diff: number,
    client: any
  ): Promise<void> {
    const label = type === 'AR' ? 'Accounts Receivable' : 'Accounts Payable';
    const details = `${label} discrepancy: subledger=${subledgerBal.toFixed(2)}, GL=${glBal.toFixed(2)}, diff=${diff.toFixed(2)}`;

    console.warn(`[GlReconCron] ${tenant.name}: ${details}`);

    await recordAuditLog({
      action: `GL_RECON.${type}_DISCREPANCY`,
      entity: 'GlReconciliation',
      entityId: tenant.id,
      tenantId: tenant.id,
      details,
    });

    // Notify Admin users
    try {
      const admins = await client.user.findMany({
        where: { tenantId: tenant.id, role: 'Admin', isActive: true },
        select: { email: true, name: true },
      });

      for (const admin of admins) {
        await EmailService.sendMail(
          admin.email,
          `[${tenant.name}] ${label} Reconciliation Discrepancy Detected`,
          `<p>Hi ${admin.name || 'Admin'},</p>
            <p>The daily GL reconciliation job detected a discrepancy in <strong>${label}</strong> for <strong>${tenant.name}</strong>:</p>
            <ul>
              <li>Subledger balance: <strong>${subledgerBal.toFixed(2)}</strong></li>
              <li>GL control account balance: <strong>${glBal.toFixed(2)}</strong></li>
              <li>Difference: <strong>${diff.toFixed(2)}</strong></li>
            </ul>
            <p>Please review the ${label} ledger and reconcile the difference. This has been logged in the Audit Trail.</p>`
        );
      }
    } catch (emailErr: any) {
      console.error(`[GlReconCron] Failed to send discrepancy email for ${tenant.name}:`, emailErr.message);
    }
  }
}
