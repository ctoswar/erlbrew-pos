// ─── Xero accounting integration ────────────────────────────────────────────
// Issue #156 — add Xero (invoice sync + bank reconciliation) and make the
// accounting layer multi-provider instead of QuickBooks-only.
//
// Design mirrors accountingQuickBooks.js:
//   • Mock-first / ready-for-credentials. Client credentials live in the normal
//     PROVIDERS store; OAuth access/refresh tokens live in company_settings
//     under their own keys (encrypted at rest). Every outbound call is gated on
//     isLive() — with no credentials configured NOTHING leaves the process and
//     the whole flow runs in dry-run, returning the exact payloads it would
//     have sent.
//   • Invoice sync → one *daily summary* invoice per calendar day of completed
//     orders (DocNumber ERL-YYYYMMDD), plus one Bill per Supplier Invoice.
//   • Bank reconciliation (Xero-only feature) → recorded cash movements
//     (cash_drawer_transactions) and card settlements (orders) matched against
//     a statement feed: a deterministic mock generator when not connected, the
//     Xero Bank Transactions endpoint when live.
//
// Pure mappers + the reconcile engine are dependency-injected and covered by
// server/test/accountingXero.test.js.

import crypto from 'crypto';
import {
  PROVIDERS,
  resolveField,
  isProviderEnabled,
  getBaseUrl,
  encryptSecret,
  decryptSecret,
} from './integrationConfig.js';
// Shared pure helpers (single implementation, already unit-tested via the
// QuickBooks suite — no QuickBooks behaviour is reused beyond these).
import { round2, toISODate, enumerateDates, payMethodLabel } from './accountingQuickBooks.js';

export const PROVIDER = 'xero';

/** What this provider can sync — surfaced on GET /api/accounting/:provider/status. */
export const FEATURES = ['invoice', 'reconcile'];

// ─── OAuth2 / API endpoints (Xero) ──────────────────────────────────────────
const AUTH_URL = 'https://login.xero.com/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';
const API_BASE = 'https://api.xero.com/api.x2.0';
const SCOPE = 'accounting.transactions accounting.contacts offline_access openid profile email';

// company_settings keys (not exposed via PROVIDERS — tokens are never listed in
// the settings UI, only a masked "connected" indicator). tenant_id is shared
// with the PROVIDERS `tenant_id` field on purpose: env › DB resolves either the
// manually configured or the OAuth-connected organisation id from one place.
const SETTING = {
  accessToken: 'xero_access_token',
  refreshToken: 'xero_refresh_token',
  tenantId: 'xero_tenant_id',
  expiresAt: 'xero_token_expires_at',
  connectedAt: 'xero_connected_at',
  oauthState: 'xero_oauth_state',
  oauthStateExp: 'xero_oauth_state_exp',
};

export function forceDryRun() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.XERO_DRY_RUN || '').toLowerCase());
}

/** Live only when tokens + tenant + client id are in play and dry-run isn't forced. */
export function isLive(state) {
  return !!state && !!state.connected && !!state.clientIdConfigured && !forceDryRun();
}

// ─── Mappers (pure — covered by server/test/accountingXero.test.js) ─────────

/**
 * Daily summary of completed orders → a Xero ACCREC Invoice payload.
 *
 * Same semantics as the QuickBooks mapper: one line per payment method on the
 * *net* (subtotal) amount plus one tax line, so the lines always sum to the
 * day's gross total. DocNumber is stable per day (ERL-YYYYMMDD) which makes a
 * re-run recognisably idempotent to an accountant.
 *
 * @param {Array}  orders  rows: { pay_method, subtotal, tax, total }
 * @param {string} date    YYYY-MM-DD (invoice Date/DueDate)
 * @param {object} [opts]  { contactName, accountCode }
 * @returns {object|null} Xero Invoice payload, or null when nothing to sync
 */
