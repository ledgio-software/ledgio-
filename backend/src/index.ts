import { execSync } from 'child_process';
import app from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { connectRedis, disconnectRedis } from './config/redis';
import { startTelemetry, stopTelemetry } from './config/telemetry';
import { initSyncSocketServer } from './websocket/syncSocketServer';
import { initPresenceSocketServer } from './websocket/presenceSocketServer';
import { startQueue, stopQueue, scheduleJob } from './services/queueService';

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  // Guard: refuse to start if CORS is misconfigured in production.
  // An open wildcard or missing origin setting would let any website make
  // credentialed cross-origin requests against tenant data.
  if (process.env.NODE_ENV === 'production') {
    const corsOrigin = process.env.CORS_ALLOWED_ORIGINS || process.env.APP_URL || '';
    if (!corsOrigin || corsOrigin.trim() === '*') {
      console.error('[Server] FATAL: CORS_ALLOWED_ORIGINS must not be empty or "*" in production. Set it to your frontend origin (e.g. https://app.ledgio.com). Refusing to start.');
      process.exit(1);
    }
    if (!process.env.BROADCAST_MASTER_SECRET) {
      console.error('[Server] FATAL: BROADCAST_MASTER_SECRET is not set. Admin endpoints would be open without a passcode. Refusing to start.');
      process.exit(1);
    }
  }

  // Resolve a migration that rolled back due to DROP INDEX without IF EXISTS.
  // The repair migration below (20260912170000_repair_cash_sale_void_and_creator)
  // re-applies all changes idempotently, so we mark the original as applied to
  // prevent migrate deploy from retrying the unfixed SQL on every startup.
  try {
    execSync(
      'npx prisma migrate resolve --applied 20260731121052_add_cash_sale_void_and_creator',
      { stdio: 'pipe' },
    );
    console.log('[Server] Resolved rolled-back migration 20260731121052_add_cash_sale_void_and_creator.');
  } catch (_) {
    // Already applied or not found — both are fine; suppress the error.
  }

  // Resolve a migration that failed in production due to a transient DB error.
  // All statements in 20260915050000_add_ssnit_compliance use IF NOT EXISTS,
  // so marking it rolled-back lets migrate deploy safely re-run it idempotently.
  try {
    execSync(
      'npx prisma migrate resolve --rolled-back 20260915050000_add_ssnit_compliance',
      { stdio: 'pipe' },
    );
    console.log('[Server] Marked 20260915050000_add_ssnit_compliance as rolled-back for retry.');
  } catch (_) {
    // Already resolved or not in a failed state — suppress.
  }

  // Run pending DB migrations before accepting traffic
  try {
    console.log('[Server] Running pending DB migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('[Server] Migrations applied.');
  } catch (err) {
    console.error('[Server] prisma migrate deploy failed:', err);
    // Non-fatal: DB may already be up to date; startup continues
  }

  // Initialize telemetry first
  await startTelemetry();

  const server = app.listen(PORT, async () => {
    console.log(`[Server] Backend microservice running on port ${PORT}`);

    // Initialize database connection
    await connectDatabase();
    
    // Initialize Redis connection
    await connectRedis();

    // Initialize the local-first sync pilot's WebSocket push channel
    initSyncSocketServer(server);

    // Initialize live "who's online" presence tracking
    initPresenceSocketServer(server);

    // Start durable job queue (pg-boss persists schedules in PostgreSQL).
    await startQueue();

    const { ScheduledEmailCronService } = require('./services/scheduledEmailService');
    await scheduleJob('Scheduled Email Reports', '0 8 * * 1',
      async () => { await (ScheduledEmailCronService.sendScheduledReports?.() ?? Promise.resolve()); },
      'Weekly P&L email reports to tenant admins');

    const { RecurringTransactionCronService } = require('./services/recurringTransactionService');
    await scheduleJob('Recurring Transactions', '0 * * * *',
      async () => { await (RecurringTransactionCronService.processRecurringTransactions?.() ?? Promise.resolve()); },
      'Hourly recurring journal entry generation');

    const { FxRateCronService } = require('./services/fxRateCronService');
    await scheduleJob('FX Rate Refresh', '0 */6 * * *',
      async () => { await FxRateCronService.refreshRatesJob(); },
      'Refreshes live exchange rates every 6 hours');

    const { DunningReminderCronService } = require('./services/dunningReminderService');
    await scheduleJob('Dunning Reminders', '0 9 * * *',
      async () => { await (DunningReminderCronService.sendReminders?.() ?? Promise.resolve()); },
      'Daily overdue-invoice payment reminder emails');

    const { HelpAssistantMaintenanceCronService } = require('./services/helpAssistantMaintenanceCronService');
    await scheduleJob('Help Assistant Maintenance', '0 2 * * *',
      async () => { await (HelpAssistantMaintenanceCronService.runMaintenance?.() ?? Promise.resolve()); },
      'Daily pruning of old AI chat conversation logs');

    const { VendorPaymentSchedulingCronService } = require('./services/vendorPaymentSchedulingCronService');
    await scheduleJob('Vendor Payment Scheduling', '0 7 * * *',
      async () => { await (VendorPaymentSchedulingCronService.processScheduledPayments?.() ?? Promise.resolve()); },
      'Daily sweep for due scheduled vendor bill payments');

    const { RecurringInvoiceCronService } = require('./services/recurringInvoiceCronService');
    await scheduleJob('Recurring Invoices', '0 6 * * *',
      async () => { await (RecurringInvoiceCronService.generateRecurringInvoices?.() ?? Promise.resolve()); },
      'Daily recurring invoice generation');

    const { GraEvatCronService } = require('./services/graEvatCronService');
    await scheduleJob('GRA E-VAT Sync', '*/15 * * * *',
      async () => { await GraEvatCronService.runSync(); },
      '15-minute sweep to clear pending/failed GRA VSDC invoices within the 48-hour mandate window');

    const { SubscriptionAutoRenewCronService } = require('./services/subscriptionAutoRenewCronService');
    await scheduleJob('Subscription Auto-Renew', '30 6 * * *',
      async () => { await (SubscriptionAutoRenewCronService.processAutoRenewals?.() ?? Promise.resolve()); },
      'Daily auto-charge of saved card/MoMo before subscription expires');

    const { FixedAssetDepreciationCronService } = require('./services/fixedAssetDepreciationCronService');
    await scheduleJob('Fixed Asset Depreciation', '0 1 * * *',
      async () => { await (FixedAssetDepreciationCronService.runDepreciation?.() ?? Promise.resolve()); },
      'Daily fixed-asset depreciation journal posting');

    const { InterestChargeCronService } = require('./services/interestChargeCronService');
    await scheduleJob('Interest Charges', '0 0 * * *',
      async () => { await (InterestChargeCronService.processInterestCharges?.() ?? Promise.resolve()); },
      'Daily interest accrual on overdue invoices');

    const { OverdueInvoiceAlertCronService } = require('./services/overdueInvoiceAlertService');
    await scheduleJob('Overdue Invoice Alerts', '30 8 * * *',
      async () => { await (OverdueInvoiceAlertCronService.runAlertSweep?.() ?? Promise.resolve()); },
      'Daily in-app alerts when invoices cross 30/60/90-day overdue thresholds');

    const { GlReconciliationCronService } = require('./services/glReconciliationCronService');
    await scheduleJob('GL Reconciliation', '30 2 * * *',
      async () => { await GlReconciliationCronService.runJob(); },
      'Daily AR/AP subledger vs GL control account balance check');

    const { KeepAliveCronService } = require('./services/keepAliveCronService');
    await scheduleJob('Keep-Alive Ping', '*/10 * * * *',
      async () => { await KeepAliveCronService.ping(); },
      'Self-ping every 10 min to prevent Render cold starts');

    // Nightly intelligence worker: cash forecast, invoice risk, inventory demand, anomaly detection
    await scheduleJob(
      'Ledgio Intelligence Worker',
      '0 1 * * *',
      async () => {
        const { spawn } = require('child_process');
        await new Promise<void>((resolve, reject) => {
          const workerPath = require('path').resolve(__dirname, '../../ledgio-ai/worker/main.py');
          const proc = spawn('python', [workerPath, '--all'], {
            env: { ...process.env },
            stdio: 'inherit',
          });
          proc.on('close', (code: number) => {
            if (code === 0) resolve();
            else reject(new Error(`Intelligence worker exited with code ${code}`));
          });
          proc.on('error', reject);
        });
      },
      'Nightly AI insight computation: cash forecast, invoice risk, inventory demand, anomaly detection',
    );

    // Hourly behavioral telemetry: audit_logs → behavior_events (Phase 2 pipeline)
    await scheduleJob(
      'Behavioral Telemetry Collector',
      '0 * * * *',
      async () => {
        const { spawn } = require('child_process');
        await new Promise<void>((resolve, reject) => {
          const workerPath = require('path').resolve(__dirname, '../../ledgio-ai/worker/behavioral_telemetry.py');
          const proc = spawn('python', [workerPath], {
            env: { ...process.env },
            stdio: 'inherit',
          });
          proc.on('close', (code: number) => {
            if (code === 0) resolve();
            else reject(new Error(`Behavioral telemetry exited with code ${code}`));
          });
          proc.on('error', reject);
        });
      },
      'Hourly: transform audit_logs into behavior_events for all active tenants',
    );

    // Federated learning round (01:30 UTC, after intelligence worker): noised gradient aggregation
    await scheduleJob(
      'Federated Learning Round',
      '30 1 * * *',
      async () => {
        const { spawn } = require('child_process');
        await new Promise<void>((resolve, reject) => {
          const workerPath = require('path').resolve(__dirname, '../../ledgio-ai/worker/federated_round.py');
          const proc = spawn('python', [workerPath], {
            env: { ...process.env },
            stdio: 'inherit',
          });
          proc.on('close', (code: number) => {
            if (code === 0) resolve();
            else reject(new Error(`Federated round exited with code ${code}`));
          });
          proc.on('error', reject);
        });
      },
      'Nightly federated learning round: noised gradient aggregation across tenants for invoice risk model',
    );

    // One-time idempotent backfill: encrypt customer PII (email/phone/tin)
    const { migrateCustomerPii } = require('./services/customerPiiMigrationService');
    migrateCustomerPii().catch((err: unknown) => console.error('[CustomerPiiMigration] Backfill failed:', err));
  });

  const gracefulShutdown = async () => {
    console.log('[Server] Shutting down gracefully...');
    server.close(async () => {
      // Stop durable job queue before releasing DB connection.
      await stopQueue();

      // Disconnect from database
      await disconnectDatabase();

      // Disconnect from Redis
      await disconnectRedis();

      // Stop telemetry
      await stopTelemetry();

      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
};

startServer().catch(error => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
