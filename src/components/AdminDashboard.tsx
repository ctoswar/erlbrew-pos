import React, { useState, useEffect, useCallback } from "react";
import { Order, Staff, InventoryItem, DiscountType } from "../types";
import { formatCurrency } from "../utils";
import { apiGet, clearAllOrders } from "../utils/api";
import { AdminStaff } from "./AdminStaff";
import { AdminMenu } from "./AdminMenu";
import { AdminPrintSettings } from "./AdminPrintSettings";
import { AdminInventory } from "./AdminInventory";
import { Dashboard } from "./Dashboard";
import { AdminReports } from "./AdminReports";
import { AdminSupplierInvoices } from "./AdminSupplierInvoices";
import { ZReportScreen } from "./ZReportScreen";
import { CashDrawerScreen } from "./CashDrawerScreen";
import { TimeKeeping } from "./TimeKeeping";
import { AdminPayroll } from "./AdminPayroll";
import { OrderHistory } from "./OrderHistory";
import { AdminAuditLog } from "./AdminAuditLog";
import { AdminCustomers } from "./AdminCustomers";

const STORAGE_KEY_ORDERS = 'erlbrew_admin_orders';
const STORAGE_KEY_INVENTORY = 'erlbrew_admin_inventory';
const STORAGE_KEY_LAST_SYNC = 'erlbrew_admin_last_sync';

interface Props {
  staff: Staff;
  onLogout: () => void;
}

type AdminTab = 'dashboard' | 'menu' | 'staff' | 'inventory' | 'cogs' | 'reports' | 'history' | 'suppliers' | 'settings' | 'backup' | 'zreport' | 'cashdrawer' | 'time' | 'payroll' | 'audit' | 'customers';

const TABS: { label: string; value: AdminTab; icon: string }[] = [
  { label: 'Dashboard', value: 'dashboard', icon: '📊' },
  { label: 'Reports', value: 'reports', icon: '📈' },
  { label: 'Order History', value: 'history', icon: '📋' },
  { label: 'Customers', value: 'customers', icon: '👤' },
  { label: 'Menu Items', value: 'menu', icon: '☕' },
  { label: 'Staff', value: 'staff', icon: '👥' },
  { label: 'Time Keeping', value: 'time', icon: '⏱️' },
  { label: 'Payroll', value: 'payroll', icon: '💵' },
  { label: 'Inventory', value: 'inventory', icon: '📦' },
  { label: 'Z-Report', value: 'zreport', icon: '📋' },
  { label: 'Cash Drawer', value: 'cashdrawer', icon: '💰' },
  { label: 'COGS', value: 'cogs', icon: '📊' },
  { label: 'Supplier Invoices', value: 'suppliers', icon: '📄' },
  { label: 'Audit Log', value: 'audit', icon: '🔍' },
  { label: 'Settings', value: 'settings', icon: '⚙️' },
  { label: 'Backup', value: 'backup', icon: '💾' },
];