export function buildDailySalesInvoice(orders, date, opts = {}) {
  if (!Array.isArray(orders) || orders.length === 0) return null;
  const contactName = opts.contactName || 'Walk-in Sales';
  const accountCode = String(opts.accountCode || process.env.XERO_INCOME_ACCOUNT_CODE || '200');

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
      Description: `${label} sales (${orders.length} order${orders.length === 1 ? '' : 's'})`,
      Quantity: 1,
      UnitAmount: amount,
      LineAmount: amount,
      TaxType: 'OUTPUT',
      AccountCode: accountCode,
    });
  }
  if (tax > 0) {
    lines.push({
      Description: 'Sales tax / VAT',
      Quantity: 1,
      UnitAmount: tax,
      LineAmount: tax,
      TaxType: 'OUTPUT',
      AccountCode: accountCode,
    });
  }
  if (lines.length === 0) return null;

  return {
    Type: 'ACCREC',
    Contact: { Name: contactName },
    Date: date,
    DueDate: date,
    LineAmountType: 'Exclusive',
    Status: 'AUTHORISED',
    DocNumber: `ERL-${date.replace(/-/g, '')}`,
    // Xero invoices have no PrivateNote equivalent — keep the Z-Report style
    // headline in Reference so the doc is recognisable in the invoice list.
    Reference: `Erlbrew POS ${date} · ${orders.length} order${orders.length === 1 ? '' : 's'} · gross ${gross.toFixed(2)}`,
    SubTotal: net,
    TotalTax: tax,
    Total: gross,
    Line: lines,
  };
}

/**
 * Supplier Invoice → Xero ACCPAY Bill payload (expense tracking).
 * Cancelled invoices are never payable — they map to null (the sync skips them
 * upstream too, this is the belt to that suspenders).
 *
 * @param {object} invoice supplier_invoices row
 * @param {Array}  [items] supplier_invoice_items rows (optional)
 * @returns {object|null}
 */
export function buildBill(invoice, items = []) {
  if (!invoice) return null;
  if (String(invoice.status || '').toLowerCase() === 'cancelled') return null;
  const total = Number(invoice.total_amount);
  if (!Number.isFinite(total)) return null;

  const rows = (Array.isArray(items) && items.length ? items : [
    { item_description: invoice.invoice_number || 'Expense', quantity: 1, total_price: total },
  ]);
  const accountCode = String(process.env.XERO_EXPENSE_ACCOUNT_CODE || '400');

  const lines = rows
    .map((it) => {
      const lineAmount = round2(Number(it.total_price) || 0);
      const quantity = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      return {
        Description: String(it.item_description || '').slice(0, 200),
        Quantity: quantity,
        // LineAmount stays the authoritative total_price (Xero recomputes
        // qty × unit, so unit is derived and may round by a cent at most).
        UnitAmount: round2(lineAmount / quantity),
        LineAmount: lineAmount,
        AccountCode: accountCode,
      };
    })
    .filter((l) => l.LineAmount !== 0);

  if (lines.length === 0) return null;

  const subtotal = round2(Number(invoice.subtotal) || 0) || round2(total - (Number(invoice.tax_amount) || 0));
  const tax = round2(Number(invoice.tax_amount) || 0);

  const payload = {
    Type: 'ACCPAY',
    Contact: { Name: String(invoice.supplier_name || '') },
    Date: String(invoice.invoice_date).slice(0, 10),
    LineAmountType: 'Exclusive',
    Status: 'AUTHORISED',
    DocNumber: String(invoice.invoice_number || '').slice(0, 40) || undefined,
    Reference: `Erlbrew POS supplier invoice ${invoice.invoice_number || ''}`.trim(),
    SubTotal: subtotal,
    TotalTax: tax,
    Total: round2(subtotal + tax),
    Line: lines,
  };
  if (invoice.due_date) payload.DueDate = String(invoice.due_date).slice(0, 10);
  return payload;
}

// ─── company_settings access ────────────────────────────────────────────────
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

