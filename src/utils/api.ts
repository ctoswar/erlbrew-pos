const BASE_URL = import.meta.env.VITE_API_URL || '';

function getApiUrl(path: string) {
  return `${BASE_URL}/api${path}`;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const json = JSON.parse(text);
      if (json && typeof json === 'object') {
        const msg = json.error || json.message || json.detail;
        if (msg) return String(msg);
      }
    } catch { /* not JSON */ }
    return text.slice(0, 500);
  } catch {
    return '';
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const errBody = await readErrorBody(res);
    throw new Error(`API ${path} failed: ${res.status}${errBody ? ` — ${errBody}` : ''}`);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await readErrorBody(res);
    throw new Error(`API ${path} failed: ${res.status}${errBody ? ` — ${errBody}` : ''}`);
  }
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await readErrorBody(res);
    throw new Error(`API ${path} failed: ${res.status}${errBody ? ` — ${errBody}` : ''}`);
  }
  return res.json();
}

// Token storage for admin auth
let authToken: string | null = null;

export function setAuthToken(token: string | null | undefined) {
  authToken = token ?? null;
  if (token) {
    localStorage.setItem('erlbrew_token', token);
  } else {
    localStorage.removeItem('erlbrew_token');
  }
}

export function getAuthToken(): string | null {
  // Always re-read from localStorage to catch changes in other tabs
  const stored = localStorage.getItem('erlbrew_token');
  if (stored && stored !== 'null' && stored !== 'undefined' && stored.trim().length > 0) {
    authToken = stored;
  } else {
    authToken = null;
  }
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('erlbrew_token');
}

export function getApiUrlBase(): string {
  return BASE_URL;
}

export async function apiAdminGet<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401 && token) {
      // Token exists but is invalid/expired - clear it locally
      clearAuthToken();
    }
    const errBody = await readErrorBody(res);
    throw new Error(`API ${path} failed: ${res.status}${errBody ? ` — ${errBody}` : ''}`);
  }
  return res.json();
}

export async function apiAdminPost<T>(path: string, body: unknown, tokenOverride?: string): Promise<T> {
  const token = tokenOverride || getAuthToken();
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearAuthToken();
    }
    const errBody = await readErrorBody(res);
    throw new Error(`API ${path} failed: ${res.status}${errBody ? ` — ${errBody}` : ''}`);
  }
  return res.json();
}

export async function apiAdminPut<T>(path: string, body: unknown): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearAuthToken();
    }
    const errBody = await readErrorBody(res);
    throw new Error(`API ${path} failed: ${res.status}${errBody ? ` — ${errBody}` : ''}`);
  }
  return res.json();
}

export async function apiAdminDelete<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    method: 'DELETE',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401 && token) {
      clearAuthToken();
    }
    const errBody = await readErrorBody(res);
    throw new Error(`API ${path} failed: ${res.status}${errBody ? ` — ${errBody}` : ''}`);
  }
  return res.json();
}

// Reset COGS data (set totals = subtotals for selected range or all)
export async function resetCogs(start?: string, end?: string, resetAll?: boolean): Promise<{ ok: boolean; message: string }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/orders/cogs/reset'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ start, end, resetAll }),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API /orders/cogs/reset failed: ${res.status}`);
  }
  return res.json();
}

// Reset all inventory costs to 0
export async function resetInventoryCosts(): Promise<{ ok: boolean; message: string }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/inventory/reset-costs'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API /inventory/reset-costs failed: ${res.status}`);
  }
  return res.json();
}

// Clear all orders from database (admin only - for fresh start)
export async function clearAllOrders(): Promise<{ ok: boolean; message: string }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/orders/all'), {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 403) throw new Error('Admin access required — you must be logged in as Manager');
    throw new Error(`API /orders/all failed: ${res.status} — ${body}`);
  }
  return res.json();
}

// Clear all inventory from database (admin only - for fresh start)
export async function clearAllInventory(): Promise<{ ok: boolean; message: string }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/inventory/all'), {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API /inventory/all failed: ${res.status}`);
  }
  return res.json();
}

