import { logger } from '../utils/logger';

export interface AlertPayload {
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  data?: Record<string, unknown>;
}

/**
 * Delivers an alert to the configured webhook URL (Slack-compatible format).
 * Set ALERT_WEBHOOK_URL to a Slack incoming-webhook or any HTTP endpoint
 * that accepts a JSON body. No-ops silently when the var is unset.
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const emoji = payload.severity === 'critical' ? ':red_circle:' : payload.severity === 'warning' ? ':warning:' : ':information_source:';
  const body = {
    text: `${emoji} *${payload.title}*: ${payload.message}`,
    ...(payload.data
      ? { attachments: [{ text: '```' + JSON.stringify(payload.data, null, 2) + '```', mrkdwn_in: ['text'] }] }
      : {}),
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err: any) {
    logger.warn('[Alert] Webhook delivery failed', { error: err?.message });
  }
}

/**
 * Fires an alert when a background job fails. Called from cronJobRegistry
 * and queueService on each failed execution.
 */
export async function alertJobFailure(jobName: string, errorMessage: string): Promise<void> {
  await sendAlert({
    title: `Job Failed: ${jobName}`,
    message: errorMessage,
    severity: 'critical',
    data: { jobName, errorMessage, timestamp: new Date().toISOString() },
  });
}

/**
 * Fires an alert when average latency on a route exceeds the given threshold.
 * Callers are responsible for debouncing (e.g. only alert after N consecutive
 * threshold breaches) to avoid noise.
 */
export async function alertSlaBreach(route: string, avgMs: number, thresholdMs: number): Promise<void> {
  await sendAlert({
    title: 'SLA Breach',
    message: `${route} avg latency ${avgMs}ms exceeds threshold ${thresholdMs}ms`,
    severity: 'warning',
    data: { route, avgMs, thresholdMs, timestamp: new Date().toISOString() },
  });
}
