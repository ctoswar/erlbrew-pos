import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import * as quickbooks from '../services/accountingQuickBooks.js';
import * as xero from '../services/accountingXero.js';

/** Accounting services by `:provider` — each module exposes the same surface. */
const SERVICES = {
  quickbooks,
  xero,
};

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
 *   GET  /connect       — provider authorize URL + redirect URI (admin)
 *   GET  /callback      — PUBLIC: OAuth landing, state-validated, exchanges code
 *   POST /sync          — { kind: 'invoice'|'bill', start, end, dryRun, force } (admin)
 *   POST /reconcile     — { start, end, dryRun } — Xero only (admin)
 *   GET  /sync-log      — recent sync attempts (admin)
 *   POST /disconnect    — drop stored tokens (admin)
 *   POST /test          — live connection probe, mock result when not connected (admin)
 */
export default function accountingRouter(pool) {
  const router = Router();

  const guard = (req, res, next) => {
    if (!SERVICES[req.params.provider]) {
      return res.status(404).json({ error: 'Unknown accounting provider' });
    }
    next();
  };

  /** The service module for this request's `:provider` (guard ran first). */
  const svc = (req) => SERVICES[req.params.provider];

  router.get('/:provider/status', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      res.json(await svc(req).getConnectionState(pool));
    } catch (e) {
      console.error('[accounting] status failed:', e);
      res.status(500).json({ error: 'Failed to load connection status' });
    }
  });

  router.get('/:provider/connect', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      res.json(await svc(req).getConnectUrl(pool));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // PUBLIC — reached by the browser redirect from the provider. Protection is
  // the state parameter (stored server-side, 10-minute TTL), not the JWT.
  router.get('/:provider/callback', guard, async (req, res) => {
    const provider = req.params.provider;
    const { code, state, realmId, error, error_description: errorDesc } = req.query;
    try {
      if (error) throw new Error(errorDesc || error);
      const conn = await svc(req).handleCallback(pool, { code, state, realmId });
      await logAudit(pool, req, {
        action: 'accounting_connect',
        entityType: 'integration',
        entityId: provider,
        details: provider === 'quickbooks'
          ? { realmId: conn.realmId, environment: conn.environment }
          : { tenantId: conn.tenantId, environment: conn.environment },
      });
      redirectBack(res, {
        accounting: provider,
        result: 'connected',
        company: conn.realmId || conn.tenantId || '',
      });
    } catch (e) {
      console.error('[accounting] callback failed:', e.message);
      redirectBack(res, { accounting: provider, result: 'error', message: e.message });
    }
  });

  router.post('/:provider/disconnect', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      const state = await svc(req).disconnect(pool);
      await logAudit(pool, req, {
        action: 'accounting_disconnect',
        entityType: 'integration',
        entityId: req.params.provider,
      });
      res.json(state);
    } catch (e) {
      console.error('[accounting] disconnect failed:', e);
      res.status(500).json({ error: 'Disconnect failed' });
    }
  });

  router.post('/:provider/test', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      res.json(await svc(req).testConnection(pool));
    } catch (e) {
      res.json({ ok: false, message: e.message });
    }
  });

  router.get('/:provider/sync-log', authMiddleware, adminMiddleware, guard, async (req, res) => {
    try {
      res.json(await svc(req).getSyncLog(pool, req.query.limit));
    } catch (e) {
      console.error('[accounting] sync log failed:', e);
      res.status(500).json({ error: 'Failed to load sync log' });
    }
  });

  router.post('/:provider/sync', authMiddleware, adminMiddleware, guard, async (req, res) => {
    const provider = req.params.provider;
    const { kind = 'invoice', start, end, dryRun = false, force = false } = req.body || {};
    if (!start || !ISO_DATE.test(String(start)) || (end && !ISO_DATE.test(String(end)))) {
      return res.status(400).json({ error: 'start/end must be YYYY-MM-DD' });
    }
    if (kind !== 'invoice' && kind !== 'bill') {
      return res.status(400).json({ error: "kind must be 'invoice' or 'bill'" });
    }
    try {
      const service = svc(req);
      const result = kind === 'invoice'
        ? await service.syncDailySales(pool, { start, end, dryRun: !!dryRun, force: !!force })
        : await service.syncExpenses(pool, { start, end, dryRun: !!dryRun, force: !!force });

      await logAudit(pool, req, {
        action: 'accounting_sync',
        entityType: 'integration',
        entityId: provider,
        details: { kind, start, end: end || start, dryRun: !!dryRun, counts: result.counts },
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Bank reconciliation — Xero-only capability (features: ['invoice','reconcile']).
  router.post('/:provider/reconcile', authMiddleware, adminMiddleware, guard, async (req, res) => {
    const provider = req.params.provider;
    const service = svc(req);
    if (typeof service.reconcileBankStatements !== 'function') {
      return res.status(404).json({ error: `Bank reconciliation is not supported for ${provider}` });
    }
    const { start, end, dryRun = false, toleranceCents, dateWindowDays } = req.body || {};
    if (!start || !ISO_DATE.test(String(start)) || (end && !ISO_DATE.test(String(end)))) {
      return res.status(400).json({ error: 'start/end must be YYYY-MM-DD' });
    }
    if (toleranceCents !== undefined && !Number.isFinite(Number(toleranceCents))) {
      return res.status(400).json({ error: 'toleranceCents must be a number' });
    }
    if (dateWindowDays !== undefined && !Number.isFinite(Number(dateWindowDays))) {
      return res.status(400).json({ error: 'dateWindowDays must be a number' });
    }
    try {
      const result = await service.reconcileBankStatements(pool, {
        start,
        end,
        dryRun: !!dryRun,
        ...(toleranceCents !== undefined ? { toleranceCents: Number(toleranceCents) } : {}),
        ...(dateWindowDays !== undefined ? { dateWindowDays: Number(dateWindowDays) } : {}),
      });

      await logAudit(pool, req, {
        action: 'accounting_reconcile',
        entityType: 'integration',
        entityId: provider,
        details: {
          start,
          end: end || start,
          dryRun: !!dryRun,
          matched: result.matched,
          unmatched: result.unmatched,
          variance: result.variance,
        },
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}
