// ── Customer PII encryption at rest ─────────────────────────────────────────
// Columns holding phone/name/email are encrypted in the database:
//
//   • Reversible fields (displayed in the admin UI / profile endpoints) use
//     AES-256-GCM — random 12-byte IV + auth tag. Ciphertext is stored as
//     "enc:v1:<base64(iv|tag|ciphertext)>".
//   • Lookup fields that need UNIQUE indexes and WHERE = searches (phone,
//     email) also get a deterministic HMAC-SHA256 hash, truncated to 32 hex
//     chars so it fits the legacy VARCHAR(32) column and index.
//
// Keys are derived from one master secret (CUSTOMER_ENCRYPTION_KEY, 32-byte
// hex in server/.env) via HKDF with separate info labels. The secret lives
// only in the environment — never in the database.
import crypto from 'crypto';

const MASTER_KEY_HEX = process.env.CUSTOMER_ENCRYPTION_KEY || '';

if (!/^[0-9a-fA-F]{64}$/.test(MASTER_KEY_HEX)) {
  throw new Error(
    'CUSTOMER_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars). ' +
    'Generate one with: openssl rand -hex 32'
  );
}

const [encryptionKey, hmacKey] = [
  { key: MASTER_KEY_HEX, salt: 'erlbrew-pii-enc-salt', info: 'customer-aes-256-gcm' },
  { key: MASTER_KEY_HEX, salt: 'erlbrew-pii-hmac-salt', info: 'customer-hmac-sha256' },
].map(({ key, salt, info }) =>
  Buffer.from(crypto.hkdfSync('sha256', Buffer.from(key, 'hex'), Buffer.from(salt), Buffer.from(info), 32))
);

const ENC_PREFIX = 'enc:v1:';

/** AES-256-GCM encrypt plaintext; returns `enc:v1:<base64(iv|tag|ct)>` or null. */
export function encryptPii(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const value = String(plaintext);
  if (value === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
}

/** Decrypt an `enc:v1:` payload. Non-encrypted input passes through untouched
 *  (legacy/migration safety — callers can decrypt whatever is in the column). */
export function decryptPii(value) {
  if (value === null || value === undefined) return null;
  if (!String(value).startsWith(ENC_PREFIX)) return value;
  const packed = Buffer.from(String(value).slice(ENC_PREFIX.length), 'base64');
  if (packed.length < 12 + 16 + 1) return null;
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (error) {
    // Wrong key / tampered payload — never return garbage.
    console.error('[piiCrypto] PII decryption failed:', error.message);
    return null;
  }
}

/** Deterministic phone lookup hash — HMAC-SHA256 trimmed to 32 hex chars
 *  (fits VARCHAR(32) / UNIQUE index of the legacy phone column). */
export function phoneHash(phone) {
  return hmac32(String(phone ?? '').trim());
}

/** Deterministic email lookup hash — lowercased before hashing so
 *  case-insensitive lookups behave like the old LOWER(email) queries. */
export function emailHash(email) {
  return hmac32(String(email ?? '').trim().toLowerCase());
}

function hmac32(value) {
  return crypto.createHmac('sha256', hmacKey).update(value).digest('hex').slice(0, 32);
}

/** Decrypt every `_enc` column of a raw DB row into the API shape used
 *  before encryption (phone, email, name, first_name, last_name, notes). */
export function decryptCustomerRow(row) {
  if (!row) return row;
  const { phone_enc, email_enc, name_enc, first_name_enc, last_name_enc, notes_enc, ...rest } = row;
  return {
    ...rest,
    phone: decryptPii(phone_enc),
    email: decryptPii(email_enc),
    name: decryptPii(name_enc),
    first_name: decryptPii(first_name_enc),
    last_name: decryptPii(last_name_enc),
    notes: decryptPii(notes_enc),
  };
}