// Supplier Invoice API
export interface SupplierInvoice {
  id?: number;
  invoice_number: string;
  supplier_name: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  items?: SupplierInvoiceItem[];
}

export interface SupplierInvoiceItem {
  id?: number;
  invoice_id?: number;
  item_description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export async function getSupplierInvoices(): Promise<SupplierInvoice[]> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/supplier-invoices'), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API failed: ${res.status}`);
  }
  return res.json();
}

export async function getSupplierInvoice(id: number): Promise<SupplierInvoice> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/supplier-invoices/${id}`), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API failed: ${res.status}`);
  }
  return res.json();
}

export async function createSupplierInvoice(invoice: Omit<SupplierInvoice, 'id'>): Promise<{ ok: boolean; id: number }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/supplier-invoices'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(invoice),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API failed: ${res.status}`);
  }
  return res.json();
}

export async function updateSupplierInvoice(id: number, invoice: Partial<SupplierInvoice>): Promise<{ ok: boolean }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/supplier-invoices/${id}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(invoice),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteSupplierInvoice(id: number): Promise<{ ok: boolean }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/supplier-invoices/${id}`), {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API failed: ${res.status}`);
  }
  return res.json();
}

// Company Settings API
export interface CompanySettings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo: string;
  print_server_url: string;
  /** Public base URL — used to build integration webhook callback URLs */
  base_url?: string;
  /** Promotional messages for the customer display — JSON array of strings (issue #174) */
  promo_messages?: string;
}

/** promo_messages is stored as a JSON array of strings — invalid or empty input → [] */
export function parsePromoMessages(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is string => typeof m === 'string' && m.trim() !== '')
      .map((m) => m.trim());
  } catch {
    return [];
  }
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const res = await fetch(getApiUrl('/company-settings'), {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function updateCompanySettings(settings: Partial<CompanySettings>): Promise<{ ok: boolean }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/company-settings'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API failed: ${res.status}`);
  }
  return res.json();
}

// Integrations API (Phase 2 — issue #127)
export interface IntegrationField {
  configured: boolean;
  /** Masked preview for secrets (never the raw value) */
  masked?: string;
  /** Plain value for non-secret fields */
  value?: string;
}

export interface IntegrationProviderStatus {
  label: string;
  enabled: boolean;
  webhook_url: string | null;
  /** False for providers without a callback endpoint (e.g. accounting/OAuth). */
  has_webhook?: boolean;
  fields: Record<string, IntegrationField>;
}

export type IntegrationsStatus = Record<string, IntegrationProviderStatus>;

export async function getIntegrations(): Promise<IntegrationsStatus> {
  return apiAdminGet<IntegrationsStatus>('/integrations');
}

export async function updateIntegration(
  provider: string,
  body: Record<string, string | boolean | undefined>
): Promise<IntegrationProviderStatus> {
  return apiAdminPut<IntegrationProviderStatus>(`/integrations/${provider}`, body);
}

export async function testIntegration(provider: string): Promise<{ ok: boolean; message: string }> {
  return apiAdminPost<{ ok: boolean; message: string }>(`/integrations/${provider}/test`, {});
}

export async function getEnabledIntegrations(): Promise<Record<string, boolean>> {
  return apiGet<Record<string, boolean>>('/integrations/enabled');
}

// ─── Accounting API (Phase 2 — Roadmap: QuickBooks + Xero) ───────────────────
/** Accounting providers under /api/accounting/:provider */
export type AccountingProvider = 'quickbooks' | 'xero';