// ─── Connection state ───────────────────────────────────────────────────────
export async function getConnectionState(pool) {
  const [access, expiresAt, tenantId, connectedAt] = await Promise.all([
    getSetting(pool, SETTING.accessToken),
    getSetting(pool, SETTING.expiresAt),
    resolveField(pool, PROVIDER, 'tenant_id'),
    getSetting(pool, SETTING.connectedAt),
  ]);
  const refresh = await getSetting(pool, SETTING.refreshToken);
  const hasRefresh = !!refresh;
  const expMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const accessTokenLive = !Number.isNaN(expMs) && expMs > Date.now() + 60_000;
  const state = {
    provider: PROVIDER,
    label: PROVIDERS[PROVIDER]?.label || 'Xero',
    enabled: await isProviderEnabled(pool, PROVIDER),
    connected: !!(access || hasRefresh) && !!tenantId,
    accessTokenLive,
    canRefresh: hasRefresh,
    tenantId: tenantId || null,
    environment: (await resolveField(pool, PROVIDER, 'environment')) || 'sandbox',
    expiresAt: expiresAt || null,
    tokenExpiresAt: expiresAt || null,
    connectedAt: connectedAt || null,
    clientIdConfigured: !!(await resolveField(pool, PROVIDER, 'client_id')),
    clientSecretConfigured: !!(await resolveField(pool, PROVIDER, 'client_secret')),
    dryRunForced: forceDryRun(),
    features: FEATURES,
  };
  state.mode = isLive(state) ? 'live' : 'mock';
  return state;
}

export async function getRedirectUri(pool) {
  const base = await getBaseUrl(pool);
  return base ? `${base}/api/accounting/${PROVIDER}/callback` : null;
}

/** Build the Xero authorize URL and stash a short-lived CSRF state. */
export async function getConnectUrl(pool) {
  const clientId = await resolveField(pool, PROVIDER, 'client_id');
  if (!clientId) throw new Error('Xero Client ID not configured — save it in Integrations first');
  const redirectUri = await getRedirectUri(pool);
  if (!redirectUri) throw new Error('Public Base URL not set — it is required for the OAuth callback');

  const state = crypto.randomBytes(24).toString('hex');
  await setSetting(pool, SETTING.oauthState, state);
  await setSetting(pool, SETTING.oauthStateExp, String(Date.now() + 10 * 60_000));

  const environment = (await resolveField(pool, PROVIDER, 'environment')) === 'live' ? 'live' : 'sandbox';
  const url = new URL(AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('state', state);
  return { url: url.toString(), redirectUri, state, environment };
}

async function exchangeForTokens(pool, params) {
  const clientId = await resolveField(pool, PROVIDER, 'client_id');
  const clientSecret = await resolveField(pool, PROVIDER, 'client_secret');
  if (!clientId || !clientSecret) throw new Error('Xero client credentials not configured');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Token request failed (HTTP ${res.status})`);
  }
  if (!data.access_token) throw new Error('Xero returned no access token');
  return data;
}

async function persistTokens(pool, data, tenantId) {
  await setSetting(pool, SETTING.accessToken, encryptSecret(data.access_token));
  if (data.refresh_token) await setSetting(pool, SETTING.refreshToken, encryptSecret(data.refresh_token));
  const expiresIn = Number(data.expires_in) || 1800; // Xero access tokens live 30 minutes
  await setSetting(pool, SETTING.expiresAt, new Date(Date.now() + expiresIn * 1000).toISOString());
  if (tenantId) await setSetting(pool, SETTING.tenantId, String(tenantId));
  await setSetting(pool, SETTING.connectedAt, new Date().toISOString());
}

/** Xero hands the tenant (organisation) over on /connections, not in the callback. */
async function fetchFirstTenantId(accessToken) {
  const res = await fetch(CONNECTIONS_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const list = await res.json().catch(() => []);
  if (!res.ok) throw new Error(`Xero connections lookup failed (HTTP ${res.status})`);
  const tenantId = Array.isArray(list) && list[0] ? list[0].tenantId : null;
  if (!tenantId) throw new Error('Xero returned no tenant connection — check the authorised organisation');
  return tenantId;
}

/** OAuth callback: validate state → exchange code → store tokens + tenant. */
export async function handleCallback(pool, { code, state }) {
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
  const tenantId = await fetchFirstTenantId(tokens.access_token);
  await persistTokens(pool, tokens, tenantId);
  return getConnectionState(pool);
}

/**
 * Drop stored tokens. The `xero_tenant_id` company_settings row is left in
 * place when it was saved as a regular provider field — disconnect only
 * removes credentials, and `connected` flips to false with the tokens gone.
 */
export async function disconnect(pool) {
  for (const key of Object.values(SETTING)) {
    if (key === SETTING.tenantId || key === SETTING.oauthState || key === SETTING.oauthStateExp) continue;
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
  if (!refreshRaw) throw new Error('Xero not connected — run the connect flow first');
  const tokens = await exchangeForTokens(pool, {
    grant_type: 'refresh_token',
    refresh_token: decryptSecret(refreshRaw),
  });
  // Xero may rotate the refresh token — always persist the new one if returned.
  await persistTokens(pool, tokens, await getSetting(pool, SETTING.tenantId));
  return tokens.access_token;
}

// ─── Xero API client ────────────────────────────────────────────────────────
/**
 * Single outbound gateway. Throws before touching fetch when the provider is
 * not live (no credentials / dry-run forced) — mock mode never calls out.
 */
export async function xeroRequest(pool, pathAndQuery, { method = 'GET', body } = {}) {
  const state = await getConnectionState(pool);
  if (!isLive(state)) {
    throw new Error('Xero is not live (mock mode) — network call skipped');
  }
  if (!state.tenantId) throw new Error('Xero tenant (organisation) unknown — reconnect');
  const token = await getAccessToken(pool);
  const url = pathAndQuery.startsWith('http')
    ? pathAndQuery
    : `${API_BASE}/${String(pathAndQuery).replace(/^\//, '')}`;

  const doFetch = (accessToken) => fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'xero-tenant-id': state.tenantId,
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
    const detail = data?.Elements?.[0]?.ValidationErrors?.[0]?.Message
      || data?.Error?.[0]?.Message
      || data?.message;
    throw new Error(detail || `Xero API error (HTTP ${res.status})`);
  }
  return data;
}

// ─── Sync log (dedupe) ──────────────────────────────────────────────────────
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
      // mysql2 returns JSON columns as objects — only parse when it is a string.
      summary: typeof r.summary === 'string' ? JSON.parse(r.summary) : (r.summary || null),
      error: r.error,
      createdAt: r.created_at,
    }));
  } catch (e) {
    console.error('[accounting] getSyncLog failed:', e.message);
    return [];
  }
}

