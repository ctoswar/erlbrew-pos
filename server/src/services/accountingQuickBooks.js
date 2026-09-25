// ─── QuickBooks Online accounting integration ─────────────────────────────────
// Phase 2 / Roadmap → "Accounting → QuickBooks Integration (Invoice sync,
// Expense tracking)".
//
// Design: ready-for-credentials. Client credentials (client_id / client_secret)
// live in the normal PROVIDERS store; OAuth access/refresh tokens live in
// company_settings under their own keys (encrypted at rest). Every live API
// call is gated on a stored token, so with no credentials configured the whole
// flow still runs in **dry-run** and returns the exact payloads it would have
// sent — that is what makes this testable before an Intuit app exists.
//
// Sync model (chosen with the user):
//   • Invoice sync    → one *daily summary* invoice per calendar day of
//                       completed POS orders, auto-triggered after a Z-Report
//                       and on demand for a date range.
//   • Expense tracking→ one *Bill* per Supplier Invoice (existing module).

import crypto from 'crypto';
import {
  PROVIDERS,
  resolveField,
  isProviderEnabled,
  getBaseUrl,
  encryptSecret,
  decryptSecret,
} from './integrationConfig.js';

export const PROVIDER = 'quickbooks';

// ─── OAuth2 / API endpoints (Intuit) ──────────────────────────────────────────
const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth2.intuit.com/oauth2/v1/tokens/bearer';
const SCOPE = 'com.intuit.quickbooks.accounting';
const MINOR_VERSION = '75';
const API_HOST = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
};

// company_settings keys (not exposed via PROVIDERS — tokens are never listed in
// the settings UI, only a masked "connected" indicator).
const SETTING = {
  accessToken: 'quickbooks_access_token',
  refreshToken: 'quickbooks_refresh_token',
  expiresAt: 'quickbooks_token_expires_at',
  realmId: 'quickbooks_realm_id',
  connectedAt: 'quickbooks_connected_at',
  oauthState: 'quickbooks_oauth_state',
  oauthStateExp: 'quickbooks_oauth_state_exp',
};

// ─── Small helpers ────────────────────────────────────────────────────────────
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inclusive list of YYYY-MM-DD strings; cap keeps a fat-fingered range harmless. */
export function enumerateDates(start, end, maxDays = 92) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    throw new Error('Dates must be YYYY-MM-DD');
  }
  if (e < s) throw new Error('end date is before start date');
  const out = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    if (out.length >= maxDays) throw new Error(`Range too large (max ${maxDays} days)`);
    out.push(toISODate(d));
  }
  return out;
}

/** pay_method → readable label for invoice line descriptions. */
export function payMethodLabel(method) {
  const m = String(method || '').toLowerCase();
  if (m === 'cash') return 'Cash';
  if (m === 'card') return 'Card';
  if (m === 'ewallet' || m === 'e-wallet') return 'E-wallet';
  if (m === 'delivery') return 'Delivery';
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Other';
}

// ─── Mappers (pure — covered by server/test/accountingQuickBooks.test.js) ─────

/**
 * Daily summary of completed orders → a QBO Invoice payload.
 *
 * Lines are grouped by payment method on the *net* (subtotal) amount, plus one
 * tax line, so the line items always sum to the day's gross total. The full
 * breakdown also lands in PrivateNote so an accountant can reconcile against
 * the Z-Report without opening QBO line by line.
 *
 * @param {object} args
 * @param {string} args.date      YYYY-MM-DD (TxnDate)
 * @param {Array}  args.orders    rows: { pay_method, subtotal, tax, total }
 * @param {string} [args.itemRef] QBO income ItemRef (default "1" = Services)
 * @param {string} [args.customerRef]
 * @param {string} [args.customerName]
 * @returns {object|null} QBO Invoice payload, or null when there is nothing to sync
 */
