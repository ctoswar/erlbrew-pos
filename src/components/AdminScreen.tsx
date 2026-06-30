import React, { useState, useEffect, useCallback } from "react";
import { Order } from "../types";
import { AdminMenu } from "./AdminMenu";
import { AdminInventory } from "./AdminInventory";
import { AdminStaff } from "./AdminStaff";
import { AdminPrintSettings } from "./AdminPrintSettings";
import { ZReportScreen } from "./ZReportScreen";
import { CashDrawerScreen } from "./CashDrawerScreen";
import { apiGet } from "../utils/api";
import { formatTime, formatCurrency } from "../utils";

type AdminTab = "menu" | "inventory" | "staff" | "reports" | "cash" | "print" | "orders";

const TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: "menu", label: "Menu Items", icon: "🍽️" },
  { key: "inventory", label: "Inventory", icon: "📦" },
  { key: "staff", label: "Staff", icon: "👥" },
  { key: "print", label: "Print Settings", icon: "🖨️" },
  { key: "reports", label: "Z-Report", icon: "📊" },
  { key: "cash", label: "Cash Drawer", icon: "💰" },
  { key: "orders", label: "Orders", icon: "📋" },
];

interface Props {
  onDismissOrder?: (id: string) => void;
}

export const AdminScreen: React.FC<Props> = ({ onDismissOrder }) => {
  const [tab, setTab] = useState<AdminTab>("menu");
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/orders');
      if (Array.isArray(data)) {
        setAllOrders(data.map(o => ({
          id: o.id,
          items: (o.items || []).map((it: any) => ({
            item: { id: it.menu_item_id || '', name: it.menu_item_name || it.name || 'Unknown', category: '', price: Number(it.price) || 0, badge: '', description: '', emoji: '' },
            qty: it.qty || 1, notes: it.notes || '',
            modifiers: (it.modifiers || []).map((m: any) => ({ name: m.name || '', price: Number(m.price) || 0 })),
          })),
          staff: { rfid: o.staff_rfid || '', pin: '', name: o.staff_name || 'Unknown', role: o.staff_role || 'Barista', initials: o.staff_initials || '??', color: o.staff_color || '#666' },
          status: o.status,
          subtotal: Number(o.subtotal) || 0,
          tax: Number(o.tax) || 0,
          total: Number(o.total) || 0,
          createdAt: o.created_at ? new Date(o.created_at) : new Date(),
          completedAt: o.completed_at ? new Date(o.completed_at) : undefined,
          customerName: o.customer_name || undefined,
          type: o.type || 'dine-in',
          payMethod: o.pay_method || 'cash',
        })));
      }
    } catch (e) {
      console.error('Failed to fetch orders for admin:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'orders') fetchOrders();
  }, [tab, fetchOrders]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Sub-tab bar */}
      <div className="glass-panel flex gap-1.5 px-4 py-3 border-b border-erl-accent/10 flex-shrink-0 relative rounded-none overflow-x-auto scrollbar-none">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`
              relative px-4 py-[7px] rounded-lg text-[9px] font-bold tracking-wider uppercase cursor-pointer transition-all duration-150 ease-out flex-shrink-0 whitespace-nowrap
              ${
                tab === key
                  ? "bg-erl-accent/10 border-[1.5px] border-erl-accent text-erl-accent"
                  : "bg-transparent border-[1.5px] border-erl-border-default text-erl-secondary"
              }
            `}
          >
            <span className="mr-1">{icon}</span>
            {label}
            {tab === key && (
              <div className="absolute -bottom-px left-[15%] right-[15%] h-0.5 bg-erl-accent rounded-sm" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {tab === "menu" && <AdminMenu />}
        {tab === "inventory" && <AdminInventory />}
        {tab === "staff" && <AdminStaff />}
        {tab === "reports" && <ZReportScreen />}
        {tab === "cash" && <CashDrawerScreen />}
        {tab === "print" && <AdminPrintSettings />}
        {tab === "orders" && (
          <div className="h-full flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-erl-text-primary uppercase tracking-wider">
                All Orders ({allOrders.length})
              </h3>
              <div className="flex gap-2">
                <button onClick={fetchOrders} className="btn text-[9px] py-1.5 px-2.5 rounded-lg border border-erl-border-default text-erl-text-secondary bg-transparent cursor-pointer">
                  ↻ Refresh
                </button>
                {onDismissOrder && allOrders.filter(o => o.status === 'completed').length > 0 && (
                  <button
                    onClick={() => allOrders.filter(o => o.status === 'completed').forEach(o => onDismissOrder(o.id))}
                    className="btn text-[9px] py-1.5 px-2.5 rounded-lg border border-erl-danger/40 text-erl-danger bg-transparent cursor-pointer hover:bg-erl-danger/10"
                  >
                    Clear Completed from Kitchen
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-erl-text-disabled text-[11px]">Loading...</div>
            ) : allOrders.length === 0 ? (
              <div className="text-center py-8 text-erl-text-disabled text-[11px]">No orders found</div>
            ) : (
              <div className="space-y-1">
                {allOrders.slice().reverse().map(order => (
                  <div key={order.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-erl-surface transition-colors">
                    <span className={`text-[9px] font-bold w-[10px] ${order.status === 'completed' ? 'text-green-500' : order.status === 'preparing' ? 'text-yellow-500' : order.status === 'voided' ? 'text-red-500' : 'text-erl-text-disabled'}`}>
                      {order.status === 'completed' ? '✓' : order.status === 'preparing' ? '⋯' : order.status === 'voided' ? '✕' : '○'}
                    </span>
                    <span className="text-[9px] font-mono text-erl-text-muted w-[60px] truncate">{order.id.slice(0, 8)}</span>
                    <span className="text-[9px] text-erl-text-secondary w-[60px]">{order.customerName || '—'}</span>
                    <span className="text-[9px] text-erl-text-primary font-semibold w-[50px] text-right">{formatCurrency(order.total)}</span>
                    <span className="text-[8px] text-erl-text-disabled w-[70px]">{order.createdAt instanceof Date ? formatTime(order.createdAt) : ''}</span>
                    <span className="text-[8px] text-erl-text-disabled w-[40px]">{order.status}</span>
                    {onDismissOrder && (
                      <button
                        onClick={() => onDismissOrder(order.id)}
                        className="ml-auto text-[9px] text-erl-text-disabled hover:text-erl-danger transition-colors bg-transparent border-none cursor-pointer py-0.5 px-1 rounded"
                        title="Remove from kitchen board"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