// ─── Sync: invoices (daily summary) ─────────────────────────────────────────
function tally(results) {
  return results.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    { success: 0, dry_run: 0, skipped: 0, failed: 0 }
  );
}

function payloadSummary(payload) {
  if (!payload?.Line) return null;
  return {
    txnDate: payload.Date,
    docNumber: payload.DocNumber,
    total: round2(payload.Line.reduce((s, l) => s + (Number(l.LineAmount) || 0), 0)),
    lines: payload.Line.length,
  };
}

/** Push one Invoice per day of completed orders. */
export async function syncDailySales(pool, { start, end, dryRun = false, force = false } = {}) {
  const dates = enumerateDates(start, end || start);
  const state = await getConnectionState(pool);
  const live = !dryRun && isLive(state);
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
      const payload = buildDailySalesInvoice(rows, date);

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

      const created = await xeroRequest(pool, 'Invoices', { method: 'POST', body: payload });
      const txn = Array.isArray(created?.Invoices) ? created.Invoices[0] : null;
      const externalId = txn?.InvoiceID ? String(txn.InvoiceID) : null;
      await writeLogRow(pool, { type: 'invoice', period: date, status: 'success', externalId, summary: payloadSummary(payload) });
      results.push({ period: date, status: 'success', externalId, docNumber: txn?.DocNumber });
    } catch (e) {
      await writeLogRow(pool, { type: 'invoice', period: date, status: 'failed', error: String(e.message || e).slice(0, 1000) });
      results.push({ period: date, status: 'failed', error: String(e.message || e) });
    }
  }

  return {
    provider: PROVIDER,
    kind: 'invoice',
    dryRun: !live,
    dryRunRequested: dryRun,
    live,
    mode: live ? 'live' : 'mock',
    results,
    counts: tally(results),
  };
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

