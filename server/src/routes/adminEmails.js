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
  SMTP_SETTING_KEYS,
  resolveSmtpFields,
  smtpConfigComplete,
  validateCampaign,
  buildRecipientList,
  sendCampaignMail,
  MAX_RECIPIENTS,
} from '../services/mailer.js';
import { encryptSecret, maskSecret } from '../services/integrationConfig.js';

const NOT_CONFIGURED_MSG =
  'Email sending is not configured. Open Admin → Settings → Email Marketing and save your SMTP server details (host, user, password) — or set SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env and restart.';

export default function adminEmailsRouter(pool) {
  const router = Router();

  router.use(authMiddleware, adminMiddleware);

  // GET /status — SMTP state (masked), how many customers can receive?
  router.get('/status', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, name_enc, email_enc, email_hash FROM customers WHERE email_hash IS NOT NULL'
      );
      const { recipients, skipped } = await resolveRecipients(rows);
      const fields = await resolveSmtpFields(pool);
      res.json({
        configured: smtpConfigComplete(fields),
        source: fields.source,
        smtp: {
          host: { configured: !!fields.host, value: fields.host || '' },
          port: { configured: !!fields.port, value: fields.port ? String(fields.port) : '' },
          user: { configured: !!fields.user, value: fields.user || '' },
          pass: { configured: !!fields.pass, masked: maskSecret(fields.pass) },
          from: { configured: !!fields.from, value: fields.from || '' },
        },
        recipientCount: recipients.length,
        skippedWithoutValidEmail: skipped.length,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /smtp — save SMTP credentials to company_settings. The password is
  // encrypted the same way other provider secrets are (AES-256-GCM). Omitted
  // or empty fields keep their current value; `null` clears one.
  router.put('/smtp', async (req, res) => {
    const { host, port, user, pass, from } = req.body || {};
    if (port != null && port !== '' && (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)) {
      return res.status(400).json({ error: 'Port must be an integer between 1 and 65535' });
    }
    const fromValue = from == null ? '' : String(from).trim();
    if (fromValue !== '') {
      // Accept either a bare email or "Display Name <email>" (nodemailer form).
      const inner = fromValue.includes('<')
        ? (fromValue.match(/<([^>]+)>/)?.[1] ?? '').trim()
        : fromValue;
      if (!inner || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inner)) {
        return res.status(400).json({ error: 'From must be an email address (or "Name <email>")' });
      }
    }
    try {
      const fields = [
        [SMTP_SETTING_KEYS.host, host, false],
        [SMTP_SETTING_KEYS.port, port, false],
        [SMTP_SETTING_KEYS.user, user, false],
        [SMTP_SETTING_KEYS.pass, pass, true],
        [SMTP_SETTING_KEYS.from, from, false],
      ];
      const saved = [];
      for (const [key, value, secret] of fields) {
        if (value === undefined || value === null || value === '') continue;
        const stored = secret ? encryptSecret(String(value)) : String(value).trim();
        await pool.query(
          `INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, stored]
        );
        saved.push(key);
      }
      await logAudit(pool, req, {
        action: 'smtp_settings_save',
        entityType: 'marketing_campaign',
        details: { keys: saved },
      });
      const resolved = await resolveSmtpFields(pool);
      res.json({ ok: true, saved, configured: smtpConfigComplete(resolved) });
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
        if (!smtpConfigComplete(await resolveSmtpFields(pool))) {
          return res.status(400).json({ error: NOT_CONFIGURED_MSG });
        }
        try {
          await sendCampaignMail(pool, { to: testAddress, subject: `[TEST] ${cleanSubject}`, text: cleanBody, name: null });
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

      if (!smtpConfigComplete(await resolveSmtpFields(pool))) {
        return res.status(400).json({ error: NOT_CONFIGURED_MSG });
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
            await sendCampaignMail(pool, { to: recipient.email, subject: cleanSubject, text: cleanBody, name: recipient.name });
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