export function buildDailySalesPayload({
  date,
  orders,
  itemRef = '1',
  customerRef = '1',
  customerName = 'Walk-in Sales',
}) {
  if (!Array.isArray(orders) || orders.length === 0) return null;

  const byMethod = new Map();
  let net = 0;
  let tax = 0;
  let gross = 0;

  for (const o of orders) {
    const sub = Number(o.subtotal) || 0;
    const t = Number(o.tax) || 0;
    const g = o.total != null ? Number(o.total) : sub + t;
    const key = payMethodLabel(o.pay_method);
    byMethod.set(key, round2((byMethod.get(key) || 0) + sub));
    net = round2(net + sub);
    tax = round2(tax + t);
    gross = round2(gross + g);
  }

  const lines = [];
  for (const [label, amount] of byMethod) {
    if (amount <= 0) continue;
    lines.push({
      Amount: amount,
      Description: `${label} sales (${orders.length} order${orders.length === 1 ? '' : 's'})`,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: { ItemRef: { value: String(itemRef) } },
    });
  }
  if (tax > 0) {
    lines.push({
      Amount: tax,
      Description: 'Sales tax / VAT',
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: { ItemRef: { value: String(itemRef) } },
    });
  }
  if (lines.length === 0) return null;

  return {
    CustomerRef: { value: String(customerRef), name: customerName },
    TxnDate: date,
    DocNumber: `ERL-${date.replace(/-/g, '')}`,
    PrivateNote: [
      'Erlbrew POS — daily sales summary',
      `Date: ${date}`,
      `Orders: ${orders.length}`,
      `Net sales: ${net.toFixed(2)}`,
      `Tax: ${tax.toFixed(2)}`,
      `Gross total: ${gross.toFixed(2)}`,
      `By method: ${[...byMethod].map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')}`,
    ].join('\n'),
    Line: lines,
  };
}

/**
 * Supplier Invoice → QBO Bill payload (expense tracking).
 * @param {object} args
 * @param {object} args.invoice  supplier_invoices row
 * @param {Array}  [args.items]  supplier_invoice_items rows
 * @param {string} [args.vendorRef]
 * @param {string} [args.accountRef] QBO expense AccountRef (default "1")
 */
export function buildBillPayload({ invoice, items = [], vendorRef = '1', accountRef = '1' }) {
  if (!invoice) return null;
  const total = Number(invoice.total_amount);
  if (!Number.isFinite(total)) return null;

  const lines = (items.length ? items : [{ item_description: invoice.invoice_number || 'Expense', quantity: 1, total_price: total }])
    .map((it) => ({
      Amount: round2(Number(it.total_price) || 0),
      Description: String(it.item_description || '').slice(0, 200),
      DetailType: 'AccountBasedExpenseLineDetail',
      AccountBasedExpenseLineDetail: { AccountRef: { value: String(accountRef) } },
      ...(Number(it.quantity) > 0 ? { Quantity: Number(it.quantity) } : {}),
    }))
    .filter((l) => l.Amount !== 0);

  if (lines.length === 0) return null;

  const payload = {
    VendorRef: { value: String(vendorRef), name: String(invoice.supplier_name || '') },
    TxnDate: String(invoice.invoice_date).slice(0, 10),
    DocNumber: String(invoice.invoice_number || '').slice(0, 40) || undefined,
    PrivateNote: `Erlbrew POS — supplier invoice ${invoice.invoice_number || ''} (${invoice.supplier_name || ''})`.trim(),
    Line: lines,
  };
  if (invoice.due_date) payload.DueDate = String(invoice.due_date).slice(0, 10);
  if (invoice.tax_amount && Number(invoice.tax_amount) > 0) payload.TxnTaxDetail = { TotalTax: round2(Number(invoice.tax_amount)) };
  return payload;
}

// ─── company_settings access ──────────────────────────────────────────────────
async function getSetting(pool, key) {
  try {
    const [rows] = await pool.execute(
      `SELECT setting_value FROM company_settings WHERE setting_key = ?`, [key]
    );
    return rows.length ? rows[0].setting_value : null;
  } catch {
    return null;
  }
}

