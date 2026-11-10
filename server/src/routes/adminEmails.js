// Marketing email endpoints (admin only).
//
//   GET  /api/admin/emails/status   — SMTP configuration + recipient count
//   POST /api/admin/emails/send    — { subject, body, testTo?, dryRun? }
//   GET  /api/admin/emails/history — recent campaigns
//
// Recipients are customers with an email on file (email_hash set). Addresses
// are decrypted at send time (PII model, see services/piiCrypto) and never
// returned by the API except the first few on the dry-run preview.

import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { decryptPii } from '../services/piiCrypto.js';
import {
  smtpReady,
  resolvedFrom,
  validateCampaign,
  buildRecipientList,
  sendCampaignMail,
  MAX_RECIPIENTS,
} from '../services/mailer.js';
import { SMTP_SETTING_KEYS } from '../services/mailer.js';
import {
  encryptSecret,
  maskSecret,
} from '../services/integrationConfig.js';

export default function adminEmailsRouter(pool) {
  const router = Router();

  router.use(authMiddleware, adminMiddleware);

  // GET /config — masked SMTP configuration view (no secrets leak; the
  // password shows a "configured + masked" flag, env sources are named).
  router.get('/config', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN (?)',
        [Object.values(SMTP_SETTING_KEYS).map((f) => f.setting)]
      );
      const stored = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
      const fields = {};
      for (const [field, def] of Object.entries(SMTP_SETTING_KEYS)) {
        if (def.env && process.env[def.env]) {
          fields[field] = { configured: true, source: 'env', masked: maskSecret(process.env[def.env]) };
          continue;
        }
        const raw = stored.get(def.setting) || null;
        const value = raw && def.secret ? decryptSecret(raw) : raw;
        fields[field] = {
          configured: Boolean(value),
          source: value ? 'settings' : null,
          ...((def.secret ? { masked: maskSecret(value) } : { value: value || '' })),
        };
      }
      res.json({ fields, ready: await smtpReady(pool), from: await resolvedFrom(pool) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /config — save SMTP settings from the admin UI.
  //   field value  ''        → skip (unchanged)
  //   field value  null      → clear the saved setting (falls back to env)
  //   field value  '...'     → save (password encrypted at rest)
  // The password is NEVER returned by GET. Missing env vars keep winning
  // until an explicit null clear ends the env override.
  router.put('/config', async (req, res) => {
    const updates = req.body || {};
    const saved = [];
    try {
      for (const [field, def] of Object.entries(SMTP_SETTING_KEYS)) {
        if (!(field in updates)) continue;
        const value = updates[field];
        if (value === '') continue; // blank → leave stored value as-is
        if (value === null) {
          await pool.query('DELETE FROM company_settings WHERE setting_key = ?', [def.setting]);
          saved.push(field);
          continue;
        }
        const strValue = String(value).trim();
        if (!strValue) continue;
        if (field === 'port' && strValue && !/^\d{1,5}$/.test(strValue)) {
          return res.status(400).json({ error: 'SMTP port must be a number' });
        }
        const stored = def.secret ? encryptSecret(strValue) : strValue;
        await pool.query(
          `INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [def.setting, stored]
        );
        saved.push(field);
      }
      await logAudit(pool, req, {
        action: 'email_smtp_config',
        entityType: 'marketing_campaign',
        details: { fields: saved },
      });
      res.json({ ok: true, saved, ready: await smtpReady(pool) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });


  // GET /status — is SMTP set up? how many customers can receive?
  router.get('/status', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, name_enc, email_enc, email_hash FROM customers WHERE email_hash IS NOT NULL'
      );
      const { recipients, skipped } = await resolveRecipients(rows);
      res.json({
        configured: await smtpReady(pool),
        from: await resolvedFrom(pool),
        recipientCount: recipients.length,
        skippedWithoutValidEmail: skipped.length,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /send — test send, dry-run preview, or full campaign
  router.post('/send', async (req, res) => {
    const { subject, body, testTo, dryRun } = req.body || {};
    const validationError = validateCampaign({ subject, body });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const cleanSubject = String(subject).trim();
    const cleanBody = String(body).trim();
    const isTest = Boolean(testTo && typeof testTo === 'string' && testTo.trim());
    let testAddress = null;
    if (isTest) {
      testAddress = String(testTo).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testAddress)) {
        return res.status(400).json({ error: 'testTo must be a valid email address' });
      }
    }

    try {
      // Test send — one message to the admin's own inbox, campaign not logged.
      if (isTest) {
        if (!(await smtpReady(pool))) {
          return res.status(400).json({
            error:
              'Email sending is not configured. Set SMTP_HOST (env) or save the SMTP settings in Settings → Email Marketing.',
          });
        }
        try {
          await sendCampaignMail({ to: testAddress, subject: `[TEST] ${cleanSubject}`, text: cleanBody, name: null }, pool);
          await logAudit(pool, req, { action: 'email_test_send', entityType: 'marketing_campaign', details: { subject: cleanSubject, to: testAddress } });
          return res.json({ ok: true, test: true, sentTo: testAddress });
        } catch (e) {
          console.error('[Emails] test send failed:', e.message);
          return res.status(502).json({ error: `Test send failed: ${e.message}` });
        }
      }

      // Collect recipients (dedupe + decrypt)
      const [rows] = await pool.query(
        'SELECT id, name_enc, email_enc, email_hash FROM customers WHERE email_hash IS NOT NULL'
      );
      const { recipients } = await resolveRecipients(rows);
      const audience = recipients.slice(0, MAX_RECIPIENTS);
      // Dry run — show who would receive it, send nothing.
      if (dryRun === true) {
        return res.json({
          ok: true,
          dryRun: true,
          recipientCount: audience.length,
          preview: audience.slice(0, 10).map((r) => ({ id: r.id, email: r.email, name: r.name })),
        });
      }

      if (!(await smtpReady(pool))) {
        return res.status(400).json({
          error:
            'Email sending is not configured. Set SMTP_HOST (env) or save the SMTP settings in Settings → Email Marketing.',
        });
      }
      if (audience.length === 0) {
        return res.status(400).json({ error: 'No customers with an email on file' });
      }

      // Log the campaign first, then stream the send in the background so the
      // HTTP request returns immediately (large batches take a while).
      const [result] = await pool.query(
        `INSERT INTO marketing_campaigns (subject, body, recipient_count, status, created_by, created_by_name)
         VALUES (?, ?, ?, 'sending', ?, ?)`,
        [cleanSubject, cleanBody, audience.length, req.user?.sub ?? null, req.user?.name ?? null]
      );
      const campaignId = result.insertId;
      await logAudit(pool, req, { action: 'email_campaign_send', entityType: 'marketing_campaign', entityId: String(campaignId), details: { subject: cleanSubject, recipients: audience.length } });

      // Background send — sequentially, awaiting one message at a time so we
      // never trip provider throttling.
      void (async () => {
        let delivered = 0;
        let failed = 0;
        let firstError = null;
        for (const recipient of audience) {
          try {
            await sendCampaignMail({ to: recipient.email, subject: cleanSubject, text: cleanBody, name: recipient.name }, pool);
            delivered += 1;
          } catch (e) {
            failed += 1;
            if (!firstError) firstError = e.message;
            console.error(`[Emails] send to #${recipient.id} failed:`, e.message);
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        try {
          await pool.query(
            `UPDATE marketing_campaigns
             SET status = ?, delivered_count = ?, failed_count = ?, error = ?, sent_at = NOW()
             WHERE id = ?`,
            [failed && delivered === 0 ? 'failed' : failed > 0 ? 'partial' : 'sent', delivered, failed, firstError, campaignId]
          );
        } catch (e) {
          console.error('[Emails] campaign finalize failed:', e.message);
        }
      })();

      res.json({ ok: true, campaignId, recipientCount: audience.length, status: 'sending' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Send failed' });
    }
  });

  // GET /history — recent campaigns (no bodies beyond subject)
  router.get('/history', async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT id, subject, recipient_count, delivered_count, failed_count, status, error,
                created_by_name, created_at, sent_at
         FROM marketing_campaigns
         ORDER BY created_at DESC
         LIMIT 25`
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  async function resolveRecipients(rows) {
    // decryptPii passes plaintext through untouched, so encrypted and legacy
    // plaintext columns both resolve to a usable value.
    const withEmails = rows.map((row) => ({
      id: row.id,
      email: row.email_enc ? decryptPii(row.email_enc) : null,
      name: decryptPii(row.name_enc),
    }));
    return buildRecipientList(withEmails);
  }

  return router;
}
