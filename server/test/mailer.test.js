import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'mailer-test-secret';

const {
  resolveSmtpFields,
  smtpConfigComplete,
  validateCampaign,
  buildRecipientList,
  plainTextToHtml,
  sendCampaignMail,
  MAX_SUBJECT_LENGTH,
  MAX_BODY_LENGTH,
} = await import('../src/services/mailer.js');
const { encryptSecret } = await import('../src/services/integrationConfig.js');

/** pool-shaped fake that answers the company_settings lookups with a map */
function fakeSettingsPool(values) {
  return {
    query: async (_sql, params) => {
      const key = params[0];
      const v = values[key];
      return v != null ? [[{ setting_value: v }]] : [[]];
    },
  };
}

/** clean env save/restore so SMTP resolution tests don't leak state */
function envSnapshot(names) {
  const snap = {};
  for (const n of names) snap[n] = process.env[n];
  return {
    restore() {
      for (const n of names) {
        if (snap[n] === undefined) delete process.env[n];
        else process.env[n] = snap[n];
      }
    },
  };
}

const SMTP_ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];

test('validateCampaign accepts a clean subject + body', () => {
  assert.equal(validateCampaign({ subject: 'Double-double weekend!', body: 'Two stamps per drink until Sunday.' }), null);
});

test('validateCampaign rejects empty / whitespace-only fields', () => {
  assert.equal(validateCampaign({ subject: '', body: 'x' }), 'Subject is required');
  assert.equal(validateCampaign({ subject: '   ', body: 'x' }), 'Subject is required');
  assert.equal(validateCampaign({ subject: 'Hi', body: '' }), 'Body is required');
  assert.equal(validateCampaign({ subject: 'Hi', body: '   ' }), 'Body is required');
  assert.equal(validateCampaign({}), 'Subject is required');
});

test('validateCampaign enforces length limits', () => {
  assert.equal(
    validateCampaign({ subject: 'a'.repeat(MAX_SUBJECT_LENGTH + 1), body: 'x' }),
    `Subject must be at most ${MAX_SUBJECT_LENGTH} characters`,
  );
  assert.equal(
    validateCampaign({ subject: 'Ok', body: 'b'.repeat(MAX_BODY_LENGTH + 1) }),
    `Body must be at most ${MAX_BODY_LENGTH} characters`,
  );
});

test('buildRecipientList dedupes emails case-insensitively and keeps order', () => {
  const { recipients, skipped } = buildRecipientList([
    { id: 1, email: 'Jane@example.com', name: 'Jane Dela Cruz' },
    { id: 2, email: 'jane@example.com', name: 'Duplicate Jane' },
    { id: 3, email: 'marco@example.com', name: '' },
  ]);
  assert.deepEqual(recipients.map((r) => r.email), ['jane@example.com', 'marco@example.com']);
  assert.equal(recipients[0].name, 'Jane Dela Cruz');
  assert.equal(recipients[0].id, 1); // first row wins, duplicates dropped
  assert.equal(recipients[1].name, null);
  assert.deepEqual(skipped, []);
});

test('buildRecipientList skips missing and malformed emails (reports ids)', () => {
  const { recipients, skipped } = buildRecipientList([
      { id: 4, email: null, name: 'No Email' },
      { id: 5, email: '   ', name: 'Blank' },
      { id: 6, email: 'not-an-email', name: 'Broken' },
      { id: 7, email: 'jose@erlbrew.ph', name: 'Jose' },
  ]);
  assert.deepEqual(recipients.map((r) => r.email), ['jose@erlbrew.ph']);
  assert.deepEqual(skipped, [4, 5, 6]);
});

test('plainTextToHtml escapes markup and breaks paragraphs on blank lines', () => {
  const html = plainTextToHtml('Buy one get one <free> & happy\nHappy hour 10% off\n\n<script>alert(1)</script>');
  assert.ok(!html.includes('<free>'));
  assert.ok(html.includes('&lt;free&gt;'));
  assert.ok(html.includes('&amp;'));
  assert.ok(html.includes('&lt;script&gt;'));
  // A single newline becomes <br/>; a blank line splits paragraphs
  assert.ok(html.includes('<br/>'));
  const paragraphs = html.match(/<p /g) || [];
  assert.equal(paragraphs.length, 2);
});

test('resolveSmtpFields reads company_settings, decrypting the stored password', async () => {
  const env = envSnapshot([...SMTP_ENV]);
  for (const n of SMTP_ENV) delete process.env[n];
  const pool = fakeSettingsPool({
    smtp_host: 'smtp.erlbrew.ph',
    smtp_port: '465',
    smtp_user: 'ads@erlbrew.ph',
    smtp_pass: encryptSecret('topsecret'),
    smtp_mail_from: 'hello@erlbrew.ph',
  });
  const fields = await resolveSmtpFields(pool);
  assert.equal(fields.host, 'smtp.erlbrew.ph');
  assert.equal(fields.port, '465');
  assert.equal(fields.user, 'ads@erlbrew.ph');
  assert.equal(fields.pass, 'topsecret'); // decrypted from enc:v1: payload
  assert.equal(fields.from, 'hello@erlbrew.ph');
  assert.equal(fields.source, 'settings');
  assert.equal(smtpConfigComplete(fields), true);
  env.restore();
});

test('resolveSmtpFields: env wins per field, nothing saved → not configured', async () => {
  const env = envSnapshot([...SMTP_ENV]);
  for (const n of SMTP_ENV) delete process.env[n];
  const empty = await resolveSmtpFields(fakeSettingsPool({}));
  assert.equal(empty.source, null);
  assert.equal(smtpConfigComplete(empty), false);

  process.env.SMTP_HOST = 'smtp.ph';
  process.env.SMTP_USER = 'env@erlbrew.ph';
  process.env.SMTP_PASS = 'envpass';
  const mixed = await resolveSmtpFields(
    fakeSettingsPool({ smtp_host: 'db.ph', smtp_pass: encryptSecret('dbpass') })
  );
  assert.equal(mixed.host, 'smtp.ph'); // env › settings for host
  assert.equal(mixed.pass, 'envpass'); // env › settings for pass
  assert.equal(mixed.source, 'env');
  assert.equal(smtpConfigComplete(mixed), true);
  env.restore();
});

test('sendCampaignMail refuses to run while SMTP is unconfigured', async () => {
  const env = envSnapshot([...SMTP_ENV]);
  for (const n of SMTP_ENV) delete process.env[n];
  await assert.rejects(
    () => sendCampaignMail(fakeSettingsPool({}), { to: 'jane@example.com', subject: 'Hi', text: 'Sale', name: 'Jane' }),
    (e) => e.code === 'SMTP_NOT_CONFIGURED' && /Email Marketing/.test(e.message),
  );
  env.restore();
});
