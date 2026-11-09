// SMTP mailer for marketing campaigns. Dark-launch: without SMTP env vars
// configured every send is rejected with a clear message instead of trying
// to auth with empty credentials.
//
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, MAIL_FROM
//
// Pure helpers (validation, recipient dedupe, plain→HTML body) are exported
// separately for unit tests.

import nodemailer from 'nodemailer';

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 10000;
export const MAX_RECIPIENTS = 2000;

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function mailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || null;
}

function transport() {
  if (!smtpConfigured()) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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

export async function sendCampaignMail({ to, subject, text, name }) {
  const tx = transport();
  if (!tx) {
    const err = new Error(
      'Email sending is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (and optional MAIL_FROM) to server/.env and restart.'
    );
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  const greeting = name ? `Hi ${name.split(' ')[0]},\n\n` : '';
  return tx.sendMail({
    from: mailFrom(),
    to,
    subject,
    text: `${greeting}${text}\n\n— Erlbrew Café\n`,
    html: plainTextToHtml(`${greeting}${text}`),
  });
}