async function setSetting(pool, key, value) {
  await pool.execute(
    `INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value === null || value === undefined ? '' : String(value)]
  );
}

async function deleteSetting(pool, key) {
  await pool.execute(`DELETE FROM company_settings WHERE setting_key = ?`, [key]);
}

export function forceDryRun() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.QUICKBOOKS_DRY_RUN || '').toLowerCase());
}

// ─── Connection state ─────────────────────────────────────────────────────────
export async function getConnectionState(pool) {
  const [access, expiresAt, realmId, connectedAt] = await Promise.all([
    getSetting(pool, SETTING.accessToken),
    getSetting(pool, SETTING.expiresAt),
    getSetting(pool, SETTING.realmId),
    getSetting(pool, SETTING.connectedAt),
  ]);
  const refresh = await getSetting(pool, SETTING.refreshToken);
  const hasRefresh = !!refresh;
  const expMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const accessTokenLive = !Number.isNaN(expMs) && expMs > Date.now() + 60_000;
  return {
    provider: PROVIDER,
    label: PROVIDERS[PROVIDER]?.label || 'QuickBooks',
    enabled: await isProviderEnabled(pool, PROVIDER),
    connected: !!(access || hasRefresh) && !!realmId,
    accessTokenLive,
    canRefresh: hasRefresh,
    realmId: realmId || null,
    environment: (await resolveField(pool, PROVIDER, 'environment')) || 'sandbox',
    expiresAt: expiresAt || null,
    connectedAt: connectedAt || null,
    clientIdConfigured: !!(await resolveField(pool, PROVIDER, 'client_id')),
    clientSecretConfigured: !!(await resolveField(pool, PROVIDER, 'client_secret')),
    dryRunForced: forceDryRun(),
  };
}

export async function getRedirectUri(pool) {
  const base = await getBaseUrl(pool);
  return base ? `${base}/api/accounting/${PROVIDER}/callback` : null;
}

/** Build the Intuit authorize URL and stash a short-lived CSRF state. */
export async function getConnectUrl(pool) {
  const clientId = await resolveField(pool, PROVIDER, 'client_id');
  if (!clientId) throw new Error('QuickBooks Client ID not configured — save it in Integrations first');
  const redirectUri = await getRedirectUri(pool);
  if (!redirectUri) throw new Error('Public Base URL not set — it is required for the OAuth callback');

  const state = crypto.randomBytes(24).toString('hex');
  await setSetting(pool, SETTING.oauthState, state);
  await setSetting(pool, SETTING.oauthStateExp, String(Date.now() + 10 * 60_000));

  const environment = (await resolveField(pool, PROVIDER, 'environment')) === 'production' ? 'production' : 'sandbox';
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return { url: url.toString(), redirectUri, state, environment };
}

async function exchangeForTokens(pool, params) {
  const clientId = await resolveField(pool, PROVIDER, 'client_id');
  const clientSecret = await resolveField(pool, PROVIDER, 'client_secret');
  if (!clientId || !clientSecret) throw new Error('QuickBooks client credentials not configured');

  const body = new URLSearchParams(params);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Token request failed (HTTP ${res.status})`);
  }
  if (!data.access_token) throw new Error('Intuit returned no access token');
  return data;
}

async function persistTokens(pool, data, realmId) {
  await setSetting(pool, SETTING.accessToken, encryptSecret(data.access_token));
  if (data.refresh_token) await setSetting(pool, SETTING.refreshToken, encryptSecret(data.refresh_token));
  const expiresIn = Number(data.expires_in) || 3600;
  await setSetting(pool, SETTING.expiresAt, new Date(Date.now() + expiresIn * 1000).toISOString());
  if (realmId) await setSetting(pool, SETTING.realmId, String(realmId));
  await setSetting(pool, SETTING.connectedAt, new Date().toISOString());
}

/** OAuth callback: validate state → exchange code → store tokens. */
export async function handleCallback(pool, { code, state, realmId }) {
  if (!code) throw new Error('Missing authorization code');
  const expected = await getSetting(pool, SETTING.oauthState);
  const exp = Number(await getSetting(pool, SETTING.oauthStateExp));
  if (!expected || expected !== state) throw new Error('Invalid or expired OAuth state — restart the connect flow');
  if (!Number.isFinite(exp) || exp < Date.now()) throw new Error('OAuth state expired — restart the connect flow');
  await deleteSetting(pool, SETTING.oauthState);
  await deleteSetting(pool, SETTING.oauthStateExp);

  const tokens = await exchangeForTokens(pool, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: await getRedirectUri(pool),
  });
  await persistTokens(pool, tokens, realmId || tokens.realmId);
  return getConnectionState(pool);
}

