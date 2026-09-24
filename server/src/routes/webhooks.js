import { Router } from 'express';
import { getSecret, isProviderEnabled } from '../services/integrationConfig.js';
import { VERIFIERS, extractEventId } from '../services/webhookVerify.js';
import { logAudit } from '../services/audit.js';
import { handlePaymongoEvent } from '../services/paymongo.js';
import { handleDeliveryWebhook } from '../services/deliveryChannels.js';

/**
 * POST /api/webhooks/:provider — generic inbound webhook receiver.
 * Mounted with express.raw BEFORE express.json so req.body is the raw Buffer
 * needed for HMAC signature verification.
 *
 * Pipeline: feature flag → signature verify → idempotency (payment_events) → dispatch.
 */
export default function webhooksRouter(pool, broadcastEvent) {
  const router = Router();

  router.post('/:provider', async (req, res) => {
    const { provider } = req.params;
    const verifier = VERIFIERS[provider];
    if (!verifier) return res.status(404).json({ error: 'Unknown provider' });

    try {
      if (!(await isProviderEnabled(pool, provider))) {
        return res.status(404).json({ error: 'Integration not enabled' });
      }

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {});

      const secret = await getSecret(pool, provider, 'webhook_secret');
      const sig = verifier(rawBody, req.headers, secret);
      if (!sig.ok) {
        console.warn(`[webhook:${provider}] rejected: ${sig.reason}`);
        await logAudit(pool, req, {
          action: 'webhook_rejected',
          entityType: 'webhook',
          entityId: provider,
          details: { reason: sig.reason },
        }).catch(() => {});
        return res.status(401).json({ error: 'Invalid signature' });
      }

      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
      }

      // Idempotency: gateways retry — record each event once (UNIQUE provider+event_id).
      const eventId = extractEventId(provider, body, rawBody);
      let recordId;
      try {
        const [result] = await pool.execute(
          `INSERT INTO payment_events (provider, event_id, event_type, payload, status)
           VALUES (?, ?, ?, ?, 'received')`,
          [provider, eventId, String(body?.data?.type || body?.type || body?.event_type || 'unknown').slice(0, 64), rawBody.slice(0, 60000)]
        );
        recordId = result.insertId;
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          return res.status(200).json({ ok: true, duplicate: true });
        }
        throw e;
      }

      try {
        let outcome;
        if (provider === 'paymongo') {
          outcome = await handlePaymongoEvent(pool, body, broadcastEvent);
        } else {
          outcome = await handleDeliveryWebhook(pool, provider, body, broadcastEvent);
        }

        await pool.execute(
          `UPDATE payment_events SET status = 'processed', order_id = ? WHERE id = ?`,
          [outcome?.order_id || null, recordId]
        );
        res.status(200).json({ ok: true, ...outcome });
      } catch (e) {
        console.error(`[webhook:${provider}] processing failed:`, e);
        await logAudit(pool, req, {
          action: 'webhook_processing_failed',
          entityType: 'webhook',
          entityId: provider,
          details: { event_id: eventId, error: String(e.message).slice(0, 300) },
        }).catch(() => {});
        // Remove the event row so the gateway's retry can be reprocessed,
        // then respond 500 to trigger that retry.
        await pool.execute(`DELETE FROM payment_events WHERE id = ?`, [recordId]).catch(() => {});
        res.status(500).json({ error: 'Processing failed' });
      }
    } catch (e) {
      console.error(`[webhook:${provider}] error:`, e);
      res.status(500).json({ error: 'Webhook error' });
    }
  });

  return router;
}
