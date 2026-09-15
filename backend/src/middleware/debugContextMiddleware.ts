import { Request, Response, NextFunction } from 'express';
import { generateDebugId, pushDebugLog, DebugLogEntry } from '../services/debugLogService';

function firstAppFrame(stack?: string): string | undefined {
  if (!stack) return undefined;
  for (const line of stack.split('\n').slice(1)) {
    const t = line.trim();
    if (!t.startsWith('at ')) continue;
    if (t.includes('node_modules') || t.includes('node:') || t.includes('(node:')) continue;
    const m = t.match(/\(([^)]+)\)$/) ?? t.match(/at\s+(.+:\d+:\d+)$/);
    if (!m) continue;
    const loc = m[1];
    const idx = Math.max(loc.indexOf('/src/'), loc.indexOf('/dist/'));
    return idx >= 0 ? loc.slice(idx + 1) : loc;
  }
  return undefined;
}

type AugmentedRequest = Request & {
  debugId?: string;
  tenantId?: string;
  user?: { id?: string; email?: string };
  _debugError?: string;
  _debugStack?: string;
};

export function debugContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const debugId = generateDebugId();
  const startMs = Date.now();
  const r = req as AugmentedRequest;

  r.debugId = debugId;
  res.setHeader('x-debug-id', debugId);

  // Intercept res.json to capture error messages before finish fires
  const origJson = res.json.bind(res) as typeof res.json;
  (res as Response).json = function (body: unknown) {
    if (res.statusCode >= 400 && body && typeof body === 'object' && 'error' in (body as object)) {
      r._debugError = (body as { error?: string }).error;
    }
    return origJson(body);
  };

  res.on('finish', () => {
    const status = res.statusCode;
    const level: DebugLogEntry['level'] = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'ok';

    const bodyKeys =
      req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)
        ? Object.keys(req.body as object).filter(
            (k) => !['password', 'passcode', 'token', 'secret', 'totpCode'].includes(k),
          )
        : undefined;

    const entry: DebugLogEntry = {
      id: debugId,
      ts: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status,
      durationMs: Date.now() - startMs,
      level,
      tenantId: r.tenantId,
      userId: r.user?.id,
      userEmail: r.user?.email,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket?.remoteAddress,
      bodyKeys: bodyKeys && bodyKeys.length > 0 ? bodyKeys : undefined,
      errorMessage: r._debugError,
      errorSource: r._debugStack ? firstAppFrame(r._debugStack) : undefined,
    };

    pushDebugLog(entry);
  });

  next();
}