export async function disconnect(pool) {
  for (const key of Object.values(SETTING)) {
    if (key === SETTING.oauthState || key === SETTING.oauthStateExp) continue;
    await deleteSetting(pool, key);
  }
  return getConnectionState(pool);
}

/** Access token, transparently refreshed when within 60s of expiry. */
export async function getAccessToken(pool) {
  const expiresAt = await getSetting(pool, SETTING.expiresAt);
  const live = expiresAt && Date.parse(expiresAt) > Date.now() + 60_000;
  const accessRaw = await getSetting(pool, SETTING.accessToken);
  if (live && accessRaw) return decryptSecret(accessRaw);

  const refreshRaw = await getSetting(pool, SETTING.refreshToken);
  if (!refreshRaw) throw new Error('QuickBooks not connected — run the connect flow first');
  const tokens = await exchangeForTokens(pool, {
    grant_type: 'refresh_token',
    refresh_token: decryptSecret(refreshRaw),
  });
  // Intuit rotates the refresh token — always persist the new one or the
  // connection dies silently in ~100 days.
  await persistTokens(pool, tokens, await getSetting(pool, SETTING.realmId));
  return tokens.access_token;
}

// ─── QBO API client ───────────────────────────────────────────────────────────
export async function qboRequest(pool, pathAndQuery, { method = 'GET', body } = {}) {
  const state = await getConnectionState(pool);
  const realmId = state.realmId;
  if (!realmId) throw new Error('QuickBooks company (realmId) unknown — reconnect');
  const token = await getAccessToken(pool);
  const host = API_HOST[state.environment] || API_HOST.sandbox;
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const url = `${host}/v3/company/${realmId}/${pathAndQuery}${pathAndQuery.includes('minorversion') ? '' : `${sep}minorversion=${MINOR_VERSION}`}`;

  const doFetch = (accessToken) => fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let res = await doFetch(token);
  if (res.status === 401) {
    // Force a refresh and retry once.
    await deleteSetting(pool, SETTING.accessToken);
    await deleteSetting(pool, SETTING.expiresAt);
    res = await doFetch(await getAccessToken(pool));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fault = data.Fault?.Error?.[0]?.Message;
    throw new Error(fault || `QuickBooks API error (HTTP ${res.status})`);
  }
  return data;
}

/** Escape a value for a QBO query string literal (single quotes only). */
export function qboQueryLiteral(value) {
  return `'${String(value).replace(/'/g, "\\'")}'`;
}

/**
 * Find a Customer/Vendor by DisplayName, creating it if absent.
 * Returns { id, name, created }.
 */
export async function findOrCreateRef(pool, type, displayName) {
  const entity = type === 'vendor' ? 'Vendor' : 'Customer';
  const q = `select * from ${entity} where DisplayName = ${qboQueryLiteral(displayName)} limit 1`;
  const query = await qboRequest(pool, `query?query=${encodeURIComponent(q)}`);
  const rows = query?.QueryResponse?.[entity];
  if (Array.isArray(rows) && rows.length) {
    return { id: String(rows[0].Id), name: rows[0].DisplayName, created: false };
  }
  const created = await qboRequest(pool, entity.toLowerCase(), {
    method: 'POST',
    body: { DisplayName: String(displayName).slice(0, 100) },
  });
  const obj = created?.[entity];
  if (!obj?.Id) throw new Error(`QuickBooks did not return an Id for the new ${entity}`);
  return { id: String(obj.Id), name: obj.DisplayName || displayName, created: true };
}

