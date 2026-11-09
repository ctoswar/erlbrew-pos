// One-shot cleanup: redact plaintext customer PII stored in audit_logs.
//
// Before the at-rest encryption landed, customer actions recorded raw
// phone/name/email values inside the `details` JSON. Those entries are the
// remaining plaintext copies of the data the customers table no longer
// holds. Only rows for customer entities are touched — `details.name` on
// menu/inventory/staff rows is legitimate audit data and stays.
//
// Keys redacted (replaced with "[redacted]"): phone, email, name,
// identifier, customer_name, customerName, first_name, last_name.
//
// Idempotent: rows whose keys are already hashed/normalized (phone_hash,
// email_norm, identifier_norm, ...) are left alone by the key match, and
// already "[redacted]" values stay as-is.
//
// Run inside the api container:
//   docker compose -f infra/docker-compose.yml run --rm erlbw-api \
//     node src/scripts/redactAuditPii.js
import mysql from 'mysql2/promise';

const PII_KEYS = new Set([
  'phone', 'email', 'name', 'identifier', 'customer_name', 'customerName',
  'first_name', 'last_name', 'firstName', 'lastName',
]);

const REPLACEMENT = '[redacted]';

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 4 });
const conn = await pool.getConnection();

try {
  const [rows] = await conn.query(
    `SELECT id, action, details FROM audit_logs
     WHERE entity_type = 'customer' AND details IS NOT NULL`
  );

  let redacted = 0;
  for (const row of rows) {
    let details;
    try {
      details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
    } catch {
      continue; // not JSON — leave alone
    }
    if (!details || typeof details !== 'object') continue;

    let changed = false;
    for (const key of Object.keys(details)) {
      if (PII_KEYS.has(key) && typeof details[key] === 'string' && details[key] !== REPLACEMENT) {
        details[key] = REPLACEMENT;
        changed = true;
      }
    }
    if (changed) {
      await conn.query('UPDATE audit_logs SET details = ? WHERE id = ?', [JSON.stringify(details), row.id]);
      redacted += 1;
    }
  }

  console.log(`[Redaction] scanned ${rows.length} customer audit rows — redacted plaintext from ${redacted}`);
} catch (error) {
  console.error('[Redaction] failed:', error);
  process.exitCode = 1;
} finally {
  conn.release();
  await pool.end();
}
