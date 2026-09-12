/**
 * Honeypot probe-endpoint router.
 *
 * Registers convincing-looking responses for paths attackers commonly enumerate
 * when scanning a web application: environment files, admin debug panels, config
 * dumps, health endpoints with verbose output. Every hit is logged as
 * SECURITY.HONEYPOT_PROBE and triggers a platform alert email.
 *
 * IMPORTANT: These routes must be mounted BEFORE the real API router so they
 * intercept the requests first. They are intentionally NOT under /api/v1 — they
 * mimic the raw paths attackers expect on any web server.
 */

import { Router, Request, Response } from 'express';
import { recordProbeEndpointHit } from '../services/honeypotService';

const router = Router();

function ctx(req: Request) {
  return {
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'],
  };
}

// ── .env / environment file probes ──────────────────────────────────────────
router.get('/.env', async (req: Request, res: Response) => {
  await recordProbeEndpointHit('/.env', ctx(req));
  // Return a convincing-looking (but entirely fake) env file
  res.type('text/plain').status(200).send(
    '# App config\nAPP_ENV=production\nDB_HOST=db.internal\nDB_PORT=5432\n'
    + 'DB_NAME=ledgio_prod\nDB_USER=ledgio_app\nDB_PASS=\nREDIS_URL=redis://redis:6379\n'
    + 'JWT_SECRET=\nSECRET_KEY=\n',
  );
});

router.get('/.env.local', async (req: Request, res: Response) => {
  await recordProbeEndpointHit('/.env.local', ctx(req));
  res.type('text/plain').status(200).send('# local overrides\n');
});

router.get('/.env.production', async (req: Request, res: Response) => {
  await recordProbeEndpointHit('/.env.production', ctx(req));
  res.type('text/plain').status(200).send('# production overrides\n');
});

// ── Admin / debug panel probes ───────────────────────────────────────────────
router.get(['/admin', '/admin/login', '/admin/dashboard'], async (req: Request, res: Response) => {
  await recordProbeEndpointHit(req.path, ctx(req));
  res.status(200).json({ message: 'Admin panel is not available via this interface.' });
});

router.get(['/debug', '/api/debug', '/api/v1/debug'], async (req: Request, res: Response) => {
  await recordProbeEndpointHit(req.path, ctx(req));
  res.status(200).json({ status: 'ok', debug: false });
});

// ── Config / secret dump probes ──────────────────────────────────────────────
router.get(
  ['/config', '/api/config', '/api/v1/config', '/api/internal/config'],
  async (req: Request, res: Response) => {
    await recordProbeEndpointHit(req.path, ctx(req));
    res.status(403).json({ error: 'Forbidden' });
  },
);

router.get(
  ['/api/internal/dump', '/api/v1/internal/dump', '/dump'],
  async (req: Request, res: Response) => {
    await recordProbeEndpointHit(req.path, ctx(req));
    res.status(403).json({ error: 'Forbidden' });
  },
);

// ── Common backup / source file probes ──────────────────────────────────────
const backupPaths = [
  '/backup.sql', '/dump.sql', '/database.sql', '/db.sql',
  '/backup.zip', '/source.zip', '/app.zip',
  '/composer.json', '/package.json.bak',
  '/wp-login.php', '/wp-admin', '/wp-config.php',
  '/phpinfo.php', '/info.php', '/test.php',
];
router.get(backupPaths, async (req: Request, res: Response) => {
  await recordProbeEndpointHit(req.path, ctx(req));
  res.status(404).send('Not found');
});

// ── Git / CI metadata probes ─────────────────────────────────────────────────
router.get('/.git/config', async (req: Request, res: Response) => {
  await recordProbeEndpointHit('/.git/config', ctx(req));
  res.status(403).send('Forbidden');
});

router.get(['/Jenkinsfile', '/.travis.yml', '/.gitlab-ci.yml', '/Dockerfile'], async (req: Request, res: Response) => {
  await recordProbeEndpointHit(req.path, ctx(req));
  res.status(404).send('Not found');
});

export default router;
