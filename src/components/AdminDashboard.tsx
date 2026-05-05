import React, { useState, useEffect, useCallback } from "react";
import { Order, Staff, InventoryItem } from "../types";
import { formatCurrency } from "../utils";
import { apiGet } from "../utils/api";
import { AdminStaff } from "./AdminStaff";
import { AdminMenu } from "./AdminMenu";
import { AdminPrintSettings } from "./AdminPrintSettings";
import { AdminInventory } from "./AdminInventory";

const STORAGE_KEY_ORDERS = 'erlbrew_admin_orders';
const STORAGE_KEY_INVENTORY = 'erlbrew_admin_inventory';
const STORAGE_KEY_LAST_SYNC = 'erlbrew_admin_last_sync';

interface Props {
  staff: Staff;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ staff, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'inventory' | 'cogs' | 'backup' | 'staff' | 'settings'>('menu');
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');

  // Load from localStorage on mount
  useEffect(() => {
    const storedOrders = localStorage.getItem(STORAGE_KEY_ORDERS);
    const storedInventory = localStorage.getItem(STORAGE_KEY_INVENTORY);
    const storedSync = localStorage.getItem(STORAGE_KEY_LAST_SYNC);

    if (storedOrders) {
      try {
        const parsed = JSON.parse(storedOrders);
        setOrders(parsed.map((o: any) => ({
          ...o,
          createdAt: new Date(o.createdAt)
        })));
      } catch {}
    }
    if (storedInventory) {
      try {
        setInventory(JSON.parse(storedInventory));
      } catch {}
    }
    if (storedSync) {
      setLastSync(storedSync);
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (orders.length > 0) {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    }
  }, [orders]);

  useEffect(() => {
    if (inventory.length > 0) {
      localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(inventory));
    }
  }, [inventory]);