export interface AccountingStatus {
  provider: AccountingProvider;
  label?: string;
  enabled?: boolean;
  /** OAuth completed — tokens stored (possibly refresh-only) */
  connected: boolean;
  /** 'live' when real credentials/tokens are in play, 'mock' otherwise */
  mode?: 'live' | 'mock';
  accessTokenLive?: boolean;
  canRefresh?: boolean;
  /** QuickBooks realm (Intuit companyId) */
  realmId?: string | null;
  /** Xero authorised tenant (organisation) id */
  tenantId?: string | null;
  environment?: string;
  expiresAt?: string | null;
  /** Alias of expiresAt on newer responses */
  tokenExpiresAt?: string | null;
  connectedAt?: string | null;
  clientIdConfigured: boolean;
  clientSecretConfigured?: boolean;
  /** Server-side dry-run forced (env var) — payloads are built but never sent */
  dryRunForced?: boolean;
  /** What this provider can sync, e.g. ['invoice','bill'] or ['invoice','reconcile'] */
  features?: string[];
}

export type AccountingSyncStatus = 'success' | 'dry_run' | 'skipped' | 'failed';

export interface AccountingSyncResult {
  period: string;
  status: AccountingSyncStatus;
  reason?: string;
  externalId?: string | null;
  docNumber?: string;
  error?: string;
  /** Present on dry_run rows — the exact payload that would be sent */
  payload?: unknown;
}

export interface AccountingSyncResponse {
  provider: AccountingProvider;
  kind?: 'invoice' | 'bill';
  dryRunRequested?: boolean;
  /** True only when the payloads were actually pushed to the provider */
  live: boolean;
  mode?: 'live' | 'mock';
  results: AccountingSyncResult[];
  /** Present on older responses — always derivable from `results` */
  counts?: Record<AccountingSyncStatus, number>;
}

export interface AccountingSyncLogEntry {
  id: number;
  /** 'invoice' | 'bill' | 'reconcile' (snake_case `sync_type` on the wire) */
  type: string;
  period: string;
  status: string;
  externalId: string | null;
  summary: { txnDate?: string; docNumber?: string; total?: number; lines?: number } | null;
  error: string | null;
  createdAt: string;
}

/** Raw row from `accounting_sync_logs` — snake_case as returned by the backend. */
interface AccountingSyncLogRow {
  id: number;
  sync_type?: string;
  type?: string;
  period_key?: string;
  period?: string;
  status?: string;
  external_id?: string | null;
  externalId?: string | null;
  summary?: AccountingSyncLogEntry['summary'];
  error?: string | null;
  created_at?: string;
  createdAt?: string;
}

export type AccountingReconcileStatus = 'matched' | 'unmatched';

export interface AccountingReconcileResult {
  date: string;
  description: string;
  amount: number;
  status: AccountingReconcileStatus;
  orderId?: string | number | null;
  drawerTransactionId?: number | null;
  reason?: string | null;
}

export interface AccountingReconcileResponse {
  provider: AccountingProvider;
  dryRun: boolean;
  live: boolean;
  mode?: 'live' | 'mock';
  matched: number;
  unmatched: number;
  /** Total amount difference between recorded transactions and the statement */
  variance: number;
  summary?: Record<string, unknown>;
  results: AccountingReconcileResult[];
  /** Present on dry-run responses — the exact payload that would be sent */
  payload?: unknown;
}

export function getAccountingStatus(provider: AccountingProvider): Promise<AccountingStatus> {
  return apiAdminGet<AccountingStatus>(`/accounting/${provider}/status`);
}

export function getAccountingConnect(provider: AccountingProvider): Promise<{
  url: string;
  redirectUri: string;
  environment: string;
}> {
  return apiAdminGet<{ url: string; redirectUri: string; environment: string }>(
    `/accounting/${provider}/connect`
  );
}

export function syncAccounting(
  provider: AccountingProvider,
  body: { kind: 'invoice' | 'bill'; start: string; end?: string; dryRun?: boolean; force?: boolean }
): Promise<AccountingSyncResponse> {
  return apiAdminPost<AccountingSyncResponse>(`/accounting/${provider}/sync`, body);
}

/** Xero — match recorded cash/card transactions against a bank statement feed. */
export function reconcileAccounting(
  provider: AccountingProvider,
  body: { start: string; end?: string; dryRun?: boolean }
): Promise<AccountingReconcileResponse> {
  return apiAdminPost<AccountingReconcileResponse>(`/accounting/${provider}/reconcile`, body);
}