// ─── Sync log (dedupe) ────────────────────────────────────────────────────────
async function getLogRow(pool, type, period) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM accounting_sync_logs
       WHERE provider = ? AND sync_type = ? AND period_key = ? LIMIT 1`,
      [PROVIDER, type, period]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function writeLogRow(pool, { type, period, status, externalId = null, summary = null, error = null, force = false }) {
  const existing = await getLogRow(pool, type, period);
  const summaryJson = summary ? JSON.stringify(summary) : null;
  if (existing) {
    // Never let a dry-run overwrite a completed sync.
    if (existing.status === 'success' && status !== 'success' && !force) return;
    await pool.execute(
      `UPDATE accounting_sync_logs
       SET status = ?, external_id = ?, summary = ?, error = ?, created_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, externalId, summaryJson, error, existing.id]
    );
    return;
  }
  await pool.execute(
    `INSERT INTO accounting_sync_logs (provider, sync_type, period_key, status, external_id, summary, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [PROVIDER, type, period, status, externalId, summaryJson, error]
  );
}

export async function getSyncLog(pool, limit = 20) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, sync_type, period_key, status, external_id, summary, error, created_at
       FROM accounting_sync_logs WHERE provider = ?
       ORDER BY id DESC LIMIT ${Math.max(1, Math.min(200, Number(limit) || 20))}`,
      [PROVIDER]
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.sync_type,
      period: r.period_key,
      status: r.status,
      externalId: r.external_id,
      summary: r.summary ? JSON.parse(r.summary) : null,
      error: r.error,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

// ─── Sync: invoices (daily summary) ──────────────────────────────────────────
function tally(results) {
  return results.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    { success: 0, dry_run: 0, skipped: 0, failed: 0 }
  );
}

/**
 * Push one Invoice per day of completed orders.
 * @param {object} pool
 * @param {{start: string, end?: string, dryRun?: boolean, force?: boolean}} opts
 */
export async function syncDailySales(pool, { start, end, dryRun = false, force = false } = {}) {
  const dates = enumerateDates(start, end || start);
  const state = await getConnectionState(pool);
  const live = !dryRun && !forceDryRun() && state.connected && state.clientIdConfigured;
  const results = [];

  for (const date of dates) {
    try {
      const [rows] = await pool.execute(
        `SELECT pay_method, subtotal, tax, total
         FROM orders
         WHERE DATE(created_at) = ? AND status = 'completed'
         ORDER BY created_at`,
        [date]
      );
      const payload = buildDailySalesPayload({
        date,
        orders: rows,
        // Optional QBO income ItemRef (default "1" = Services). Set via env so it
        // stays out of the settings UI: QUICKBOOKS_INCOME_ITEM_REF=5
        itemRef: process.env.QUICKBOOKS_INCOME_ITEM_REF || '1',
      });

      if (!payload) {
        results.push({ period: date, status: 'skipped', reason: 'no completed orders' });
        continue;
      }

      const already = await getLogRow(pool, 'invoice', date);
      if (already?.status === 'success' && !force) {
        results.push({ period: date, status: 'skipped', reason: 'already synced', externalId: already.external_id });
        continue;
      }

      if (!live) {
        await writeLogRow(pool, { type: 'invoice', period: date, status: 'dry_run', summary: payloadSummary(payload) });
        results.push({ period: date, status: 'dry_run', payload });
        continue;
      }

      const customer = await findOrCreateRef(pool, 'customer', 'Walk-in Sales');
      const created = await qboRequest(pool, 'invoice', {
        method: 'POST',
        body: { ...payload, CustomerRef: { value: customer.id, name: customer.name } },
      });
      const txn = created?.Invoice;
      const externalId = txn?.Id ? String(txn.Id) : null;
      await writeLogRow(pool, { type: 'invoice', period: date, status: 'success', externalId, summary: payloadSummary(payload) });
      results.push({ period: date, status: 'success', externalId, docNumber: txn?.DocNumber });
    } catch (e) {
      await writeLogRow(pool, { type: 'invoice', period: date, status: 'failed', error: String(e.message || e).slice(0, 1000) });
      results.push({ period: date, status: 'failed', error: String(e.message || e) });
    }
  }

  return { provider: PROVIDER, kind: 'invoice', dryRunRequested: dryRun, live, results, counts: tally(results) };
}

