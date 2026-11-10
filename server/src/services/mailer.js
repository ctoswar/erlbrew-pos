// SMTP mailer for marketing campaigns. Dark-launch: without SMTP configured
// every send is rejected with a clear message instead of trying to auth with
// empty credentials.
//
// Credentials live in company_settings (saved from the admin Settings →
// Email Marketing card: smtp_host/port/user/pass/mail_from — pass encrypted
// AES-256-GCM via integrationConfig); env vars SMTP_HOST, SMTP_PORT,
// SMTP_USER, SMTP_PASS, MAIL_FROM still win when set (same env › settings
// rule as every other provider).
//
// Pure helpers (validation, recipient dedupe, plain→HTML body) are exported
// separately for unit tests.

import nodemailer from 'nodemailer';
import { decryptSecret } from './integrationConfig.js';

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 10000;
export const MAX_RECIPIENTS = 2000;

// SMTP lives in company_settings (admin Settings UI), same model as the
// other provider credentials: each field resolves `env var › saved setting`
// so .env keeps working for self-hosted setups without touching the DB.
export const SMTP_SETTING_KEYS = {
  host: 'smtp_host',
  port: 'smtp_port',
  user: 'smtp_user',
  pass: 'smtp_pass',
  from: 'smtp_mail_from',
};

async function getSettingValue(pool, key) {
  try {
    const [rows] = await pool.query(
      'SELECT setting_value FROM company_settings WHERE setting_key = ?',
      [key]
    );
    return rows.length > 0 ? rows[0].setting_value : null;
  } catch {
    return null; // company_settings table may not exist yet
  }
}

const firstVal = (...vals) => vals.find((v) => v !== null && v !== undefined && v !== '') ?? null;

/**
 * Resolve all SMTP fields for display + sending: env › DB (smtp_pass is
 * decrypted from the integrations-style `enc:v1:` payload). `source` tells
 * the UI where the live config came from ('env' | 'settings' | null).
 */
export async function resolveSmtpFields(pool) {
  const [dbHost, dbPort, dbUser, dbPassRaw, dbFrom] = await Promise.all([
    getSettingValue(pool, SMTP_SETTING_KEYS.host),
    getSettingValue(pool, SMTP_SETTING_KEYS.port),
    getSettingValue(pool, SMTP_SETTING_KEYS.user),
    getSettingValue(pool, SMTP_SETTING_KEYS.pass),
    getSettingValue(pool, SMTP_SETTING_KEYS.from),
  ]);
  const passRaw = firstVal(process.env.SMTP_PASS, dbPassRaw);
  let source = null;
  if (process.env.SMTP_HOST || process.env.SMTP_USER || process.env.SMTP_PASS) {
    source = 'env';
  } else if (dbHost || dbUser || dbPassRaw) {
    source = 'settings';
  }
  return {
    host: firstVal(process.env.SMTP_HOST, dbHost),
    port: firstVal(process.env.SMTP_PORT, dbPort),
    user: firstVal(process.env.SMTP_USER, dbUser),
    pass: passRaw
      ? String(passRaw).startsWith('enc:v1:') ? decryptSecret(passRaw) : passRaw
      : null,
    from: firstVal(process.env.MAIL_FROM, dbFrom),
    source,
  };
}

/** Can a mail go out right now? (host + user + pass; port/from are optional) */
export function smtpConfigComplete(fields) {
  return Boolean(fields && fields.host && fields.user && fields.pass);
}

function buildTransport(fields) {
  const port = Number(fields.port) || 587;
  return nodemailer.createTransport({
    host: fields.host,
    port,
    secure: port === 465,
    auth: { user: fields.user, pass: fields.pass },
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

/**
 * Sends one marketing mail. SMTP comes from resolveSmtpFields() — a missing
 * host/user/pass throws with code SMTP_NOT_CONFIGURED (the route surfaces the
 * "save it in Settings" guidance to the UI).
 */
export async function sendCampaignMail(pool, { to, subject, text, name }) {
  const fields = await resolveSmtpFields(pool);
  if (!smtpConfigComplete(fields)) {
    const err = new Error(
      'Email sending is not configured. Open Admin → Settings → Email Marketing → SMTP and save a host, user and password (or set SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env and restart).'
    );
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  const from = fields.from || fields.user;
  const greeting = name ? `Hi ${name.split(' ')[0]},\n\n` : '';
  return buildTransport(fields).sendMail({
    from,
    to,
    subject,
    text: `${greeting}${text}\n\n— Erlbrew Café\n`,
    html: plainTextToHtml(`${greeting}${text}`),
  });
}
