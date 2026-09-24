import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { buildMenuExport } from '../services/deliveryChannels.js';
import {
  PROVIDERS,
  getProviderStatus,
  saveProviderFields,
  isProviderEnabled,
  resolveField,
  getWebhookUrl,
} from '../services/integrationConfig.js';

/**
 * GET  /api/integrations                — masked status of all providers (admin)
 * PUT  /api/integrations/:provider       — save fields + enabled flag (admin)
 * POST /api/integrations/:provider/test  — test connection (admin)
 * GET  /api/integrations/enabled         — public: which integrations are on (for POS UI)
 */
export default function integrationsRouter(pool) {
  const router = Router();

  // Public: minimal flags so the POS can decide whether to offer gateway payment.
  router.get('/enabled', async (req, res) => {
    try {
      const out = {};
      for (const p of Object.keys(PROVIDERS)) out[p] = await isProviderEnabled(pool, p);
      res.json(out);
    } catch (e) {
      console.error(e);
      res.json({}); // fail open — POS falls back to manual flow
    }
  });

  router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const out = {};
      for (const p of Object.keys(PROVIDERS)) out[p] = await getProviderStatus(pool, p);
      res.json(out);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load integrations' });
    }
  });

  router.put('/:provider', authMiddleware, adminMiddleware, async (req, res) => {
    const { provider } = req.params;
    if (!PROVIDERS[provider]) return res.status(404).json({ error: 'Unknown provider' });
    try {
      const { enabled, ...fields } = req.body || {};
      const saved = await saveProviderFields(pool, provider, fields);
      if (enabled !== undefined) {
        await pool.execute(
          `INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [PROVIDERS[provider].enabledSetting, enabled ? '1' : '0']
        );
      }
      await logAudit(pool, req, {
        action: 'integration_update',
        entityType: 'integration',
        entityId: provider,
        details: { fields: saved, enabled },
      });
      res.json(await getProviderStatus(pool, provider));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to save integration' });
    }
  });

  // Test connection: PayMongo makes a real read-only API call; delivery platforms
  // (no partner account yet) only verify configuration presence.
  router.post('/:provider/test', authMiddleware, adminMiddleware, async (req, res) => {
    const { provider } = req.params;
    if (!PROVIDERS[provider]) return res.status(404).json({ error: 'Unknown provider' });
    try {
      if (!(await isProviderEnabled(pool, provider))) {
        return res.json({ ok: false, message: `${PROVIDERS[provider].label} is not enabled` });
      }

      if (provider === 'paymongo') {
        const key = await resolveField(pool, provider, 'secret_key');
        if (!key) return res.json({ ok: false, message: 'Secret key not configured' });
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);
        try {
          const r = await fetch('https://api.paymongo.com/v1/payments?limit=1', {
            headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
            signal: ctrl.signal,
          });
          if (r.status === 401 || r.status === 403) {
            return res.json({ ok: false, message: 'Invalid secret key (rejected by PayMongo)' });
          }
          if (r.ok) return res.json({ ok: true, message: 'Connected to PayMongo successfully' });
          return res.json({ ok: true, message: `Key accepted by PayMongo (HTTP ${r.status})` });
        } finally {
          clearTimeout(timer);
        }
      }

      // Delivery platforms: config check only until partner accounts are approved.
      const status = await getProviderStatus(pool, provider);
      const missing = Object.entries(status.fields)
        .filter(([, f]) => !f.configured)
        .map(([k]) => k);
      if (missing.length) {
        return res.json({ ok: false, message: `Missing configuration: ${missing.join(', ')}` });
      }
      return res.json({
        ok: true,
        message: 'Credentials configured — live connection test available once partner account is approved',
      });
    } catch (e) {
      console.error(e);
      const msg = e.name === 'AbortError' ? 'Connection timed out' : e.message;
      res.json({ ok: false, message: `Connection failed: ${msg}` });
    }
  });

  // Helper for the Settings UI: current webhook URL for a provider.
  router.get('/:provider/webhook-url', authMiddleware, adminMiddleware, async (req, res) => {
    const { provider } = req.params;
    if (!PROVIDERS[provider]) return res.status(404).json({ error: 'Unknown provider' });
    res.json({ url: await getWebhookUrl(pool, provider) });
  });

  // Menu export for delivery platforms (catalog sync — mock until partner account lands).
  router.get('/:provider/menu', authMiddleware, adminMiddleware, async (req, res) => {
    const { provider } = req.params;
    if (provider !== 'grab' && provider !== 'foodpanda') {
      return res.status(404).json({ error: 'Unknown provider' });
    }
    try {
      res.json(await buildMenuExport(pool, provider));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to build menu export' });
    }
  });

  return router;
}
