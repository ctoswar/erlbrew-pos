const BASE_URL = import.meta.env.VITE_API_URL || '';

function getApiUrl(path: string) {
  return `${BASE_URL}/api${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
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
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiAdminPost<T>(path: string, body: unknown): Promise<T> {
  const token = getAuthToken();
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
    throw new Error(`API ${path} failed: ${res.status}`);
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
    throw new Error(`API ${path} failed: ${res.status}`);
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
    throw new Error(`API ${path} failed: ${res.status}`);
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
    if (res.status === 403) throw new Error('Admin access required');
    throw new Error(`API /orders/all failed: ${res.status}`);
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

// Staff management
export interface CreateStaffData {
  rfid: string;
  name: string;
  role: string;
  initials?: string;
  color?: string;
  pin?: string; // 4-digit PIN
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

export async function generateZReport(): Promise<ZReport> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl('/orders/z-report'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API failed: ${res.status}`);
  }
  return res.json();
}

export async function getZReports(limit = 10): Promise<ZReport[]> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/orders/z-reports?limit=${limit}`), {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

// ── Cash Drawer ──────────────────────────────────────────────────────────────

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

export async function getCashDrawer(): Promise<CashDrawer> {
  const res = await fetch(getApiUrl('/orders/cash-drawer'), { credentials: 'include' });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function openCashDrawer(openingFloat: number): Promise<CashDrawer> {
  const res = await fetch(getApiUrl('/orders/cash-drawer'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ opening_float: openingFloat }),
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

// ── Cash Drawer Transactions ──────────────────────────────────────────────────

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

export async function getCashDrawerTransactions(): Promise<CashDrawerTransaction[]> {
  const res = await fetch(getApiUrl('/orders/cash-drawer/transactions'), { credentials: 'include' });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function createCashDrawerTransaction(data: {
  transaction_type: 'cash_in' | 'cash_out';
  amount: number;
  reason?: string;
  staff_name?: string;
}): Promise<CashDrawerTransaction> {
  const res = await fetch(getApiUrl('/orders/cash-drawer/transactions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
}): Promise<CashDrawer> {
  const res = await fetch(getApiUrl(`/orders/cash-drawer/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}