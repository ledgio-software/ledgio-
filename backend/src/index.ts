import app from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { connectRedis, disconnectRedis } from './config/redis';
import { startTelemetry, stopTelemetry } from './config/telemetry';
import { initSyncSocketServer } from './websocket/syncSocketServer';
import { initPresenceSocketServer } from './websocket/presenceSocketServer';
import { registerJob } from './services/cronJobRegistry';

const PORT = process.env.PORT || 4000;

const startServer = async () => {
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

    // Initialize Monday 8:00 AM Automated Email Reporting Cron Job
    const { ScheduledEmailCronService } = require('./services/scheduledEmailService');
    ScheduledEmailCronService.init();
    registerJob('Scheduled Email Reports', '0 8 * * 1', 'Weekly P&L email reports to tenant admins', () => ScheduledEmailCronService.sendScheduledReports?.() ?? Promise.resolve());

    // Initialize hourly Recurring Transactions generator
    const { RecurringTransactionCronService } = require('./services/recurringTransactionService');
    RecurringTransactionCronService.init();
    registerJob('Recurring Transactions', '0 * * * *', 'Hourly recurring journal entry generation', () => RecurringTransactionCronService.processRecurringTransactions?.() ?? Promise.resolve());

    // Initialize FX rate cache refresher (no-op if FX_RATE_API_KEY isn't configured)
    const { FxRateCronService } = require('./services/fxRateCronService');
    FxRateCronService.init();
    registerJob('FX Rate Refresh', '0 */6 * * *', 'Refreshes live exchange rates every 6 hours', () => FxRateCronService.refreshRatesJob());

    // Initialize daily overdue-invoice payment reminder (dunning) sweep
    const { DunningReminderCronService } = require('./services/dunningReminderService');
    DunningReminderCronService.init();
    registerJob('Dunning Reminders', '0 9 * * *', 'Daily overdue-invoice payment reminder emails', () => DunningReminderCronService.sendReminders?.() ?? Promise.resolve());

    // Initialize daily Help Assistant conversation-log retention sweep
    const { HelpAssistantMaintenanceCronService } = require('./services/helpAssistantMaintenanceCronService');
    HelpAssistantMaintenanceCronService.init();
    registerJob('Help Assistant Maintenance', '0 2 * * *', 'Daily pruning of old AI chat conversation logs', () => HelpAssistantMaintenanceCronService.runMaintenance?.() ?? Promise.resolve());

    // Initialize daily scheduled vendor-bill payments sweep
    const { VendorPaymentSchedulingCronService } = require('./services/vendorPaymentSchedulingCronService');
    VendorPaymentSchedulingCronService.init();
    registerJob('Vendor Payment Scheduling', '0 7 * * *', 'Daily sweep for due scheduled vendor bill payments', () => VendorPaymentSchedulingCronService.processScheduledPayments?.() ?? Promise.resolve());

    // Initialize daily recurring-invoice generation sweep
    const { RecurringInvoiceCronService } = require('./services/recurringInvoiceCronService');
    RecurringInvoiceCronService.init();
    registerJob('Recurring Invoices', '0 6 * * *', 'Daily recurring invoice generation', () => RecurringInvoiceCronService.generateRecurringInvoices?.() ?? Promise.resolve());

    // Initialize GRA E-VAT VSDC 15-minute clearance retry sweep
    const { GraEvatCronService } = require('./services/graEvatCronService');
    GraEvatCronService.init();
    registerJob('GRA E-VAT Sync', '*/15 * * * *', '15-minute sweep to clear pending/failed GRA VSDC invoices within the 48-hour mandate window', () => GraEvatCronService.runSync());

    // Initialize daily fixed-asset depreciation sweep
    const { FixedAssetDepreciationCronService } = require('./services/fixedAssetDepreciationCronService');
    FixedAssetDepreciationCronService.init();
    registerJob('Fixed Asset Depreciation', '0 1 * * *', 'Daily fixed-asset depreciation journal posting', () => FixedAssetDepreciationCronService.runDepreciation?.() ?? Promise.resolve());

    // Initialize daily interest accrual on overdue receivables
    const { InterestChargeCronService } = require('./services/interestChargeCronService');
    InterestChargeCronService.init();
    registerJob('Interest Charges', '0 0 * * *', 'Daily interest accrual on overdue invoices', () => InterestChargeCronService.processInterestCharges?.() ?? Promise.resolve());

    // One-time idempotent backfill: encrypt customer PII (email/phone/tin)
    const { migrateCustomerPii } = require('./services/customerPiiMigrationService');
    migrateCustomerPii().catch((err: unknown) => console.error('[CustomerPiiMigration] Backfill failed:', err));
  });

  const gracefulShutdown = async () => {
    console.log('[Server] Shutting down gracefully...');
    server.close(async () => {
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