function payloadSummary(payload) {
  if (!payload?.Line) return null;
  return {
    txnDate: payload.TxnDate,
    docNumber: payload.DocNumber,
    total: round2(payload.Line.reduce((s, l) => s + (Number(l.Amount) || 0), 0)),
    lines: payload.Line.length,
  };
}

// ─── Sync: expenses (supplier invoices → Bills) ──────────────────────────────
export async function syncExpenses(pool, { start, end, dryRun = false, force = false } = {}) {
  const dates = enumerateDates(start, end || start);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const state = await getConnectionState(pool);
  const live = !dryRun && !forceDryRun() && state.connected && state.clientIdConfigured;
  const results = [];

  const [invoices] = await pool.execute(
    `SELECT * FROM supplier_invoices
     WHERE invoice_date >= ? AND invoice_date <= ? AND status <> 'cancelled'
     ORDER BY invoice_date, id`,
    [from, to]
  );

  for (const inv of invoices) {
    const period = String(inv.invoice_number || inv.id);
    try {
      const already = await getLogRow(pool, 'bill', period);
      if (already?.status === 'success' && !force) {
        results.push({ period, status: 'skipped', reason: 'already synced', externalId: already.external_id });
        continue;
      }

      const [items] = await pool.execute(
        `SELECT item_description, quantity, unit_price, total_price
         FROM supplier_invoice_items WHERE invoice_id = ?`,
        [inv.id]
      );
      const payload = buildBillPayload({ invoice: inv, items });
      if (!payload) {
        results.push({ period, status: 'skipped', reason: 'no line items' });
        continue;
      }

      if (!live) {
        await writeLogRow(pool, { type: 'bill', period, status: 'dry_run', summary: payloadSummary(payload) });
        results.push({ period, status: 'dry_run', payload });
        continue;
      }

      const vendor = await findOrCreateRef(pool, 'vendor', inv.supplier_name || 'Supplier');
      const created = await qboRequest(pool, 'bill', {
        method: 'POST',
        body: { ...payload, VendorRef: { value: vendor.id, name: vendor.name } },
      });
      const txn = created?.Bill;
      const externalId = txn?.Id ? String(txn.Id) : null;
      await writeLogRow(pool, { type: 'bill', period, status: 'success', externalId, summary: payloadSummary(payload) });
      results.push({ period, status: 'success', externalId });
    } catch (e) {
      await writeLogRow(pool, { type: 'bill', period, status: 'failed', error: String(e.message || e).slice(0, 1000) });
      results.push({ period, status: 'failed', error: String(e.message || e) });
    }
  }

  return { provider: PROVIDER, kind: 'bill', dryRunRequested: dryRun, live, results, counts: tally(results) };
}

/** Fire-and-forget daily push — called after a Z-Report is generated. */
export async function autoSyncDailySales(pool, date) {
  try {
    if (!(await isProviderEnabled(pool, PROVIDER))) return null;
    return await syncDailySales(pool, { start: date, end: date });
  } catch (e) {
    console.error('[accounting] auto daily sync failed (non-fatal):', e.message);
    return null;
  }
}

/** Test-connection handler used by POST /api/integrations/:provider/test. */
export async function testConnection(pool) {
  const state = await getConnectionState(pool);
  if (!state.clientIdConfigured || !state.clientSecretConfigured) {
    return { ok: false, message: 'Client ID / Client Secret not configured' };
  }
  if (!state.connected) {
    return { ok: false, message: 'Credentials present — run Connect to authorize QuickBooks' };
  }
  if (forceDryRun()) {
    return { ok: true, message: 'Connected (QUICKBOOKS_DRY_RUN=1 — syncs run as dry-run only)' };
  }
  if (!state.accessTokenLive && !state.canRefresh) {
    return { ok: false, message: 'Token expired — reconnect QuickBooks' };
  }
  try {
    const q = encodeURIComponent('select * from CompanyInfo');
    const info = await qboRequest(pool, `query?query=${q}`);
    const company = info?.QueryResponse?.CompanyInfo?.[0];
    return { ok: true, message: `Connected to ${company?.CompanyName || 'QuickBooks'} (${state.environment})` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${e.message}` };
  }
}
