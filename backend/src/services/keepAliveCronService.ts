import cron, { ScheduledTask } from 'node-cron';
import { wrapCronTick } from './cronJobRegistry';
import http from 'http';
import https from 'https';

/**
 * Pings the server's own /health endpoint every 10 minutes so Render's
 * free/starter tier does not spin down between requests. A cold start
 * takes 30-60 s, which is long enough for Paystack USSD sessions to
 * expire before the PIN prompt arrives on the user's phone.
 *
 * Uses the internal BASE_URL env var (e.g. https://ledgio-backend.onrender.com)
 * if set; falls back to localhost so this is a no-op in test environments.
 */
export class KeepAliveCronService {
  private static task: ScheduledTask | null = null;

  public static init(): void {
    if (this.task) return;

    this.task = cron.schedule('*/10 * * * *', wrapCronTick('Keep-Alive Ping', async () => {
      const base = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
      const url = `${base}/health`;
      const client = url.startsWith('https') ? https : http;

      await new Promise<void>((resolve) => {
        const req = client.get(url, (res) => {
          res.resume();
          console.log(`[KeepAlive] Pinged ${url} → ${res.statusCode}`);
          resolve();
        });
        req.on('error', (err) => {
          console.warn(`[KeepAlive] Ping failed: ${err.message}`);
          resolve();
        });
        req.setTimeout(10_000, () => {
          req.destroy();
          console.warn('[KeepAlive] Ping timed out.');
          resolve();
        });
      });
    }));

    console.log('[KeepAlive] Keep-alive ping cron initialized (every 10 minutes).');
  }
}
