// One-shot migration: encrypt customer PII at rest in the customers table.
//
//   • Adds *_hash (deterministic HMAC, for UNIQUE/lookup) and *_enc
//     (AES-256-GCM) columns for phone and email, plus *_enc for the
//     display-only name fields (name, first_name, last_name).
//   • Fills them from the existing plaintext columns.
//   • Verifies every row (all hashes populated, ciphertext decrypts).
//   • Drops the plaintext columns and their unique/index keys.
//
// Idempotent: safe to run twice. Requires CUSTOMER_ENCRYPTION_KEY in the
// environment (the API refuses to import without it after this lands).
//
// Run inside the api container:
//   docker compose -f infra/docker-compose.yml run --rm erlbw-api \
//     node src/scripts/encryptCustomers.js
import mysql from 'mysql2/promise';
import {
  encryptPii,
  decryptPii,
  phoneHash,
  emailHash,
} from '../services/piiCrypto.js';

const INTEGRAL_URL = process.env.DATABASE_URL;
if (!INTEGRAL_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const ENC_V1_PREFIX = 'enc:v1:';

const pool = mysql.createPool({ uri: INTEGRAL_URL, connectionLimit: 4 });

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, index) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = ?`,
    [index]
  );
  return rows.length > 0;
}

const encColumns = [
  'phone_enc VARCHAR(255) DEFAULT NULL',
  'email_hash VARCHAR(32) DEFAULT NULL',
  'email_enc VARCHAR(255) DEFAULT NULL',
  'name_enc VARCHAR(511) DEFAULT NULL',
  'first_name_enc VARCHAR(255) DEFAULT NULL',
  'last_name_enc VARCHAR(255) DEFAULT NULL',
  'notes_enc TEXT DEFAULT NULL',
];

const conn = await pool.getConnection();
try {
  await conn.beginTransaction();

  // ── 1. Schema: add hash/enc columns ──────────────────────────────────────
  if (!(await columnExists(conn, 'customers', 'phone_hash'))) {
    // Nullable + unindexed first — uniqueness is enforced after the fill.
    await conn.query('ALTER TABLE customers ADD COLUMN phone_hash VARCHAR(32) DEFAULT NULL');
    console.log('[Migrations] added customers.phone_hash');
  }
  for (const [idx, col] of encColumns.entries()) {
    const name = col.split(' ')[0];
    if (!(await columnExists(conn, 'customers', name))) {
      await conn.query(`ALTER TABLE customers ADD COLUMN ${col}`);
      console.log(`[Migrations] added customers.${name}`);
    }
  }

  // ── 2. Fill from plaintext (or leave already-encrypted rows alone) ──────
  const [rows] = await conn.query('SELECT * FROM customers');
  let migrated = 0;

  for (const row of rows) {
    // decryptPii passes legacy plaintext through unchanged, so re-running on
    // a part-migrated table never double-encrypts existing ciphertext.
    const phone = typeof row.phone_enc === 'string' ? decryptPii(row.phone_enc) : row.phone;
    const email = typeof row.email_enc === 'string' ? decryptPii(row.email_enc) : row.email;
    const name = typeof row.name_enc === 'string' ? decryptPii(row.name_enc) : row.name;
    const firstName = typeof row.first_name_enc === 'string' ? decryptPii(row.first_name_enc) : row.first_name;
    const lastName = typeof row.last_name_enc === 'string' ? decryptPii(row.last_name_enc) : row.last_name;

    if (!phone) {
      console.error(`[Migrations] customer id=${row.id} has no phone value — cannot build phone_hash`);
      process.exit(1);
    }
    // Guard: the *_enc cells must be NULL or already ciphertext. If anything
    // wrote plaintext into an encrypted column, stop before destroying data.
    for (const [label, cell] of [
      ['phone_enc', row.phone_enc], ['email_enc', row.email_enc], ['name_enc', row.name_enc],
      ['first_name_enc', row.first_name_enc], ['last_name_enc', row.last_name_enc], ['notes_enc', row.notes_enc],
    ]) {
      if (typeof cell === 'string' && cell !== '' && !cell.startsWith(ENC_V1_PREFIX)) {
        console.error(`[Migrations] customer id=${row.id} ${label} is not ciphertext — aborting`);
        process.exit(1);
      }
    }

    await conn.query(
      `UPDATE customers SET
         phone_hash = ?, phone_enc = ?,
         email_hash = ?, email_enc = ?,
         name_enc = ?, first_name_enc = ?, last_name_enc = ?
       WHERE id = ?`,
      [
        phoneHash(phone), encryptPii(phone),
        email ? emailHash(email) : null, encryptPii(email),
        encryptPii(name), encryptPii(firstName), encryptPii(lastName),
        row.id,
      ]
    );
    migrated += 1;
  }

  // ── 3. Enforce NOT NULL + uniqueness on the phone hash lookup key ───────
  await conn.query('ALTER TABLE customers MODIFY phone_hash VARCHAR(32) NOT NULL');
  if (!(await indexExists(conn, 'uniq_customers_phone_hash'))) {
    await conn.query('ALTER TABLE customers ADD UNIQUE KEY uniq_customers_phone_hash (phone_hash)');
    console.log('[Migrations] unique key on phone_hash created');
  }
  if (!(await indexExists(conn, 'idx_customers_email_hash'))) {
    await conn.query('ALTER TABLE customers ADD KEY idx_customers_email_hash (email_hash)');
    console.log('[Migrations] index on email_hash created');
  }

  // ── 3b. Notes — staff free-text that can hold PII (phone numbers, names) ─
  // Legacy plaintext `notes` → ciphertext `notes_enc`, then the column drops.
  const hasLegacyNotes = await columnExists(conn, 'customers', 'notes');
  if (hasLegacyNotes) {
    const [noteRows] = await conn.query('SELECT id, notes, notes_enc FROM customers');
    let notesMigrated = 0;
    for (const row of noteRows) {
      const value = typeof row.notes_enc === 'string' && row.notes_enc.startsWith(ENC_V1_PREFIX)
        ? row.notes_enc
        : encryptPii(row.notes);
      if (typeof row.notes_enc === 'string' && row.notes_enc !== '' && !row.notes_enc.startsWith(ENC_V1_PREFIX)) {
        console.error(`[Migrations] customer id=${row.id} notes_enc is not ciphertext — aborting`);
        process.exit(1);
      }
      await conn.query('UPDATE customers SET notes_enc = ? WHERE id = ?', [value, row.id]);
      notesMigrated += 1;
    }
    console.log(`[Migrations] notes migrated to ciphertext for ${notesMigrated} rows`);
  }

  // ── 4. Verify: roundtrip every row before destroying plaintext ──────────
  const [verifyRows] = await conn.query(
    'SELECT phone_hash, phone_enc, email_hash, email_enc, name_enc, first_name_enc, last_name_enc FROM customers'
  );
  for (const row of verifyRows) {
    const phone = decryptPii(row.phone_enc);
    if (!phone || phoneHash(phone) !== row.phone_hash) {
      console.error('[Migrations] verify failed for a row (phone roundtrip) — aborting, plaintext columns kept');
      process.exit(1);
    }
    if (row.email_enc) {
      const email = decryptPii(row.email_enc);
      if (!email || emailHash(email) !== row.email_hash) {
        console.error('[Migrations] verify failed for a row (email roundtrip) — aborting, plaintext columns kept');
        process.exit(1);
      }
    }
  }
  console.log(`[Migrations] verified ${verifyRows.length} rows decrypt + hash-match`);

  // ── 5. Drop plaintext columns and their indexes/unique keys ─────────────
  for (const index of ['phone', 'idx_phone', 'idx_name']) {
    if (await indexExists(conn, index)) {
      await conn.query(`ALTER TABLE customers DROP INDEX \`${index}\``);
      console.log(`[Migrations] dropped index ${index}`);
    }
  }
  for (const column of ['phone', 'name', 'email', 'first_name', 'last_name', 'notes']) {
    if (await columnExists(conn, 'customers', column)) {
      await conn.query(`ALTER TABLE customers DROP COLUMN \`${column}\``);
      console.log(`[Migrations] dropped plaintext column customers.${column}`);
    }
  }

  await conn.commit();
  console.log(`[Migrations] customers PII encryption complete — ${migrated} rows migrated`);
} catch (error) {
  await conn.rollback();
  console.error('[Migrations] migration failed:', error);
  process.exitCode = 1;
} finally {
  conn.release();
  await pool.end();
}
