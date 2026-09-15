import cron, { ScheduledTask } from 'node-cron';
import { wrapCronTick } from './cronJobRegistry';
import { prisma } from '../config/db';
import { invalidateTenantCacheById } from '../cache/tenantCache';
import { EmailService } from './EmailService';
import * as paystackService from './paystackService';

/**
 * Daily sweep that automatically renews subscriptions by charging the
 * saved Paystack authorization (card or MoMo) for tenants whose plan
 * expires within the next 24 hours (or is already in GRACE).
 *
 * On success: subscription is extended by 30 days and a confirmation email
 * is sent to the tenant admin.
 * On failure: a failure notification email is sent so the tenant can pay
 * manually before losing access.
 */
export class SubscriptionAutoRenewCronService {
  private static task: ScheduledTask | null = null;

  public static init(): void {
    if (this.task) return;

    // 6:30 AM UTC — runs before the dunning sweep (9 AM) and keep-alive (*/10)
    this.task = cron.schedule('30 6 * * *', wrapCronTick('Subscription Auto-Renew', async () => {
      console.log('[AutoRenewCron] Starting daily subscription auto-renewal sweep...');
      await this.processAutoRenewals();
    }));

    console.log('[AutoRenewCron] Subscription Auto-Renew Cron Initialized.');
  }

  public static async processAutoRenewals(): Promise<void> {
    if (!paystackService.isPaystackConfigured()) {
      console.log('[AutoRenewCron] Paystack not configured — skipping.');
      return;
    }

    const now = new Date();
    // Charge tenants whose subscription expires within 24 hours, or is already
    // in GRACE (subscriptionPaidUntil passed but within the 7-day grace window).
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const candidates = await prisma.tenant.findMany({
      where: {
        autoRenewEnabled: true,
        paystackAuthCode: { not: null },
        OR: [
          // Active plan expiring within 24 h
          { subscriptionStatus: 'ACTIVE', subscriptionPaidUntil: { lte: cutoff } },
          // Already in grace period
          { subscriptionStatus: 'GRACE' },
        ],
      },
      select: {
        id: true,
        name: true,
        tier: true,
        paystackAuthCode: true,
        paystackAuthSummary: true,
        subscriptionPaidUntil: true,
        users: {
          where: { role: 'Admin' },
          select: { email: true, name: true },
          take: 1,
        },
      },
    });

    console.log(`[AutoRenewCron] Found ${candidates.length} tenant(s) eligible for auto-renewal.`);

    const SUBSCRIPTION_PRICES: Record<number, number> = { 1: 105, 2: 305, 3: 510 };
    const PLAN_NAMES: Record<number, string> = { 1: 'Shop', 2: 'Business', 3: 'Enterprise' };

    for (const tenant of candidates) {
      const admin = tenant.users[0];
      if (!admin?.email) {
        console.warn(`[AutoRenewCron] Tenant ${tenant.id} has no admin email — skipping.`);
        continue;
      }

      const amount = SUBSCRIPTION_PRICES[tenant.tier] ?? 105;
      const planName = PLAN_NAMES[tenant.tier] ?? 'Shop';
      const reference = `autorenew_${tenant.id}_${tenant.tier}_${Date.now()}`;

      try {
        const result = await paystackService.chargeAuthorization({
          email: admin.email,
          amount,
          authorizationCode: tenant.paystackAuthCode!,
          currency: 'GHS',
          reference,
        });

        if (result.status !== 'success') {
          throw new Error(`Charge status: ${result.status}. ${result.gatewayResponse ?? ''}`);
        }

        const newPaidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Refresh the auth code in case Paystack rotated it
        const authUpdate = result.authorization
          ? {
              paystackAuthCode: result.authorization.authCode,
              paystackAuthChannel: result.authorization.channel,
              paystackAuthSummary: result.authorization.summary,
            }
          : {};

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionPaidUntil: newPaidUntil,
            ...authUpdate,
          },
        });

        await invalidateTenantCacheById(tenant.id);

        console.log(`[AutoRenewCron] Renewed ${tenant.name} (${planName}) until ${newPaidUntil.toISOString()}`);

        if (EmailService.isConfigured()) {
          await EmailService.sendMail(
            admin.email,
            `Ledgio — ${planName} plan renewed`,
            `<p>Hi ${admin.name || 'Admin'},</p>
<p>Your <strong>${planName}</strong> plan for <strong>${tenant.name}</strong> has been automatically renewed for another 30 days.</p>
<p><strong>Amount charged:</strong> GHS ${amount.toFixed(2)}<br/>
<strong>Payment method:</strong> ${result.authorization?.summary ?? tenant.paystackAuthSummary ?? 'Saved card/MoMo'}<br/>
<strong>Renewed until:</strong> ${newPaidUntil.toLocaleDateString('en-GB')}</p>
<p>To manage your subscription or turn off auto-renewal, go to <strong>Settings → Subscription</strong> in your Ledgio workspace.</p>
<p>Thank you for using Ledgio.</p>`,
          ).catch((e: any) => console.error(`[AutoRenewCron] Confirmation email failed for ${tenant.id}:`, e));
        }
      } catch (err: any) {
        console.error(`[AutoRenewCron] Auto-renewal failed for tenant ${tenant.id}:`, err.message);

        if (EmailService.isConfigured()) {
          await EmailService.sendMail(
            admin.email,
            `Action required — Ledgio ${planName} plan renewal failed`,
            `<p>Hi ${admin.name || 'Admin'},</p>
<p>We were unable to automatically renew your <strong>${planName}</strong> plan for <strong>${tenant.name}</strong>.</p>
<p><strong>Reason:</strong> ${err.message}</p>
<p>To avoid losing access to your workspace, please renew your subscription manually:</p>
<ol>
  <li>Log in to your Ledgio workspace</li>
  <li>Go to <strong>Settings → Subscription</strong></li>
  <li>Click <strong>Pay GHS ${amount}/month</strong> and complete payment</li>
</ol>
<p>If you need help, email us at <a href="mailto:ledgioapp@gmail.com">ledgioapp@gmail.com</a>.</p>`,
          ).catch((e: any) => console.error(`[AutoRenewCron] Failure email error for ${tenant.id}:`, e));
        }
      }
    }

    console.log('[AutoRenewCron] Auto-renewal sweep complete.');
  }

  public static stop(): void {
    this.task?.stop();
    this.task = null;
  }
}