  // Fetch from server and update localStorage
  const syncData = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      // Fetch orders (public endpoint)
      const ordersData = await apiGet<Order[]>('/orders');
      setOrders(ordersData.map((o: any) => ({
        ...o,
        createdAt: new Date(o.createdAt)
      })));
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(ordersData));

      // Fetch inventory
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

  // Auto-sync on mount
  useEffect(() => {
    syncData().finally(() => setLoading(false));
  }, [syncData]);

  // Calculate COGS from orders and inventory
  const calculateCOGS = useCallback((startDate?: string, endDate?: string) => {
    let filteredOrders = orders;

    if (startDate && endDate) {
      filteredOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
        return orderDate >= startDate && orderDate <= endDate;
      });
    }

    let totalCOGS = 0;
    let totalRevenue = 0;
    const details: { order_id: string; total: number; cogs: number; profit: number }[] = [];

    for (const order of filteredOrders) {
      const subtotal = order.subtotal || 0;
      const total = order.total || 0;
      // COGS calculation: for now estimate as 30% of subtotal (real implementation would use recipe costs)
      const cogs = order.discount?.amount
        ? subtotal * 0.3 - (order.discount.amount * 0.3)
        : subtotal * 0.3;
      const profit = total - cogs;

      totalCOGS += cogs;
      totalRevenue += total;
      details.push({ order_id: order.id, total, cogs, profit });
    }

    return { cogs: totalCOGS, revenue: totalRevenue, profit: totalRevenue - totalCOGS, details };
  }, [orders]);

  // Backup/Export functions
  const exportData = () => {
    const data = {
      exportDate: new Date().toISOString(),
      orders,
      inventory,
      staff: { name: staff.name, role: staff.role }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erlbrew-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.orders) {
          setOrders(data.orders.map((o: any) => ({
            ...o,
            createdAt: new Date(o.createdAt)
          })));
          localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(data.orders));
        }
        if (data.inventory) {
          setInventory(data.inventory);
          localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(data.inventory));
        }
        alert('Data imported successfully!');
      } catch {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const clearLocalData = () => {
    if (confirm('Clear all local backup data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY_ORDERS);
      localStorage.removeItem(STORAGE_KEY_INVENTORY);
      localStorage.removeItem(STORAGE_KEY_LAST_SYNC);
      setOrders([]);
      setInventory([]);
      setLastSync(null);
    }
  };

  const summary = calculateCOGS();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>Loading...</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Syncing data from server</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <div style={{
        width: 220,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border-default)' }}>
          <div className="font-display" style={{ fontSize: 16, color: 'var(--gold)', marginBottom: 4 }}>Admin Panel</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{staff.name} ({staff.role})</div>
        </div>

        <nav style={{ flex: 1, padding: 12 }}>
          {[
            ['Menu Items', 'menu', '☕'],
            ['Staff', 'staff', '👥'],
            ['Inventory', 'inventory', '📦'],
            ['COGS', 'cogs', '💰'],
            ['Settings', 'settings', '⚙️'],
            ['Backup', 'backup', '💾'],
          ].map(([label, value, icon]) => (
            <button
              key={value}
              onClick={() => setActiveTab(value as any)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 4,
                borderRadius: 8,
                border: 'none',
                background: activeTab === value ? 'rgba(201,135,58,0.15)' : 'transparent',
                color: activeTab === value ? 'var(--gold)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: activeTab === value ? 600 : 400,
                textAlign: 'left',
              }}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 1 }}>Last Sync</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {lastSync || 'Never'}
          </div>
          <button
            onClick={syncData}
            disabled={syncStatus === 'syncing'}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 9,
              borderRadius: 6,
              border: '1px solid var(--gold)',
              background: syncStatus === 'syncing' ? 'rgba(201,135,58,0.1)' : 'transparent',
              color: 'var(--gold)',
              cursor: syncStatus === 'syncing' ? 'wait' : 'pointer',
            }}
          >
            {syncStatus === 'syncing' ? '⟳ Syncing...' : '⟳ Sync Now'}
          </button>
          {syncStatus === 'ok' && <div style={{ fontSize: 8, color: 'var(--success)', marginTop: 4 }}>✓ Synced</div>}
          {syncStatus === 'error' && <div style={{ fontSize: 8, color: 'var(--danger)', marginTop: 4 }}>✗ Failed</div>}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--border-default)' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 9,
              borderRadius: 6,
              border: 'none',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            ← Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Menu Items Tab */}
        {activeTab === 'menu' && (
          <AdminMenu />
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <AdminStaff />
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <AdminInventory />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <h2 style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 20 }}>Settings</h2>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
              <AdminPrintSettings />
            </div>
          </div>
        )}

        {/* COGS Tab */}
        {activeTab === 'cogs' && (
          <div>
            <h2 style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 20 }}>Cost Analysis</h2>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Revenue', value: formatCurrency(summary.revenue), color: 'var(--gold)' },
                { label: 'Total COGS', value: formatCurrency(summary.cogs), color: 'var(--text-primary)' },
                { label: 'Gross Profit', value: formatCurrency(summary.profit), color: summary.profit >= 0 ? 'var(--success)' : 'var(--danger)' },
                { label: 'Orders', value: orders.length, color: 'var(--text-secondary)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                  <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Order Details */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                ORDER BREAKDOWN ({summary.details.length} orders)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Order</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Revenue</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>COGS</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.details.slice(0, 50).map(d => (
                    <tr key={d.order_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>#{d.order_id.slice(0, 8)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(d.total)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(d.cogs)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: d.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(d.profit)}
                      </td>
                    </tr>
                  ))}
                  {summary.details.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No data available. Sync to fetch orders.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div>
            <h2 style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 20 }}>Backup & Restore</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {/* Export */}
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 24, border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>📤 Export Backup</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Download all orders and inventory data to a JSON file. Save it safely for later import.
                </p>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Orders: {orders.length} | Inventory: {inventory.length} items
                </div>
                <button
                  onClick={exportData}
                  disabled={orders.length === 0 && inventory.length === 0}
                  style={{
                    padding: '10px 20px',
                    fontSize: 11,
                    borderRadius: 8,
                    border: '1px solid var(--gold)',
                    background: 'var(--gold)',
                    color: 'var(--bg-base)',
                    cursor: orders.length === 0 && inventory.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: orders.length === 0 && inventory.length === 0 ? 0.5 : 1,
                  }}
                >
                  Download Backup
                </button>
              </div>

              {/* Import */}
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 24, border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>📥 Import Backup</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Restore data from a previously downloaded backup file. This will replace current data.
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  id="backup-file"
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="backup-file"
                  style={{
                    display: 'inline-block',
                    padding: '10px 20px',
                    fontSize: 11,
                    borderRadius: 8,
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Select Backup File
                </label>
              </div>

              {/* Clear Local Data */}
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 24, border: '1px solid var(--danger)', gridColumn: 'span 2' }}>
                <h3 style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>⚠️ Clear Local Data</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Remove all locally stored backup data. This will NOT affect data on the server.
                </p>
                <button
                  onClick={clearLocalData}
                  style={{
                    padding: '10px 20px',
                    fontSize: 11,
                    borderRadius: 8,
                    border: '1px solid var(--danger)',
                    background: 'transparent',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                  }}
                >
                  Clear Local Data
                </button>
              </div>

              {/* Info */}
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 24, border: '1px solid var(--border-subtle)', gridColumn: 'span 2' }}>
                <h3 style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>ℹ️ About Local Backup</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  This admin panel stores data in your browser's localStorage. This means:
                </p>
                <ul style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 16 }}>
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