export function getAccountingSyncLog(
  provider: AccountingProvider,
  limit = 20
): Promise<AccountingSyncLogEntry[]> {
  return apiAdminGet<AccountingSyncLogRow[]>(
    `/accounting/${provider}/sync-log?limit=${limit}`
  ).then(rows =>
    rows.map(row => ({
      id: row.id,
      type: row.sync_type ?? row.type ?? '',
      period: row.period_key ?? row.period ?? '',
      status: row.status ?? '',
      externalId: row.external_id ?? row.externalId ?? null,
      summary: row.summary ?? null,
      error: row.error ?? null,
      createdAt: row.created_at ?? row.createdAt ?? '',
    }))
  );
}

export function disconnectAccounting(provider: AccountingProvider): Promise<AccountingStatus> {
  return apiAdminPost<AccountingStatus>(`/accounting/${provider}/disconnect`, {});
}

export function testAccounting(provider: AccountingProvider): Promise<{ ok: boolean; message: string }> {
  return apiAdminPost<{ ok: boolean; message: string }>(`/accounting/${provider}/test`, {});
}

// Staff management
export interface CreateStaffData {
  rfid: string;
  name: string;
  role: string;
  initials?: string;
  color?: string;
  pin?: string; // 4-digit PIN
  location_id?: number | null;
}

export async function createStaff(data: CreateStaffData): Promise<{ id: number }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/staff'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Admin access required');
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

// Modifier API
export interface Modifier {
  id?: number;
  name: string;
  price: number;
  isDefault: boolean;
}

export async function getModifiers(menuItemId: string): Promise<Modifier[]> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/menu/${menuItemId}/modifiers`), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function createModifier(menuItemId: string, data: Omit<Modifier, 'id'>): Promise<Modifier> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/menu/${menuItemId}/modifiers`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

export async function updateModifier(id: number, data: Partial<Modifier>): Promise<{ ok: boolean }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/menu/modifiers/${id}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteModifier(id: number): Promise<{ ok: boolean }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/menu/modifiers/${id}`), {
    method: 'DELETE',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function batchApplyModifier(modifier: { name: string; price: number; isDefault: boolean }, menuItemIds: string[]): Promise<{ ok: boolean; created: number; skipped: number }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/menu/modifiers/batch-apply'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ modifier, menuItemIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

export async function batchApplyIngredients(items: { inventory_item_id: string; quantity: number }[], menuItemIds: string[], locationId?: number | null): Promise<{ ok: boolean; applied: number }> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/recipes/batch'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ items, menuItemIds, ...(locationId == null ? {} : { location_id: locationId }) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

export async function saveMenuSizes(menuItemId: string, sizes: { label: string; price: number; sortOrder?: number }[]): Promise<{ id: number; label: string; price: number; sortOrder: number }[]> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/menu/${menuItemId}/sizes`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ sizes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

// Z-Report API
export interface ZReport {
  id?: number;
  staff_id: number | null;
  report_date: string;
  period_start: string;
  period_end: string;
  total_sales: number;
  total_orders: number;
  total_cash: number;
  total_card: number;
  total_ewallet: number;
  total_refunds: number;
  total_voids: number;
  total_cogs: number;
  gross_profit: number;
  printed_at?: string;
}