// ─── Sync: expenses (supplier invoices → Bills) ─────────────────────────────
export async function syncExpenses(pool, { start, end, dryRun = false, force = false } = {}) {
  // Bills are a filtered list, not one call per day — allow a full year of catch-up.
  const dates = enumerateDates(start, end || start, 400);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const state = await getConnectionState(pool);
  const live = !dryRun && isLive(state);
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
      const payload = buildBill(inv, items);
      if (!payload) {
        results.push({ period, status: 'skipped', reason: 'no line items' });
        continue;
      }

      if (!live) {
        await writeLogRow(pool, { type: 'bill', period, status: 'dry_run', summary: payloadSummary(payload) });
        results.push({ period, status: 'dry_run', payload });
        continue;
      }

      const created = await xeroRequest(pool, 'Invoices', { method: 'POST', body: payload });
      const txn = Array.isArray(created?.Invoices) ? created.Invoices[0] : null;
      const externalId = txn?.InvoiceID ? String(txn.InvoiceID) : null;
      await writeLogRow(pool, { type: 'bill', period, status: 'success', externalId, summary: payloadSummary(payload) });
      results.push({ period, status: 'success', externalId });
    } catch (e) {
      await writeLogRow(pool, { type: 'bill', period, status: 'failed', error: String(e.message || e).slice(0, 1000) });
      results.push({ period, status: 'failed', error: String(e.message || e) });
    }
  }

  return {
    provider: PROVIDER,
    kind: 'bill',
    dryRun: !live,
    dryRunRequested: dryRun,
    live,
    mode: live ? 'live' : 'mock',
    results,
    counts: tally(results),
  };
}

// ─── Bank reconciliation ────────────────────────────────────────────────────

/** Normalise a date-ish value (Date | 'YYYY-MM-DD…') to 'YYYY-MM-DD'. */
function asDateText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toISODate(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

/** Currency → integer cents (null when unusable). */
function toCents(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Whole days between two YYYY-MM-DD strings (DST-safe). */
function dayDiff(from, to) {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.round((b - a) / 86_400_000);
}

function numericId(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function idRank(entry) {
  return entry.id === null ? Infinity : entry.id;
}

function normalizeSide(rows, kind) {
  const out = [];
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const date = asDateText(row?.date ?? row?.created_at);
    const cents = toCents(row?.amount);
    if (date === null || cents === null) return; // unusable row — never participates
    out.push({
      kind,
      index,
      date,
      cents,
      amount: cents / 100,
      description: String(row.description ?? row.reason ?? ''),
      id: numericId(row.id),
      orderId: row.orderId ?? null,
      drawerTransactionId: row.drawerTransactionId ?? null,
      used: false,
    });
  });
  return out;
}

const byDateThenIndex = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index);

const byDayThenIdThenIndex = (a, b) =>
  (a.dd - b.dd) || (idRank(a.r) - idRank(b.r)) || (a.r.index - b.r.index);

/**
 * Deterministic bank reconciliation engine.
 *
 * Rules, in priority order:
 *   (a) exact — same amount and same date (lowest recorded id wins duplicates);
 *   (b) tolerance — amount within `toleranceCents` and date within
 *       `dateWindowDays`, picking the nearest date then the lowest id;
 *   (c) otherwise the statement line is unmatched.
 * Exact matches are resolved for ALL statement lines before tolerance matching
 * so a later exact pair can never be stolen by an earlier fuzzy one.
 *
 * @param {object}   args
 * @param {Array}    [args.transactions]   recorded side: { id?, date, amount, description?, orderId?, drawerTransactionId? }
 * @param {Array}    [args.statementLines] bank side: { id?, date, amount, description? }
 * @param {number}   [args.toleranceCents]
 * @param {number}   [args.dateWindowDays]
 * @returns {{ matched:number, unmatched:number, variance:number, results:Array, summary:object }}
 *   `variance` = Σ matched recorded amounts − Σ matched statement amounts.
 *   `results`  = one entry per statement line (input order), followed by
 *                recorded transactions the statement never matched.
 */
