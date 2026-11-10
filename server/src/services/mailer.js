// SMTP mailer for marketing campaigns. Dark-launch: without SMTP configured
// every send is rejected with a clear message instead of trying to auth with
// empty credentials.
//
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, MAIL_FROM
//
// Configuration resolution: env var › company_settings (decrypted, saved
// from Settings → Email Marketing) › unset. Env keeps winning for
// self-hosted setups; nothing needs a restart after saving from the UI.
// The password is stored encrypted (integrationConfig encryptSecret).
//
// Pure helpers (validation, recipient dedupe, plain→HTML body) are exported
// separately for unit tests.

import nodemailer from 'nodemailer';
import { decryptSecret } from './integrationConfig.js';

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 10000;
export const MAX_RECIPIENTS = 2000;

// company_settings keys for the UI-saved SMTP configuration.
// secret: true → stored encrypted via integrationConfig.
export const SMTP_SETTING_KEYS = {
  host: { env: 'SMTP_HOST', setting: 'smtp_host' },
  port: { env: 'SMTP_PORT', setting: 'smtp_port' },
  user: { env: 'SMTP_USER', setting: 'smtp_user' },
  pass: { env: 'SMTP_PASS', setting: 'smtp_pass', secret: true },
  from: { env: 'MAIL_FROM', setting: 'smtp_mail_from' },
};

/** company_settings lookup — tolerated when the table is missing. */
async function getSetting(pool, key) {
  if (!pool) return null;
  try {
    const [rows] = await pool.query(
      'SELECT setting_value FROM company_settings WHERE setting_key = ? LIMIT 1',
      [key]
    );
    return rows.length > 0 ? rows[0].setting_value : null;
  } catch {
    return null;
  }
}

/** Full resolution — env var › DB (decrypted when secret) › undefined. */
export async function resolveSmtpSettings(pool) {
  const resolved = {};
  for (const [field, def] of Object.entries(SMTP_SETTING_KEYS)) {
    if (def.env && process.env[def.env]) {
      resolved[field] = { value: process.env[def.env], source: 'env' };
      continue;
    }
    let raw = await getSetting(pool, def.setting);
    if (raw != null && raw !== '') {
      if (def.secret) raw = decryptSecret(raw);
      resolved[field] = { value: String(raw), source: 'settings' };
    }
  }
  return resolved;
}

/** Env-only view (legacy, no DB) — kept sync for tests / status fallback. */
export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function mailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || null;
}

/** Ready(send-capable)? with the full env › settings resolution. */
export async function smtpReady(pool) {
  const cfg = await resolveSmtpSettings(pool);
  return Boolean(cfg.host?.value && cfg.user?.value && cfg.pass?.value);
}

/** From address with the full resolution (falls back to SMTP user). */
export async function resolvedFrom(pool) {
  const cfg = await resolveSmtpSettings(pool);
  return cfg.from?.value || cfg.user?.value || null;
}

/** Build a nodemailer transport from resolved settings (null when unset). */
function transport(cfg) {
  if (!cfg.host?.value || !cfg.user?.value || !cfg.pass?.value) return null;
  const port = Number(cfg.port?.value) || 587;
  return nodemailer.createTransport({
    host: cfg.host.value,
    port,
    secure: port === 465,
    auth: { user: cfg.user.value, pass: cfg.pass.value },
  });
}

export function validateCampaign({ subject, body }) {
  const subj = typeof subject === 'string' ? subject.trim() : '';
  const bod = typeof body === 'string' ? body.trim() : '';
  if (!subj) return 'Subject is required';
  if (subj.length > MAX_SUBJECT_LENGTH) return `Subject must be at most ${MAX_SUBJECT_LENGTH} characters`;
  if (!bod) return 'Body is required';
  if (bod.length > MAX_BODY_LENGTH) return `Body must be at most ${MAX_BODY_LENGTH} characters`;
  return null;
}

/**
 * Builds the recipient list from raw customer rows.
 * Kept pure (takes decrypted emails in, dedupes + validates) so tests cover
 * the logic without DB access.
 */
export function buildRecipientList(rows) {
  const seen = new Map();
  const skipped = [];
  for (const row of rows) {
    const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push(row.id);
      continue;
    }
    if (!seen.has(email)) {
      seen.set(email, {
        id: row.id,
        email,
        name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null,
      });
    }
  }
  return { recipients: [...seen.values()], skipped };
}

/**
 * Wraps a plain-text advertisement body in a small branded HTML shell
 * (HTML-escaping the text) so the email renders decently everywhere.
 */
export function plainTextToHtml(text) {
  const escape = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0">${escape(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#faf7f2;font-family:Georgia,'Times New Roman',serif;color:#1e0e06;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eaddc7;border-radius:14px;padding:28px;">
    <div style="font-size:12px;letter-spacing:2.4px;color:#C9873A;font-weight:bold;margin-bottom:14px;">ERLBREW CAFÉ</div>
    ${paragraphs}
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #eaddc7;font-size:11px;color:#9a8f80;">
      You are receiving this because you shared your email with Erlbrew Café.
    </div>
  </div>
</body></html>`;
}

/** Send one campaign mail. SMTP resolves env › company_settings at call time.
 *  `pool` is optional — without it only env vars are consulted. */
export async function sendCampaignMail(opts, pool = null) {
  const { to, subject, text, name } = opts;
  const cfg = await resolveSmtpSettings(pool);
  const tx = transport(cfg);
  if (!tx) {
    const err = new Error(
      'Email sending is not configured. Set SMTP_HOST (env) or save the SMTP settings in Settings → Email Marketing.'
    );
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  const from = cfg.from?.value || cfg.user?.value;
  const greeting = name ? `Hi ${name.split(' ')[0]},\n\n` : '';
  return tx.sendMail({
    from,
    to,
    subject,
    text: `${greeting}${text}\n\n— Erlbrew Café\n`,
    html: plainTextToHtml(`${greeting}${text}`),
  });
}