export const AdminDashboard: React.FC<Props> = ({ staff, onLogout }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [serverMsg, setServerMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const storedOrders = localStorage.getItem(STORAGE_KEY_ORDERS);
    const storedInventory = localStorage.getItem(STORAGE_KEY_INVENTORY);
    const storedSync = localStorage.getItem(STORAGE_KEY_LAST_SYNC);

    if (storedOrders) {
      try {
        const parsed = JSON.parse(storedOrders);
        setOrders(parsed.map((o: Record<string, unknown>) => ({
          id: String(o.id ?? ''),
          items: Array.isArray(o.items) ? o.items : [],
          staff: o.staff && typeof o.staff === 'object' ? o.staff : { rfid: '', pin: '', name: 'Unknown', role: 'Barista' as const, initials: '??', color: '#666' },
          status: String(o.status ?? 'preparing') as Order['status'],
          subtotal: Number(o.subtotal ?? 0),
          tax: Number(o.tax ?? 0),
          total: Number(o.total ?? 0),
          createdAt: o.createdAt ? new Date(String(o.createdAt)) : new Date(),
          completedAt: o.completedAt ? new Date(String(o.completedAt)) : undefined,
          customerName: o.customerName ? String(o.customerName) : undefined,
          type: (o.type ?? 'dine-in') as Order['type'],
          payMethod: (o.payMethod || (o.pay_method as string) || 'cash') as Order['payMethod'],
          referenceNumber: o.referenceNumber ? String(o.referenceNumber) : (o.reference_number ? String(o.reference_number) : undefined),
          cashTendered: o.cashTendered ? Number(o.cashTendered) : undefined,
          discount: (() => {
            if (o.discount && typeof o.discount === 'object') return o.discount as Order['discount'];
            if (o.discount_json) {
              try {
                const parsed = JSON.parse(String(o.discount_json));
                if (parsed && typeof parsed === 'object' && parsed.label) {
                  return { type: parsed.type as DiscountType, label: String(parsed.label), value: Number(parsed.value) || 0, amount: Number(parsed.amount) || 0 };
                }
              } catch {}
            }
            return undefined;
          })(),
        })));
      } catch {}
    }
    if (storedInventory) { try { setInventory(JSON.parse(storedInventory)); } catch {} }
    if (storedSync) setLastSync(storedSync);
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(inventory)); }, [inventory]);

  const syncData = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const ordersData = await apiGet<Record<string, unknown>[]>('/orders');
      const transformedOrders = ordersData.map((o) => ({
        id: String(o.id ?? ''),
        items: Array.isArray(o.items) ? o.items : [],
        staff: o.staff_name ? {
          id: Number(o.staff_id ?? 0), name: String(o.staff_name),
          initials: String(o.staff_initials || ''), rfid: String(o.staff_rfid || ''),
          role: (String(o.staff_role || 'Barista').charAt(0).toUpperCase() + String(o.staff_role || 'Barista').slice(1)) as Staff['role'],
          color: String(o.staff_color || '#C9873A'), pin: ''
        } : { rfid: '', pin: '', name: 'Unknown', role: 'Barista' as const, initials: '??', color: '#666' },
        status: String(o.status ?? 'preparing') as Order['status'],
        subtotal: Number(o.subtotal ?? 0), tax: Number(o.tax ?? 0), total: Number(o.total ?? 0),
        createdAt: o.createdAt ? new Date(String(o.createdAt)) : o.created_at ? new Date(String(o.created_at)) : new Date(),
        completedAt: o.completedAt ? new Date(String(o.completedAt)) : o.completed_at ? new Date(String(o.completed_at)) : undefined,
        customerName: o.customer_name ? String(o.customer_name) : undefined,
        type: (o.type ?? 'dine-in') as Order['type'],
        payMethod: (String(o.payMethod || o.pay_method || 'cash')) as Order['payMethod'],
        referenceNumber: o.referenceNumber ? String(o.referenceNumber) : (o.reference_number ? String(o.reference_number) : undefined),
        cashTendered: o.cash_tendered ? Number(o.cash_tendered) : undefined,
        discount: (() => {
          if (!o.discount_json) return undefined;
          try {
            const parsed = JSON.parse(String(o.discount_json));
            if (parsed && typeof parsed === 'object' && parsed.label) {
              return { type: parsed.type as DiscountType, label: String(parsed.label), value: Number(parsed.value) || 0, amount: Number(parsed.amount) || 0 };
            }
          } catch {}
          return undefined;
        })(),
      }));
      setOrders(transformedOrders);
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(transformedOrders));

      const invData = await apiGet<InventoryItem[]>('/inventory');
      setInventory(invData);
      localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(invData));

      const now = new Date().toLocaleString();
      setLastSync(now);
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, now);

      setSyncStatus('ok');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, []);

  useEffect(() => { syncData().finally(() => setLoading(false)); }, [syncData]);
  useEffect(() => { if (activeTab === 'dashboard') syncData(); }, [activeTab, syncData]);

  const calculateCOGS = useCallback((startDate?: string, endDate?: string) => {
    let filtered = orders;
    if (startDate && endDate) {
      filtered = orders.filter(o => { const d = new Date(o.createdAt).toISOString().split('T')[0]; return d >= startDate && d <= endDate; });
    }
    let totalCOGS = 0, totalRevenue = 0;
    const details: { order_id: string; total: number; cogs: number; profit: number }[] = [];
    for (const order of filtered) {
      const subtotal = Number(order.subtotal) || 0;
      const total = Number(order.total) || 0;
      const cogs = order.discount?.amount ? subtotal * 0.3 - (Number(order.discount.amount) * 0.3) : subtotal * 0.3;
      const profit = total - cogs;
      totalCOGS += cogs; totalRevenue += total;
      details.push({ order_id: order.id, total, cogs, profit });
    }
    return { cogs: totalCOGS || 0, revenue: totalRevenue || 0, profit: (totalRevenue - totalCOGS) || 0, details };
  }, [orders]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), orders, inventory, staff: { name: staff.name, role: staff.role } }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `erlbrew-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.orders) { setOrders(data.orders.map((o: any) => ({ ...o, createdAt: new Date(o.createdAt) }))); localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(data.orders)); }
        if (data.inventory) { setInventory(data.inventory); localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(data.inventory)); }
        alert('Data imported successfully!');
      } catch { alert('Invalid backup file'); }
    };
    reader.readAsText(file);
  };

  const clearLocalData = () => {
    if (confirm('Clear all local backup data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY_ORDERS); localStorage.removeItem(STORAGE_KEY_INVENTORY); localStorage.removeItem(STORAGE_KEY_LAST_SYNC);
      setOrders([]); setInventory([]); setLastSync(null);
    }
  };

  const clearServerOrders = async () => {
    if (!confirm('FRESH START — Delete EVERYTHING except staff accounts?')) return;
    if (!confirm('This will delete ALL orders, inventory, menu items, recipes, time records, invoices, Z-reports, and cash drawer data. Staff accounts will be preserved.')) return;
    try {
      const result = await clearAllOrders();
      setServerMsg({ text: result.message, type: 'success' });
      localStorage.removeItem(STORAGE_KEY_ORDERS); localStorage.removeItem(STORAGE_KEY_INVENTORY);
      localStorage.removeItem('erlbrew_local_orders'); localStorage.removeItem('erlbrew_pending_queue');
      setOrders([]); setInventory([]); syncData();
    } catch (e: any) { setServerMsg({ text: e.message || 'Failed to delete orders', type: 'error' }); }
    setTimeout(() => setServerMsg(null), 4000);
  };

  const summary = calculateCOGS();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-erl-base">
        <div className="text-center">
          <div className="text-2xl mb-3">Loading...</div>
          <div className="text-xs text-erl-text-muted">Syncing data from server</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-erl-base">
      {/* Sidebar */}
      <div className="w-[220px] bg-erl-sidebar border-r border-erl-border-default flex flex-col">
        <div className="p-5 border-b border-erl-border-default">
          <div className="font-display text-base text-erl-accent mb-1">Admin Panel</div>
          <div className="text-[10px] text-erl-text-muted">{staff.name} ({staff.role})</div>
        </div>

        <nav className="flex-1 p-3">
          {TABS.map(({ label, value, icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`w-full flex items-center gap-2.5 py-2.5 px-3 mb-1 rounded-xl border-none cursor-pointer text-[11px] text-left transition-all duration-200 ${
                activeTab === value
                  ? 'bg-erl-accent/8 text-erl-accent font-semibold shadow-[0_0_16px_rgba(196,149,106,0.06)]'
                  : 'bg-transparent text-erl-text-muted hover:bg-white/[0.03] hover:text-erl-text-secondary'
              }`}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-erl-border-default">
          <div className="text-[9px] text-erl-text-muted mb-1.5 tracking-wide">Last Sync</div>
          <div className="text-[10px] text-erl-text-secondary mb-2">{lastSync || 'Never'}</div>
          <button onClick={syncData} disabled={syncStatus === 'syncing'}
            className={`w-full py-2.5 text-[9px] rounded-xl border transition-all duration-200 ${
              syncStatus === 'syncing'
                ? 'bg-erl-accent/8 text-erl-accent cursor-wait border-erl-accent/20'
                : 'bg-transparent text-erl-accent hover:bg-erl-accent/5 cursor-pointer border-erl-accent/15 hover:border-erl-accent/30'
            }`}
          >
            {syncStatus === 'syncing' ? '⟳ Syncing...' : '⟳ Sync Now'}
          </button>
          {syncStatus === 'ok' && <div className="text-[8px] text-erl-success mt-1">✓ Synced</div>}
          {syncStatus === 'error' && <div className="text-[8px] text-erl-danger mt-1">✗ Failed</div>}
        </div>

        <div className="p-3 border-t border-erl-border-default">
          <button onClick={onLogout} className="w-full py-2.5 text-[9px] rounded-xl border-none bg-white/[0.03] text-erl-text-muted cursor-pointer hover:bg-white/[0.06] hover:text-erl-text-secondary transition-all duration-200">
            ← Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'dashboard' && <Dashboard orders={orders} staffName={staff.name} />}
        {activeTab === 'reports' && <AdminReports />}
        {activeTab === 'history' && <OrderHistory />}
        {activeTab === 'menu' && <AdminMenu />}
        {activeTab === 'staff' && <AdminStaff />}
        {activeTab === 'inventory' && <AdminInventory />}
        {activeTab === 'settings' && (
          <div>
            <h2 className="text-lg text-erl-text-primary mb-5">Settings</h2>
            <div className="bg-erl-surface rounded-xl border border-erl-border-subtle">
              <AdminPrintSettings />
            </div>
          </div>
        )}
        {activeTab === 'cogs' && (
          <div>
            <h2 className="text-lg text-erl-text-primary mb-5">Cost Analysis</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Revenue', value: formatCurrency(summary.revenue || 0), color: 'text-erl-accent' },
                { label: 'Total COGS', value: formatCurrency(summary.cogs || 0), color: 'text-erl-text-primary' },
                { label: 'Gross Profit', value: formatCurrency(summary.profit || 0), color: (summary.profit || 0) >= 0 ? 'text-erl-success' : 'text-erl-danger' },
                { label: 'Orders', value: summary.details.length, color: 'text-erl-text-secondary' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-erl-surface rounded-xl p-4 border border-erl-border-subtle">
                  <div className="text-[9px] text-erl-text-muted tracking-[1.5px] uppercase mb-2">{label}</div>
                  <div className={`font-display text-[22px] font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>
            <div className="bg-erl-surface rounded-xl overflow-hidden">
              <div className="py-3 px-4 border-b border-erl-border-subtle text-[11px] font-semibold text-erl-text-muted">
                ORDER BREAKDOWN ({summary.details.length} orders)
              </div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-erl-border-default">
                    <th className="py-2.5 px-3 text-left text-erl-text-muted font-semibold">Order</th>
                    <th className="py-2.5 px-3 text-right text-erl-text-muted font-semibold">Revenue</th>
                    <th className="py-2.5 px-3 text-right text-erl-text-muted font-semibold">COGS</th>
                    <th className="py-2.5 px-3 text-right text-erl-text-muted font-semibold">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.details.slice(0, 50).map(d => (
                    <tr key={d.order_id} className="border-b border-erl-border-subtle">
                      <td className="py-2.5 px-3 text-erl-text-secondary">#{d.order_id.slice(0, 8)}</td>
                      <td className="py-2.5 px-3 text-right text-erl-text-secondary">{formatCurrency(d.total || 0)}</td>
                      <td className="py-2.5 px-3 text-right text-erl-text-muted">{formatCurrency(d.cogs || 0)}</td>
                      <td className={`py-2.5 px-3 text-right ${(d.profit || 0) >= 0 ? 'text-erl-success' : 'text-erl-danger'}`}>{formatCurrency(d.profit || 0)}</td>
                    </tr>
                  ))}
                  {summary.details.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-erl-text-muted">No data available. Sync to fetch orders.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'zreport' && (
          <div>
            <h2 className="text-lg text-erl-text-primary mb-5">📋 Z-Report</h2>
            <ZReportScreen />
          </div>
        )}
        {activeTab === 'cashdrawer' && (
          <div>
            <h2 className="text-lg text-erl-text-primary mb-5">💰 Cash Drawer</h2>
            <CashDrawerScreen />
          </div>
        )}
{activeTab === 'time' && <TimeKeeping />}
{activeTab === 'payroll' && <AdminPayroll />}
{activeTab === 'suppliers' && <AdminSupplierInvoices />}
        {activeTab === 'audit' && <AdminAuditLog />}
        {activeTab === 'customers' && <AdminCustomers />}
        {activeTab === 'backup' && (
          <div>
            <h2 className="text-lg text-erl-text-primary mb-5">Backup & Restore</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-erl-surface rounded-xl p-6 border border-erl-border-subtle">
                <h3 className="text-[13px] text-erl-text-primary mb-2">📤 Export Backup</h3>
                <p className="text-[11px] text-erl-text-muted mb-4">Download all orders and inventory data to a JSON file.</p>
                <div className="text-[10px] text-erl-text-muted mb-3">Orders: {orders.length} | Inventory: {inventory.length} items</div>
                <button onClick={exportData} disabled={orders.length === 0 && inventory.length === 0}
                  className="py-2.5 px-5 text-[11px] rounded-lg border border-erl-accent bg-erl-accent text-erl-base cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                  Download Backup
                </button>
              </div>
              <div className="bg-erl-surface rounded-xl p-6 border border-erl-border-subtle">
                <h3 className="text-[13px] text-erl-text-primary mb-2">📥 Import Backup</h3>
                <p className="text-[11px] text-erl-text-muted mb-4">Restore data from a previously downloaded backup file.</p>
                <input type="file" accept=".json" onChange={importData} id="backup-file" className="hidden" />
                <label htmlFor="backup-file" className="inline-block py-2.5 px-5 text-[11px] rounded-lg border border-erl-border-default bg-erl-base text-erl-text-primary cursor-pointer">
                  Select Backup File
                </label>
              </div>
              <div className="bg-erl-surface rounded-xl p-6 border border-erl-danger col-span-2">
                <h3 className="text-[13px] text-erl-danger mb-2">⚠️ Clear Local Data</h3>
                <p className="text-[11px] text-erl-text-muted mb-4">Remove all locally stored backup data. This will NOT affect data on the server.</p>
                <button onClick={clearLocalData} className="py-2.5 px-5 text-[11px] rounded-lg border border-erl-danger bg-transparent text-erl-danger cursor-pointer hover:bg-erl-danger/5">
                  Clear Local Data
                </button>
              </div>
              <div className="bg-erl-surface rounded-xl p-6 border-2 border-erl-danger col-span-2">
                <h3 className="text-[13px] text-erl-danger mb-2">☠️ Fresh Start — Delete Everything (Except Staff)</h3>
                <p className="text-[11px] text-erl-text-muted mb-4">Permanently DELETE ALL transaction data from the server. Staff accounts are preserved. This CANNOT be undone.</p>
                <button onClick={clearServerOrders} className="py-2.5 px-5 text-[11px] rounded-lg border border-erl-danger bg-erl-danger text-white cursor-pointer font-bold hover:bg-erl-danger/90">
                  🗑️ Fresh Start (Keep Staff Only)
                </button>
                {serverMsg && (
                  <div className={`mt-3 text-[11px] font-semibold ${serverMsg.type === 'success' ? 'text-erl-success' : 'text-erl-danger'}`}>
                    {serverMsg.text}
                  </div>
                )}
              </div>
              <div className="bg-erl-surface rounded-xl p-6 border border-erl-border-subtle col-span-2">
                <h3 className="text-[13px] text-erl-text-primary mb-2">ℹ️ About Local Backup</h3>
                <p className="text-[11px] text-erl-text-muted mb-2">This admin panel stores data in your browser's localStorage. This means:</p>
                <ul className="text-[11px] text-erl-text-muted ml-4 list-disc">
                  <li>Data survives server restarts</li>
                  <li>Data is stored locally on THIS browser/device only</li>
                  <li>Data syncs from server when you click "Sync Now"</li>
                  <li>You can export backups for safekeeping</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