export function reconcileBankFeed({
  transactions = [],
  statementLines = [],
  toleranceCents = 0,
  dateWindowDays = 0,
} = {}) {
  const tol = Math.max(0, Math.round(Number(toleranceCents) || 0));
  const win = Math.max(0, Math.round(Number(dateWindowDays) || 0));

  const recorded = normalizeSide(transactions, 'recorded');
  const statement = normalizeSide(statementLines, 'statement');

  // statement index → { recorded, exact, deltaCents, deltaDays }
  const pairs = new Map();

  // (a) exact amount + date matches first — globally, so rule (b) can only
  // ever see leftovers.
  for (const s of [...statement].sort(byDateThenIndex)) {
    const candidates = recorded.filter((r) => !r.used && r.date === s.date && r.cents === s.cents);
    if (candidates.length === 0) continue;
    const best = [...candidates].sort((a, b) => (idRank(a) - idRank(b)) || (a.index - b.index))[0];
    best.used = true;
    pairs.set(s.index, { recorded: best, exact: true, deltaCents: 0, deltaDays: 0 });
  }

  // (b) tolerance + date window — nearest date, then lowest id, then input order.
  for (const s of [...statement].sort(byDateThenIndex)) {
    if (pairs.has(s.index)) continue;
    let best = null;
    for (const r of recorded) {
      if (r.used) continue;
      const deltaCents = Math.abs(r.cents - s.cents);
      if (deltaCents > tol) continue;
      const deltaDays = Math.abs(dayDiff(r.date, s.date));
      if (deltaDays > win) continue;
      const candidate = { r, dd: deltaDays, deltaCents };
      if (!best || byDayThenIdThenIndex(candidate, best) < 0) best = candidate;
    }
    if (!best) continue;
    best.r.used = true;
    pairs.set(s.index, { recorded: best.r, exact: false, deltaCents: best.deltaCents, deltaDays: best.dd });
  }

  // (c) everything left over is unmatched, on both sides.
  const results = [];
  let matchedRecordedCents = 0;
  let matchedStatementCents = 0;

  for (const s of statement) {
    const pair = pairs.get(s.index);
    if (!pair) {
      results.push({
        date: s.date,
        description: s.description,
        amount: s.amount,
        status: 'unmatched',
        reason: `no recorded transaction within ±${tol} cent(s) and ±${win} day(s)`,
      });
      continue;
    }
    matchedRecordedCents += pair.recorded.cents;
    matchedStatementCents += s.cents;
    results.push({
      date: s.date,
      description: s.description,
      amount: s.amount,
      status: 'matched',
      reason: pair.exact
        ? 'exact match: same amount and date'
        : `tolerance match: amount within ${pair.deltaCents} cent(s), date within ${pair.deltaDays} day(s)`,
      ...(pair.recorded.orderId !== null && pair.recorded.orderId !== undefined
        ? { orderId: pair.recorded.orderId }
        : {}),
      ...(pair.recorded.drawerTransactionId !== null && pair.recorded.drawerTransactionId !== undefined
        ? { drawerTransactionId: pair.recorded.drawerTransactionId }
        : {}),
    });
  }

  const unmatchedRecorded = recorded.filter((r) => !r.used);
  for (const r of unmatchedRecorded) {
    results.push({
      date: r.date,
      description: r.description,
      amount: r.amount,
      status: 'unmatched',
      reason: 'no statement line matched this recorded transaction',
      ...(r.orderId !== null && r.orderId !== undefined ? { orderId: r.orderId } : {}),
      ...(r.drawerTransactionId !== null && r.drawerTransactionId !== undefined
        ? { drawerTransactionId: r.drawerTransactionId }
        : {}),
    });
  }

  const sumCents = (rows) => rows.reduce((s, r) => s + r.cents, 0);
  const matchedRecorded = recorded.filter((r) => r.used);

  return {
    matched: pairs.size,
    unmatched: (statement.length - pairs.size) + unmatchedRecorded.length,
    variance: Math.round(matchedRecordedCents - matchedStatementCents) / 100,
    results,
    summary: {
      toleranceCents: tol,
      dateWindowDays: win,
      recordedCount: recorded.length,
      statementCount: statement.length,
      matchedCount: pairs.size,
      unmatchedStatement: statement.length - pairs.size,
      unmatchedRecorded: unmatchedRecorded.length,
      recordedTotal: Math.round(sumCents(recorded)) / 100,
      statementTotal: Math.round(sumCents(statement)) / 100,
      matchedRecordedTotal: Math.round(matchedRecordedCents) / 100,
      matchedStatementTotal: Math.round(matchedStatementCents) / 100,
    },
  };
}

