import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  smtpConfigured,
  mailFrom,
  validateCampaign,
  buildRecipientList,
  plainTextToHtml,
  sendCampaignMail,
  MAX_SUBJECT_LENGTH,
  MAX_BODY_LENGTH,
} = await import('../src/services/mailer.js');

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

test('mailFrom falls back to SMTP_USER when MAIL_FROM is unset', async () => {
  const prev = { host: process.env.SMTP_HOST, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.MAIL_FROM };
  process.env.SMTP_HOST = 'smtp.test.ph';
  process.env.SMTP_USER = 'ads@erlbrew.ph';
  process.env.SMTP_PASS = 'secret';
  delete process.env.MAIL_FROM;
  const mailer = await import('../src/services/mailer.js');
  assert.equal(mailer.smtpConfigured(), true);
  assert.equal(mailer.mailFrom(), 'ads@erlbrew.ph');
  Object.assign(process.env, prev);
});

test('sendCampaignMail refuses to run while SMTP is unconfigured', async () => {
  const prev = { host: process.env.SMTP_HOST, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  const mailer = await import('../src/services/mailer.js');
  await assert.rejects(
    () => mailer.sendCampaignMail({ to: 'jane@example.com', subject: 'Hi', text: 'Sale', name: 'Jane' }),
    (e) => e.code === 'SMTP_NOT_CONFIGURED' && /SMTP_HOST/.test(e.message),
  );
  Object.assign(process.env, prev);
});