export async function generateZReport(locationId?: number | null): Promise<ZReport> {
  const token = getAuthToken();
  const locationQuery = locationId == null ? "" : `?location_id=${encodeURIComponent(String(locationId))}`;
  const res = await fetch(getApiUrl(`/orders/z-report${locationQuery}`), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    body: JSON.stringify(locationId == null ? {} : { location_id: locationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

export async function getZReports(limit = 10, locationId?: number | null): Promise<ZReport[]> {
  const token = getAuthToken();
  const locationQuery = locationId == null ? "" : `&location_id=${encodeURIComponent(String(locationId))}`;
  const res = await fetch(getApiUrl(`/orders/z-reports?limit=${limit}${locationQuery}`), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export interface CashDrawer {
  id: number | null;
  shift_date: string;
  status: 'open' | 'closed';
  opening_float: number;
  cash_sales: number;
  cash_payouts: number;
  closing_amount: number;
  expected_amount: number;
  variance: number;
  notes: string;
}

export async function getCashDrawer(locationId?: number | null): Promise<CashDrawer> {
  const token = getAuthToken();
  const locationQuery = locationId == null ? "" : `?location_id=${encodeURIComponent(String(locationId))}`;
  const res = await fetch(getApiUrl(`/orders/cash-drawer${locationQuery}`), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function openCashDrawer(openingFloat: number, locationId?: number | null): Promise<CashDrawer> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/orders/cash-drawer'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ opening_float: openingFloat, ...(locationId == null ? {} : { location_id: locationId }) }),
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

// Upload menu item image (multipart/form-data)
export async function uploadMenuItemImage(id: string, file: File): Promise<{ imageUrl: string }> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(getApiUrl(`/menu/${id}/image`), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export interface CashDrawerTransaction {
  id: number;
  drawer_id: number;
  transaction_type: 'cash_in' | 'cash_out' | 'sale' | 'payout';
  amount: number;
  balance_before: number;
  balance_after: number;
  reason: string | null;
  staff_name: string | null;
  created_at: string;
}

export async function getCashDrawerTransactions(locationId?: number | null): Promise<CashDrawerTransaction[]> {
  const token = getAuthToken();
  const locationQuery = locationId == null ? "" : `?location_id=${encodeURIComponent(String(locationId))}`;
  const res = await fetch(getApiUrl(`/orders/cash-drawer/transactions${locationQuery}`), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function createCashDrawerTransaction(data: {
  transaction_type: 'cash_in' | 'cash_out';
  amount: number;
  reason?: string;
  staff_name?: string;
  location_id?: number | null;
}): Promise<CashDrawerTransaction> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/orders/cash-drawer/transactions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed' }));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

export async function updateCashDrawer(id: number, data: {
  closing_amount?: number;
  cash_payouts?: number;
  notes?: string;
  action?: 'save' | 'close';
  location_id?: number | null;
}): Promise<CashDrawer> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/orders/cash-drawer/${id}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

// --- Audit Logs ---

export interface AuditLog {
  id: number;
  staff_id: string | null;
  staff_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export async function getAuditLogs(params?: {
  startDate?: string;
  endDate?: string;
  action?: string;
  staffId?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.startDate) qs.append('startDate', params.startDate);
  if (params?.endDate) qs.append('endDate', params.endDate);
  if (params?.action) qs.append('action', params.action);
  if (params?.staffId) qs.append('staffId', params.staffId);
  if (params?.entityType) qs.append('entityType', params.entityType);
  if (params?.limit) qs.append('limit', String(params.limit));
  if (params?.offset) qs.append('offset', String(params.offset));
  const res = await fetch(getApiUrl(`/audit-logs?${qs.toString()}`), {
    headers: { ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

// --- Customers ---

export interface Customer {
  id: number;
  phone: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export async function getCustomers(search?: string, limit = 50): Promise<Customer[]> {
  const qs = new URLSearchParams();
  if (search) qs.append('search', search);
  qs.append('limit', String(limit));
  const res = await fetch(getApiUrl(`/customers?${qs.toString()}`), {
    headers: { ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function getTopCustomers(limit = 10): Promise<Customer[]> {
  const res = await fetch(getApiUrl(`/customers/top?limit=${limit}`), {
    headers: { ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function getCustomer(id: number): Promise<Customer> {
  const res = await fetch(getApiUrl(`/customers/${id}`), {
    headers: { ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function getCustomerOrders(id: number, locationId?: number | null): Promise<Record<string, unknown>[]> {
  const locationQuery = locationId == null ? "" : `?location_id=${encodeURIComponent(String(locationId))}`;
  const res = await fetch(getApiUrl(`/customers/${id}/orders${locationQuery}`), {
    headers: { ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function createCustomer(data: { phone: string; name?: string; email?: string; notes?: string }): Promise<Customer> {
  const res = await fetch(getApiUrl('/customers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
  const res = await fetch(getApiUrl(`/customers/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

// --- Customer loyalty lookup (public, minimal payload — issue #173) ---

/** Snake_case response from GET /api/customers/lookup — never includes email/password_hash */
interface CustomerLoyaltyResponse {
  found: boolean;
  name?: string | null;
  loyalty_points?: number | null;
  loyalty_tier?: string | null;
}

/** camelCase view of the lookup result used by the customer display */
export interface CustomerLoyalty {
  found: boolean;
  name?: string;
  loyaltyPoints?: number;
  loyaltyTier?: string;
}

export async function lookupCustomerByPhone(phone: string): Promise<CustomerLoyalty> {
  const res = await fetch(getApiUrl(`/customers/lookup?phone=${encodeURIComponent(phone)}`), {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  const data: CustomerLoyaltyResponse = await res.json();
  if (!data.found) return { found: false };
  return {
    found: true,
    name: data.name || undefined,
    loyaltyPoints: Number(data.loyalty_points) || 0,
    loyaltyTier: data.loyalty_tier || undefined,
  };
}

// --- Reports ---

export interface DailySalesReport {
  date: string;
  revenue: number;
  orders: number;
  cogs: number;
  profit: number;
}

export interface SalesReportSummary {
  totalRevenue: number;
  totalOrders: number;
  avgOrder: number;
  totalCOGS: number;
  grossProfit: number;
}

export async function getSalesReport(start: string, end: string, locationId?: number | null): Promise<{ data: DailySalesReport[]; summary: SalesReportSummary }> {
  const locationQuery = locationId == null ? "" : `&location_id=${encodeURIComponent(String(locationId))}`;
  const res = await fetch(getApiUrl(`/orders/reports/sales?start=${start}&end=${end}${locationQuery}`), {
    headers: { ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export interface StaffReport {
  staff_id: number;
  name: string;
  initials: string;
  color: string;
  orders: number;
  revenue: number;
  hoursWorked: number;
}

export async function getStaffReport(start: string, end: string, locationId?: number | null): Promise<StaffReport[]> {
  const locationQuery = locationId == null ? "" : `&location_id=${encodeURIComponent(String(locationId))}`;
  const res = await fetch(getApiUrl(`/orders/reports/staff?start=${start}&end=${end}${locationQuery}`), {
    headers: { ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

// --- Insights (Phase 3) ---

export type AbcClass = 'A' | 'B' | 'C';
export type MenuQuadrant = 'star' | 'workhorse' | 'hidden_gem' | 'dog' | 'unsold' | null;

export interface MenuItemInsight {
  id: string;
  name: string;
  category: string;
  price: number;
  emoji: string;
  qty: number;
  revenue: number;
  unitCogs: number | null;
  cogs: number | null;
  grossProfit: number | null;
  marginPct: number | null;
  abc: AbcClass;
  quadrant: MenuQuadrant;
}

export interface MenuInsights {
  windowDays: number;
  generatedAt: string;
  quality: {
    orderCount: number;
    weeksOfHistory: number;
    enoughHistory: boolean;
    itemsAnalyzed: number;
    itemsSold: number;
    itemsMissingCost: number;
    marginCoveragePct: number;
  };
  totals: {
    revenue: number;
    units: number;
    orderCount: number;
    avgOrderValue: number | null;
    grossProfit: number | null;
    profitCoveragePct: number;
    marginPct: number | null;
  };
  thresholds: { revenue: number | null; marginPct: number | null };
  items: MenuItemInsight[];
  best: MenuItemInsight[];
  worst: MenuItemInsight[];
  matrix: {
    star: MenuItemInsight[];
    workhorse: MenuItemInsight[];
    hidden_gem: MenuItemInsight[];
    dog: MenuItemInsight[];
  };
  uncosted: MenuItemInsight[];
}

export function getMenuInsights(days: number): Promise<MenuInsights> {
  return apiAdminGet<MenuInsights>(`/insights/menu?days=${days}`);
}