function shiftDate(dateText, days) {
  const d = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(d.getTime()) || days === 0) return dateText;
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * Deterministic mock bank statement feed for dry-run / not-connected mode.
 * Derives one plausible settlement line per recorded transaction, seeded by the
 * date range: identical inputs always produce identical output, and no network
 * call is involved. `shiftDays` / `jitterCents` optionally perturb every third
 * line (settlement lag / rounding) to exercise the tolerance rules.
 *
 * @param {object} args { transactions, start, end, shiftDays, jitterCents }
 */
export function generateMockStatementFeed({ transactions = [], start = '', end = '', shiftDays = 0, jitterCents = 0 } = {}) {
  const seed = `${start || ''}..${end || ''}`;
  const shift = Math.round(Number(shiftDays) || 0);
  const jitter = Math.round(Number(jitterCents) || 0);
  const out = [];
  let i = 0;
  for (const t of Array.isArray(transactions) ? transactions : []) {
    const date = asDateText(t?.date ?? t?.created_at);
    const cents = toCents(t?.amount);
    if (date === null || cents === null) continue;
    if (start && date < start) continue;
    if (end && date > end) continue;
    i += 1;
    out.push({
      id: `MOCK-${seed}-${i}`,
      date: shiftDate(date, i % 3 === 1 ? shift : 0),
      amount: (cents + (i % 3 === 2 ? jitter : 0)) / 100,
      description: `Mock settlement ${seed} #${i}${t.description ? ` — ${String(t.description).slice(0, 60)}` : ''}`,
    });
  }
  return out;
}

/**
 * Recorded side of the reconciliation: cash movements from the drawer plus
 * card settlements from completed orders, for the date range. `orders` is
 * joined in-app to recover the order id behind a drawer row's
 * 'Order #XXXXXXXX' reason (prefix match — ids are unique by prefix in-range).
 */
