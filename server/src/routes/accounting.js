import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { PROVIDERS } from '../services/integrationConfig.js';
import {
  PROVIDER,
  getConnectionState,
  getConnectUrl,
  handleCallback,
  disconnect,
  syncDailySales,
  syncExpenses,
  getSyncLog,
  testConnection,
} from '../services/accountingQuickBooks.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Where the OAuth callback sends the browser back to (UI, not API). */
function uiUrl() {
  return (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function redirectBack(res, params) {
  const url = new URL(uiUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  res.redirect(302, url.toString());
}

/**
 * /api/accounting/:provider/...
 *   GET  /status        — connection + capability state (admin)
 *   GET  /connect       — Intuit authorize URL + redirect URI to register (admin)
 *   GET  /callback      — PUBLIC: OAuth landing, state-validated, exchanges code
 *   POST /sync          — { kind: 'invoice'|'bill', start, end, dryRun, force } (admin)
 *   GET  /sync-log      — recent sync attempts (admin)
 *   POST /disconnect    — drop stored tokens (admin)
 *   POST /test          — live connection probe (admin)
 */
export default function accountingRouter(pool) {
  const router = Router();

  const guard = (req, res, next) => {
    if (!PROVIDERS[req.params.provider] || req.params.provider !== PROVIDER) {
      return res.status(404).json({ error: 'Unknown accounting provider' });
    }
    next();
  };

  router.get('/:provider/status', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      res.json(await getConnectionState(pool));
    } catch (e) {
      console.error('[accounting] status failed:', e);
      res.status(500).json({ error: 'Failed to load connection status' });
    }
  });

  router.get('/:provider/connect', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      res.json(await getConnectUrl(pool));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // PUBLIC — reached by the browser redirect from Intuit. Protection is the
  // state parameter (stored server-side, 10-minute TTL), not the JWT.
  router.get('/:provider/callback', guard, async (req, res) => {
    const { code, state, realmId, error, error_description: errorDesc } = req.query;
    try {
      if (error) throw new Error(errorDesc || error);
      const conn = await handleCallback(pool, { code, state, realmId });
      await logAudit(pool, req, {
        action: 'accounting_connect',
        entityType: 'integration',
        entityId: PROVIDER,
        details: { realmId: conn.realmId, environment: conn.environment },
      });
      redirectBack(res, { accounting: PROVIDER, result: 'connected', company: conn.realmId || '' });
    } catch (e) {
      console.error('[accounting] callback failed:', e.message);
      redirectBack(res, { accounting: PROVIDER, result: 'error', message: e.message });
    }
  });

  router.post('/:provider/disconnect', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      const state = await disconnect(pool);
      await logAudit(pool, req, {
        action: 'accounting_disconnect',
        entityType: 'integration',
        entityId: PROVIDER,
      });
      res.json(state);
    } catch (e) {
      console.error('[accounting] disconnect failed:', e);
      res.status(500).json({ error: 'Disconnect failed' });
    }
  });

  router.post('/:provider/test', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      res.json(await testConnection(pool));
    } catch (e) {
      res.json({ ok: false, message: e.message });
    }
  });

  router.get('/:provider/sync-log', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      res.json(await getSyncLog(pool, req.query.limit));
    } catch (e) {
      console.error('[accounting] sync log failed:', e);
      res.status(500).json({ error: 'Failed to load sync log' });
    }
  });

  router.post('/:provider/sync', authMiddleware, adminMiddleware, guard, async (req, res) => {
    const { kind = 'invoice', start, end, dryRun = false, force = false } = req.body || {};
    if (!start || !ISO_DATE.test(String(start)) || (end && !ISO_DATE.test(String(end)))) {
      return res.status(400).json({ error: 'start/end must be YYYY-MM-DD' });
    }
    if (kind !== 'invoice' && kind !== 'bill') {
      return res.status(400).json({ error: "kind must be 'invoice' or 'bill'" });
    }
    try {
      const result = kind === 'invoice'
        ? await syncDailySales(pool, { start, end, dryRun: !!dryRun, force: !!force })
        : await syncExpenses(pool, { start, end, dryRun: !!dryRun, force: !!force });

      await logAudit(pool, req, {
        action: 'accounting_sync',
        entityType: 'integration',
        entityId: PROVIDER,
        details: { kind, start, end: end || start, dryRun: !!dryRun, counts: result.counts },
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}
