import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'pii-test-secret';
process.env.CUSTOMER_ENCRYPTION_KEY = 'a'.repeat(64);

const {
  encryptPii,
  decryptPii,
  phoneHash,
  emailHash,
  decryptCustomerRow,
} = await import('../src/services/piiCrypto.js');

test('encrypt → decrypt roundtrip preserves the value', () => {
  const value = 'Jane Dela Cruz';
  const encrypted = encryptPii(value);
  assert.match(encrypted, /^enc:v1:/);
  assert.equal(decryptPii(encrypted), value);
});

test('ciphertext differs between calls (random IV) but both decrypt', () => {
  const a = encryptPii('09171234567');
  const b = encryptPii('09171234567');
  assert.notEqual(a, b);
  assert.equal(decryptPii(a), '09171234567');
  assert.equal(decryptPii(b), '09171234567');
});

test('null and empty encrypt to null; non-encrypted values pass through decrypt', () => {
  assert.equal(encryptPii(null), null);
  assert.equal(encryptPii(undefined), null);
  assert.equal(encryptPii(''), null);
  // Legacy/plaintext passthrough
  assert.equal(decryptPii(null), null);
  assert.equal(decryptPii('plainvalue'), 'plainvalue');
});

test('tampered ciphertext fails closed (no partial value leaks)', () => {
  const encrypted = encryptPii('secret@example.com');
  const buf = Buffer.from(encrypted.slice('enc:v1:'.length), 'base64');
  buf[buf.length - 1] ^= 0xFF;
  const tampered = `enc:v1:${buf.toString('base64')}`;
  assert.equal(decryptPii(tampered), null);
});

test('phone hashes are deterministic and 32 hex chars', () => {
  const first = phoneHash('09171234567');
  const second = phoneHash('09171234567');
  assert.equal(first, second);
  assert.equal(first.length, 32);
  assert.match(first, /^[0-9a-f]+$/);
  assert.notEqual(first, phoneHash('09171234568'));
});

test('email hashes ignore case, differ per address', () => {
  assert.equal(emailHash('User@Example.COM'), emailHash('user@example.com'));
  assert.notEqual(emailHash('user@example.com'), emailHash('other@example.com'));
});

test('decryptCustomerRow maps _enc columns back to API shape', () => {
  const row = {
    id: 1,
    phone_enc: encryptPii('09171234567'),
    email_enc: encryptPii('jane@example.com'),
    name_enc: encryptPii('Jane Dela Cruz'),
    first_name_enc: encryptPii('Jane'),
    last_name_enc: null,
    username: 'jane',
    loyalty_points: 120,
  };
  const out = decryptCustomerRow(row);
  assert.equal(out.phone, '09171234567');
  assert.equal(out.email, 'jane@example.com');
  assert.equal(out.name, 'Jane Dela Cruz');
  assert.equal(out.first_name, 'Jane');
  assert.equal(out.last_name, null);
  assert.equal(out.username, 'jane');
});