export async function loadRecordedTransactions(pool, { start, end }) {
  const [drawerRows] = await pool.execute(
    `SELECT id, transaction_type, amount, reason, staff_name, created_at
     FROM cash_drawer_transactions
     WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
     ORDER BY created_at, id`,
    [start, end]
  );
  const [orderRows] = await pool.execute(
    `SELECT id, total, pay_method, reference_number, created_at
     FROM orders
     WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
       AND status = 'completed'
     ORDER BY created_at, id`,
    [start, end]
  );

  // prefix (first 8 chars, upper) → order id, for the drawer reason join.
  const orderByPrefix = new Map();
  for (const o of orderRows) {
    const prefix = String(o.id || '').slice(0, 8).toUpperCase();
    if (prefix && !orderByPrefix.has(prefix)) orderByPrefix.set(prefix, String(o.id));
  }

  const out = [];
  for (const t of drawerRows) {
    const reason = t.reason ? String(t.reason) : '';
    const match = reason.match(/^Order #([0-9A-Z]+)/i);
    const orderId = match ? (orderByPrefix.get(match[1].toUpperCase()) ?? null) : null;
    const isOut = t.transaction_type === 'cash_out' || t.transaction_type === 'payout';
    const cents = toCents(t.amount);
    if (cents === null) continue;
    out.push({
      id: numericId(t.id),
      source: 'drawer',
      date: asDateText(t.created_at),
      amount: Math.round((isOut ? -cents : cents)) / 100,
      description: reason || `Cash drawer ${t.transaction_type}`,
      orderId,
      drawerTransactionId: numericId(t.id),
    });
  }
  for (const o of orderRows) {
    if (String(o.pay_method || '').toLowerCase() !== 'card') continue;
    const cents = toCents(o.total);
    if (cents === null) continue;
    out.push({
      id: null, // uuid order ids don't take part in the numeric tie-break
      source: 'order',
      date: asDateText(o.created_at),
      amount: cents / 100,
      description: `Card settlement${o.reference_number ? ` ref ${o.reference_number}` : ''} (order ${String(o.id).slice(0, 8).toUpperCase()})`,
      orderId: String(o.id),
      drawerTransactionId: null,
    });
  }
  out.forEach((row, index) => { row.index = index; });
  const usable = out.filter((r) => r.date !== null);
  usable.sort(byDateThenIndex);
  return usable;
}

/** Live statement side — Xero Bank Transactions (only reached when isLive()). */
export async function fetchStatementLines(pool, { start, end }) {
  const where = `Date >= DateTime("${start}T00:00:00") AND Date <= DateTime("${end}T23:59:59")`;
  const data = await xeroRequest(pool, `BankTransactions?where=${encodeURIComponent(where)}&page=1`);
  const rows = Array.isArray(data?.BankTransactions) ? data.BankTransactions : [];
  const lines = [];
  for (const b of rows) {
    const date = asDateText(b?.Date);
    const raw = Number(b?.Amount ?? b?.Total ?? 0);
    if (!date || !Number.isFinite(raw)) continue;
    const sign = String(b?.Type || '').toUpperCase() === 'SPEND' ? -1 : 1;
    lines.push({
      id: b?.BankTransactionID ? String(b.BankTransactionID) : null,
      date,
      amount: round2(sign * raw),
      description: String(b?.Narration || b?.Description || b?.Reference || b?.Type || '').slice(0, 200),
    });
  }
  return lines;
}

/**
 * Reconcile recorded transactions against a bank statement feed for a date
 * range. Not connected (or dry-run) → deterministic mock feed + zero network.
 *
 * @param {object} pool
 * @param {{start:string, end?:string, dryRun?:boolean, toleranceCents?:number, dateWindowDays?:number}} opts
 */
export async function reconcileBankStatements(
  pool,
  { start, end, dryRun = false, toleranceCents = 0, dateWindowDays = 1 } = {}
) {
  const dates = enumerateDates(start, end || start, 92);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const state = await getConnectionState(pool);
  const live = !dryRun && isLive(state);

  const transactions = await loadRecordedTransactions(pool, { start: from, end: to });
  const statementLines = live
    ? await fetchStatementLines(pool, { start: from, end: to })
    : generateMockStatementFeed({ transactions, start: from, end: to });

  const recon = reconcileBankFeed({ transactions, statementLines, toleranceCents, dateWindowDays });

  await writeLogRow(pool, {
    type: 'reconcile',
    period: `${from}..${to}`,
    status: live ? 'success' : 'dry_run',
    summary: {
      source: live ? 'xero_bank_transactions' : 'mock_feed',
      matched: recon.matched,
      unmatched: recon.unmatched,
      variance: recon.variance,
    },
  });

  return {
    provider: PROVIDER,
    dryRun: !live,
    live,
    mode: live ? 'live' : 'mock',
    matched: recon.matched,
    unmatched: recon.unmatched,
    variance: recon.variance,
    summary: {
      start: from,
      end: to,
      source: live ? 'xero_bank_transactions' : 'mock_feed',
      ...recon.summary,
    },
    results: recon.results,
    ...(live ? {} : { payload: statementLines }),
  };
}

/** Test-connection handler used by POST /api/integrations/:provider/test. */
export async function testConnection(pool) {
  const state = await getConnectionState(pool);
  if (!state.clientIdConfigured || !state.clientSecretConfigured) {
    return {
      ok: false,
      mode: 'mock',
      message: 'Client ID / Client Secret not configured — Xero runs in mock mode (no network call made)',
    };
  }
  if (!state.connected) {
    return { ok: false, mode: 'mock', message: 'Credentials present — run Connect to authorize Xero' };
  }
  if (forceDryRun()) {
    return { ok: true, mode: 'mock', message: 'Connected (XERO_DRY_RUN=1 — syncs run as dry-run only)' };
  }
  if (!state.accessTokenLive && !state.canRefresh) {
    return { ok: false, mode: 'mock', message: 'Token expired — reconnect Xero' };
  }
  try {
    const info = await xeroRequest(pool, 'Organisation');
    const org = Array.isArray(info?.Organisations) ? info.Organisations[0] : null;
    return {
      ok: true,
      mode: 'live',
      message: `Connected to ${org?.Name || 'Xero'} (${org?.BaseCurrency || state.environment})`,
    };
  } catch (e) {
    return { ok: false, mode: state.mode, message: `Connection failed: ${e.message}` };
  }
}
