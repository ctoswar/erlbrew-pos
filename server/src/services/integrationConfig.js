import crypto from 'crypto';

// ─── Encryption at rest (AES-256-GCM) ────────────────────────────────────────
// Key derived from INTEGRATION_ENC_KEY (preferred) or JWT_SECRET (fallback).
const ENC_PREFIX = 'enc:v1:';

function getEncKey() {
  const material = process.env.INTEGRATION_ENC_KEY || process.env.JWT_SECRET;
  if (!material) throw new Error('No INTEGRATION_ENC_KEY or JWT_SECRET available for secret encryption');
  return crypto.scryptSync(material, 'erlbrew-integrations-v1', 32);
}

export function encryptSecret(plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  const s = String(plain);
  if (s.startsWith(ENC_PREFIX)) return s; // already encrypted
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncKey(), iv);
  const ct = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + [iv, tag, ct].map(b => b.toString('base64')).join(':');
}

export function decryptSecret(stored) {
  if (stored === null || stored === undefined) return '';
  const s = String(stored);
  if (!s.startsWith(ENC_PREFIX)) return s; // legacy plaintext (dev) — pass through
  try {
    const [ivB, tagB, ctB] = s.slice(ENC_PREFIX.length).split(':');
    const d = crypto.createDecipheriv('aes-256-gcm', getEncKey(), Buffer.from(ivB, 'base64'));
    d.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ctB, 'base64')), d.final()]).toString('utf8');
  } catch {
    console.error('[integrations] Failed to decrypt secret (key rotated or corrupt)');
    return '';
  }
}

/** Mask a secret for display: keep first 4 + last 4 for long values. Never returns the full value. */
export function maskSecret(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length <= 12) return '••••••••';
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

// ─── Provider definitions ────────────────────────────────────────────────────
// Each field: { env: env-var override, setting: company_settings key, secret: encrypt+mask }
export const PROVIDERS = {
  paymongo: {
    label: 'PayMongo',
    fields: {
      secret_key: { env: 'PAYMONGO_SECRET_KEY', setting: 'paymongo_secret_key', secret: true },
      webhook_secret: { env: 'PAYMONGO_WEBHOOK_SECRET', setting: 'paymongo_webhook_secret', secret: true },
      mode: { env: 'PAYMONGO_MODE', setting: 'paymongo_mode' }, // test | live
    },
    enabledEnv: 'PAYMONGO_ENABLED',
    enabledSetting: 'paymongo_enabled',
  },
  grab: {
    label: 'GrabFood',
    fields: {
      client_id: { env: 'GRAB_CLIENT_ID', setting: 'grab_client_id' },
      client_secret: { env: 'GRAB_CLIENT_SECRET', setting: 'grab_client_secret', secret: true },
      merchant_id: { env: 'GRAB_MERCHANT_ID', setting: 'grab_merchant_id' },
      webhook_secret: { env: 'GRAB_WEBHOOK_SECRET', setting: 'grab_webhook_secret', secret: true },
    },
    enabledEnv: 'GRAB_ENABLED',
    enabledSetting: 'grab_enabled',
  },
  foodpanda: {
    label: 'FoodPanda',
    fields: {
      api_key: { env: 'FOODPANDA_API_KEY', setting: 'foodpanda_api_key', secret: true },
      vendor_id: { env: 'FOODPANDA_VENDOR_ID', setting: 'foodpanda_vendor_id' },
      webhook_secret: { env: 'FOODPANDA_WEBHOOK_SECRET', setting: 'foodpanda_webhook_secret', secret: true },
    },
    enabledEnv: 'FOODPANDA_ENABLED',
    enabledSetting: 'foodpanda_enabled',
  },
};

async function getSetting(pool, key) {
  try {
    const [rows] = await pool.execute(
      `SELECT setting_value FROM company_settings WHERE setting_key = ?`, [key]
    );
    return rows.length > 0 ? rows[0].setting_value : null;
  } catch {
    return null; // table may not exist yet
  }
}

/**
 * Resolve a provider field value: env var › DB (decrypted) › null.
 */
export async function resolveField(pool, provider, fieldKey) {
  const def = PROVIDERS[provider]?.fields?.[fieldKey];
  if (!def) return null;
  if (def.env && process.env[def.env]) return process.env[def.env];
  const raw = await getSetting(pool, def.setting);
  if (raw === null || raw === '') return null;
  return def.secret ? decryptSecret(raw) : raw;
}

/**
 * Resolve a secret for server-side use (webhook verification, API auth).
 * Returns null when unavailable.
 */
export async function getSecret(pool, provider, fieldKey) {
  return resolveField(pool, provider, fieldKey);
}

/**
 * Provider enabled? env flag › DB setting. Defaults to disabled (integrations ship dark).
 */
export async function isProviderEnabled(pool, provider) {
  const def = PROVIDERS[provider];
  if (!def) return false;
  const envVal = def.enabledEnv ? process.env[def.enabledEnv] : undefined;
  if (envVal !== undefined) return ['1', 'true', 'yes', 'on'].includes(String(envVal).toLowerCase());
  const dbVal = await getSetting(pool, def.enabledSetting);
  if (dbVal === null || dbVal === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(String(dbVal).toLowerCase());
}

/** Public base URL for webhook links: env › DB 'base_url' › null. */
export async function getBaseUrl(pool) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/, '');
  const v = await getSetting(pool, 'base_url');
  return v ? String(v).replace(/\/+$/, '') : null;
}

export async function getWebhookUrl(pool, provider) {
  const base = await getBaseUrl(pool);
  return base ? `${base}/api/webhooks/${provider}` : null;
}

/**
 * Masked view of one provider for the Settings UI (admin GET).
 * Never returns raw secret values — only masked previews + "configured" flags.
 */
export async function getProviderStatus(pool, provider) {
  const def = PROVIDERS[provider];
  if (!def) return null;
  const fields = {};
  for (const [key, fDef] of Object.entries(def.fields)) {
    const value = await resolveField(pool, provider, key);
    fields[key] = fDef.secret
      ? { configured: !!value, masked: maskSecret(value) }
      : { configured: !!value, value: value || '' };
  }
  return {
    label: def.label,
    enabled: await isProviderEnabled(pool, provider),
    webhook_url: await getWebhookUrl(pool, provider),
    fields,
  };
}

/**
 * Persist provider fields to company_settings (encrypted when secret).
 * - undefined value → skip (unchanged)
 * - null value → clear (delete setting)
 * - '' → skip (unchanged; use null to clear)
 */
export async function saveProviderFields(pool, provider, updates) {
  const def = PROVIDERS[provider];
  if (!def) throw new Error(`Unknown provider: ${provider}`);
  const saved = [];
  for (const [key, value] of Object.entries(updates)) {
    const fDef = def.fields[key];
    if (!fDef) continue;
    if (value === undefined || value === '') continue;
    if (value === null) {
      await pool.execute(`DELETE FROM company_settings WHERE setting_key = ?`, [fDef.setting]);
      saved.push(key);
      continue;
    }
    const stored = fDef.secret ? encryptSecret(String(value)) : String(value);
    await pool.execute(
      `INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [fDef.setting, stored]
    );
    saved.push(key);
  }
  return saved;
}
