import React, { useState, useEffect } from "react";
import { Order, CartItem, DiscountType } from "../types";
import { buildDailySummary, formatCurrency, formatTime } from "../utils";
import { apiAdminGet, apiGet, resetCogs, resetInventoryCosts } from "../utils/api";
import { Receipt } from "./Receipt";

interface CogsData {
  cogs: number;
  orderCount: number;
  start: string;
  end: string;
  details: { order_id: string; total: number; cogs: number; profit: number }[];
}

interface Props {
  orders: Order[];
  staffName: string;
  onRepeatOrder?: (items: CartItem[]) => void;
}

export const Dashboard: React.FC<Props> = ({ orders, staffName, onRepeatOrder }) => {
  const [cogsData, setCogsData] = useState<CogsData | null>(null);
  const [reprintOrder, setReprintOrder] = useState<Order | null>(null);
  const [_syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [dateRange, setDateRange] = useState<'today' | 'this_week' | 'last_week' | 'this_month' | 'last_2_weeks' | 'custom'>('today');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [resetMsg, setResetMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [yesterdayOrders, setYesterdayOrders] = useState<Order[]>([]);
  const [hourlyData, setHourlyData] = useState<{ hour: number; revenue: number; count: number }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<{ name: string; stock: number; threshold: number }[]>([]);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const getDateRange = (): { start: string; end: string } => {
    const today = new Date();
    const d = (offset: number) => { const x = new Date(today); x.setDate(x.getDate() + offset); return x; };
    switch (dateRange) {
      case 'today': return { start: fmt(today), end: fmt(today) };
      case 'this_week': { const s = new Date(today); s.setDate(today.getDate() - today.getDay()); return { start: fmt(s), end: fmt(today) }; }
      case 'last_week': { const s = new Date(today); s.setDate(today.getDate() - today.getDay() - 7); const e = new Date(s); e.setDate(s.getDate() + 6); return { start: fmt(s), end: fmt(e) }; }
      case 'this_month': { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { start: fmt(s), end: fmt(today) }; }
      case 'last_2_weeks': return { start: fmt(d(-14)), end: fmt(today) };
      case 'custom': return { start: startDate, end: endDate };
      default: return { start: fmt(today), end: fmt(today) };
    }
  };

  const fetchCogs = () => {
    const { start, end } = getDateRange();
    apiAdminGet<CogsData>(`/orders/cogs?start=${start}&end=${end}`)
      .then(setCogsData)
      .catch((err) => console.error("Failed to fetch COGS data:", err));
  };

  const handleResetCOGSRange = async () => {
    if (!confirm(`Reset COGS data for ${startDate} to ${endDate}?`)) return;
    try {
      const result = await resetCogs(startDate, endDate);
      setResetMsg({ text: result.message, type: 'success' });
      fetchCogs();
    } catch (e: any) { setResetMsg({ text: e.message || 'Reset failed', type: 'error' }); }
    setTimeout(() => setResetMsg(null), 3000);
  };

  const handleResetCOGSAll = async () => {
    if (!confirm('Reset ALL COGS data?')) return;
    try {
      const result = await resetCogs(undefined, undefined, true);
      setResetMsg({ text: result.message, type: 'success' });
      fetchCogs();
    } catch (e: any) { setResetMsg({ text: e.message || 'Reset failed', type: 'error' }); }
    setTimeout(() => setResetMsg(null), 3000);
  };

  const handleResetInventoryCosts = async () => {
    if (!confirm('Reset ALL inventory costs to 0?')) return;
    try {
      const result = await resetInventoryCosts();
      setResetMsg({ text: result.message, type: 'success' });
    } catch (e: any) { setResetMsg({ text: e.message || 'Reset failed', type: 'error' }); }
    setTimeout(() => setResetMsg(null), 3000);
  };

  useEffect(() => { fetchCogs(); }, [dateRange, startDate, endDate]);

  useEffect(() => {
    if (dateRange !== 'custom') {
      const { start, end } = getDateRange();
      setStartDate(start);
      setEndDate(end);
    }
  }, [dateRange]);

  // Sync to Google Sheet3 when orders change (debounced)
  useEffect(() => {
    if (!orders.length) return;
    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const res = await fetch('/api/sheets/sync-dashboard', { method: 'POST' });
        setSyncStatus(res.ok ? 'ok' : 'error');
      } catch { setSyncStatus('error'); }
      setTimeout(() => setSyncStatus('idle'), 3000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [orders.length]);

  // Fetch yesterday's orders
  useEffect(() => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const y = fmt(yesterday);
    apiGet<Record<string, unknown>[]>('/orders?start=' + y + '&end=' + y)
      .then((data) => {
        const transformed = data.map((o) => ({
          id: String(o.id ?? ''),
          items: Array.isArray(o.items) ? o.items : [],
          staff: o.staff_name ? {
            id: Number(o.staff_id ?? 0), name: String(o.staff_name),
            initials: String(o.staff_initials || ''), rfid: String(o.staff_rfid || ''),
            role: String(o.staff_role || 'Barista') as Order['staff']['role'],
            color: String(o.staff_color || '#C9873A')
          } : { rfid: '', pin: '', name: 'Unknown', role: 'Barista' as const, initials: '??', color: '#666' },
          status: String(o.status ?? 'preparing') as Order['status'],
          subtotal: Number(o.subtotal ?? 0), tax: Number(o.tax ?? 0), total: Number(o.total ?? 0),
          createdAt: new Date(String(o.created_at)),
          completedAt: o.completed_at ? new Date(String(o.completed_at)) : undefined,
          customerName: o.customer_name ? String(o.customer_name) : undefined,
          type: (o.type ?? 'dine-in') as Order['type'],
          payMethod: String(o.payMethod || o.pay_method || 'cash') as Order['payMethod'],
          referenceNumber: o.referenceNumber ? String(o.referenceNumber) : (o.reference_number ? String(o.reference_number) : undefined),
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
        })) as Order[];
        setYesterdayOrders(transformed);
      }).catch(() => {});
  }, []);

  // Hourly revenue
  useEffect(() => {
    const now = new Date();
    const isToday = startDate === fmt(now) && endDate === fmt(now);
    if (!isToday) { setHourlyData([]); return; }
    const hours = Array.from({ length: 17 }, (_, i) => ({ hour: i + 6, revenue: 0, count: 0 }));
    orders.filter((o) => o.status === 'completed').forEach((o) => {
      const h = o.createdAt.getHours();
      const slot = hours.find((s) => s.hour === h);
      if (slot) { slot.revenue += Number(o.total); slot.count += 1; }
    });
    setHourlyData(hours);
  }, [orders, startDate, endDate]);

  // Low inventory
  useEffect(() => {
    apiGet<Record<string, unknown>[]>('/inventory')
      .then((data) => {
        const low = data.filter((item: any) => item.stock <= item.low_stock_threshold && item.low_stock_threshold > 0);
        setLowStockItems(low.map((item: any) => ({ name: item.name, stock: item.stock, threshold: item.low_stock_threshold })));
      }).catch(() => {});
  }, []);

  const summary = buildDailySummary(orders, cogsData ?? undefined);
  const yesterdaySummary = yesterdayOrders.length > 0 ? buildDailySummary(yesterdayOrders) : null;
  const recentOrders = [...orders].slice(0, 8);

  const revenueDelta = yesterdaySummary ? summary.totalRevenue - yesterdaySummary.totalRevenue : 0;
  const ordersDelta = yesterdaySummary ? summary.totalOrders - yesterdaySummary.totalOrders : 0;
  const avgDelta = yesterdaySummary && yesterdaySummary.avgOrderValue > 0 ? ((summary.avgOrderValue - yesterdaySummary.avgOrderValue) / yesterdaySummary.avgOrderValue) * 100 : 0;

  const marginColor = (summary.profitMargin ?? 0) >= 30 ? "text-erl-success" : (summary.profitMargin ?? 0) >= 15 ? "text-erl-accent" : "text-erl-danger";

  return (
    <div className="scroll-area flex-1 p-5 flex flex-col gap-3.5 overflow-y-auto min-h-0">
      {/* Page header */}
      <div className="flex items-baseline justify-between flex-wrap gap-1.5">
        <div>
          <div className="font-display text-lg font-bold text-erl-text-primary">Daily Dashboard</div>
          <div className="text-[9px] text-erl-text-muted mt-px">{summary.date}</div>
        </div>
        <div className="text-[9px] text-erl-text-muted">Viewing as <strong className="text-erl-accent">{staffName}</strong></div>
      </div>

      {/* Date Range Selector */}
      <div className="card-glass py-3 px-3.5 rounded-xl">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="text-[8px] text-erl-text-muted tracking-[1.5px] uppercase font-bold">Period</div>
          <div className="flex gap-1 flex-wrap">
            {([["Today","today"],["This Week","this_week"],["Last Week","last_week"],["This Month","this_month"],["Last 2 Weeks","last_2_weeks"],["Custom","custom"]] as const).map(([label, value]) => (
              <button key={value} onClick={() => setDateRange(value)}
                className={`py-1 px-2 text-[8px] rounded-md border transition-all duration-150 ${
                  dateRange === value ? "border-erl-accent bg-erl-accent/8 text-erl-accent font-bold shadow-[0_0_12px_rgba(196,149,106,0.08)]" : "border-erl-border-subtle bg-transparent text-erl-text-muted hover:border-erl-border-medium hover:text-erl-text-secondary"
                }`}
              >{label}</button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDateRange('custom'); }} className="py-[3px] px-1.5 text-[9px] rounded border border-erl-border-subtle bg-erl-base text-erl-text-primary" />
              <span className="text-erl-text-muted text-[9px]">to</span>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDateRange('custom'); }} className="py-[3px] px-1.5 text-[9px] rounded border border-erl-border-subtle bg-erl-base text-erl-text-primary" />
              <button onClick={fetchCogs} className="py-[3px] px-2 text-[8px] rounded border border-erl-accent bg-erl-accent text-erl-base cursor-pointer font-bold">Apply</button>
            </div>
          )}
        </div>
      </div>

      {/* Low Inventory Alert */}
      {lowStockItems.length > 0 && (
        <div className="card-glass py-2.5 px-3.5 rounded-xl border border-erl-danger">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-erl-danger text-[10px]">⚠</span>
            <span className="text-[9px] text-erl-text-primary font-bold tracking-wide uppercase">Low Inventory ({lowStockItems.length})</span>
            <span className="text-[8px] text-erl-text-muted">
              {lowStockItems.slice(0, 5).map((i) => `${i.name} (${i.stock}/${i.threshold})`).join(', ')}
              {lowStockItems.length > 5 ? ` +${lowStockItems.length - 5} more` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Reset Options */}
      <div className="card-glass py-3 px-3.5 rounded-xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[9px] text-erl-text-muted tracking-[1.5px] uppercase font-bold">Reset Data</div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleResetCOGSRange} className="btn-danger text-[9px] py-1.5 px-3 rounded-md">Reset COGS (Selected)</button>
            <button onClick={handleResetCOGSAll} className="btn-danger text-[9px] py-1.5 px-3 rounded-md">Reset COGS (All)</button>
            <button onClick={handleResetInventoryCosts} className="btn-danger text-[9px] py-1.5 px-3 rounded-md">Reset Inventory Costs</button>
          </div>
          {resetMsg && <div className={`text-[9px] font-semibold tracking-wide ${resetMsg.type === 'success' ? 'text-erl-success' : 'text-erl-danger'}`}>{resetMsg.text}</div>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: "Total Revenue", value: formatCurrency(summary.totalRevenue), sub: "Today", delta: revenueDelta, fmt: (d: number) => formatCurrency(Math.abs(d)) },
          { label: "Orders", value: String(summary.totalOrders), sub: "Completed", delta: ordersDelta, fmt: (d: number) => String(Math.abs(Math.round(d))) },
          { label: "Avg. Order", value: formatCurrency(summary.avgOrderValue), sub: "Per ticket", delta: avgDelta, fmt: (d: number) => `${Math.abs(d).toFixed(1)}%` },
          { label: "Active", value: String(orders.filter(o => o.status === "preparing" || o.status === "ready").length), sub: "In kitchen", delta: 0, fmt: () => '' },
        ].map(({ label, value, sub, delta, fmt }) => {
          const isPositive = delta >= 0;
          const showDelta = label !== "Active" && yesterdaySummary;
          return (
            <div key={label} className="stat-card py-4 px-3.5 rounded-[14px] relative">
              <div className="text-[9px] text-erl-text-muted tracking-[1.5px] uppercase font-bold mb-1.5">{label}</div>
              <div className="font-display text-2xl font-bold text-erl-accent mb-0.5">{value}</div>
              <div className="text-[9px] text-erl-text-disabled tracking-wide flex items-center gap-1">
                {sub}
                {showDelta && delta !== 0 && (
                  <span className={`text-[7px] font-bold py-px px-1 rounded ${isPositive ? 'text-erl-success bg-erl-success/10' : 'text-erl-danger bg-erl-danger/10'}`}>
                    {isPositive ? '↑' : '↓'} {fmt(delta)}
                  </span>
                )}
                {showDelta && delta === 0 && <span className="text-[7px] text-erl-text-disabled font-medium">— vs yesterday</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "COGS", value: formatCurrency(summary.totalCOGS ?? 0), sub: "Cost of Goods", color: "text-erl-text-secondary" },
          { label: "Profit", value: formatCurrency(summary.grossProfit ?? 0), sub: "Revenue − COGS", color: (summary.grossProfit ?? 0) >= 0 ? "text-erl-success" : "text-erl-danger" },
          { label: "Margin", value: `${(summary.profitMargin ?? 0).toFixed(1)}%`, sub: "Profit ÷ Revenue", color: marginColor },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="stat-card py-3 px-3 rounded-[10px]">
            <div className="text-[8px] text-erl-text-muted tracking-[1.5px] uppercase mb-1">{label}</div>
            <div className={`font-display text-xl font-bold ${color} mb-px`}>{value}</div>
            <div className="text-[8px] text-erl-text-disabled tracking-wide">{sub}</div>
          </div>
        ))}
      </div>

      {/* Hourly Sales Chart */}
      {hourlyData.length > 0 && (() => {
        const maxRev = Math.max(...hourlyData.map(h => h.revenue), 1);
        return (
          <div className="card-glass py-3 px-3.5 rounded-xl">
            <div className="text-[8px] text-erl-text-muted tracking-[1.5px] uppercase font-bold mb-2.5">Hourly Sales</div>
            <div className="flex items-end gap-[3px] h-[70px]">
              {hourlyData.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                  <div title={`${h.hour > 12 ? (h.hour - 12) + 'PM' : h.hour + 'AM'}: ${formatCurrency(h.revenue)} (${h.count} orders)`}
                    className="w-full max-w-6 rounded-t transition-[height] duration-300"
                    style={{ height: Math.max(2, (h.revenue / maxRev) * 60), background: h.revenue > 0 ? "rgb(196,149,106)" : "rgb(42,26,16)", opacity: h.revenue > 0 ? 1 : 0.3 }}
                  />
                  <span className="text-[6px] text-erl-text-disabled leading-none">{h.hour > 12 ? h.hour - 12 : h.hour}{h.hour >= 12 ? 'p' : 'a'}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-2.5">
        {/* Top Items */}
        <div className="stat-card py-3 px-3 rounded-[10px]">
          <div className="text-[8px] text-erl-text-muted tracking-[1.5px] uppercase mb-2.5">Top Items</div>
          {summary.topItems.length === 0 ? (
            <div className="text-[10px] text-erl-text-disabled text-center py-3">No data yet</div>
          ) : summary.topItems.map((item, i) => (
            <div key={item.name} className="flex items-center gap-1.5 mb-1.5">
              <div className="text-[8px] text-erl-accent-muted min-w-3">#{i + 1}</div>
              <div className="flex-1 text-[10px] text-erl-text-primary truncate">{item.name}</div>
              <div className="text-[10px] text-erl-accent font-semibold min-w-5 text-right tabular-nums">{item.qty}</div>
              <div className="w-[50px] h-[3px] bg-erl-border-subtle rounded-sm overflow-hidden">
                <div className="h-full bg-erl-accent rounded-sm" style={{ width: `${Math.round((item.qty / (summary.topItems[0]?.qty || 1)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* By Category */}
        <div className="stat-card py-3 px-3 rounded-[10px]">
          <div className="text-[8px] text-erl-text-muted tracking-[1.5px] uppercase mb-2.5">Revenue by Category</div>
          {summary.byCategory.length === 0 ? (
            <div className="text-[10px] text-erl-text-disabled text-center py-3">No data yet</div>
          ) : summary.byCategory.map((cat) => {
            const maxRev = Math.max(...summary.byCategory.map(c => c.revenue));
            return (
              <div key={cat.category} className="mb-2">
                <div className="flex justify-between mb-[3px]">
                  <span className="text-[9px] text-erl-text-secondary">{cat.category}</span>
                  <span className="text-[9px] text-erl-accent font-semibold tabular-nums">{formatCurrency(cat.revenue)}</span>
                </div>
                <div className="w-full h-[3px] bg-erl-border-subtle rounded-sm overflow-hidden">
                  <div className="h-full bg-erl-accent rounded-sm" style={{ width: `${Math.round((cat.revenue / maxRev) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Methods */}
      {summary.byPayMethod.length > 0 && (
        <div className="stat-card py-3 px-3 rounded-[10px]">
          <div className="text-[8px] text-erl-text-muted tracking-[1.5px] uppercase mb-2.5">Payment Methods</div>
          <div className="flex gap-2">
            {summary.byPayMethod.map((pm) => (
              <div key={pm.method} className="flex-1 bg-erl-base rounded-lg py-2.5 text-center">
                <div className="text-base mb-0.5">{pm.method === "cash" ? "💵" : pm.method === "card" ? "💳" : "📱"}</div>
                <div className="text-[8px] text-erl-text-muted tracking-wide uppercase mb-0.5">{pm.method}</div>
                <div className="text-[13px] text-erl-accent font-semibold tabular-nums">{formatCurrency(pm.total)}</div>
                <div className="text-[8px] text-erl-text-disabled">{pm.count} orders</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="stat-card py-3 px-3 rounded-[10px]">
        <div className="text-[8px] text-erl-text-muted tracking-[1.5px] uppercase mb-2">Recent Orders</div>
        {recentOrders.length === 0 ? (
          <div className="text-[10px] text-erl-text-disabled text-center py-3">No orders yet</div>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                {["Order", "Time", "Staff", "Type", "Items", "Total", "Ref", "Status", "", ""].map((h, i) => (
                  <th key={i} className="text-left text-[7px] text-erl-text-disabled tracking-[1.5px] uppercase pb-1.5 pr-1.5 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-t border-erl-border-subtle">
                  <td className="py-1 pr-1.5 text-erl-text-primary font-semibold text-[9px]">{o.id.slice(0, 8)}</td>
                  <td className="py-1 pr-1.5 text-erl-text-muted text-[9px]">{formatTime(o.createdAt)}</td>
                  <td className="py-1 pr-1.5 text-erl-text-muted text-[9px]">{o.staff?.name?.split(" ")[0] ?? '—'}</td>
                  <td className="py-1 pr-1.5 text-erl-text-muted text-[9px]">{o.type === "dine-in" ? (o.customerName || "Dine-in") : "Takeout"}</td>
                  <td className="py-1 pr-1.5 text-erl-text-muted text-[9px] tabular-nums">{o.items.reduce((s, ci) => s + (ci?.qty ?? 0), 0)}</td>
                  <td className="py-1 pr-1.5 text-erl-accent font-semibold tabular-nums text-[9px]">{formatCurrency(o.total)}</td>
                  <td className="py-1 pr-1.5 text-erl-text-muted text-[8px]">
                    {o.payMethod === 'ewallet' && o.referenceNumber ? <span className="text-erl-accent font-medium">{o.referenceNumber}</span> : '—'}
                  </td>
                  <td className="py-1 pr-0">
                    <span className={`pill text-[7px] py-0.5 px-1.5 ${o.status === "completed" ? "pill-success" : o.status === "ready" ? "pill-gold" : "pill-muted"}`}>{o.status}</span>
                  </td>
                  <td className="py-1 pr-0">
                    <button onClick={() => setReprintOrder(o)} className="bg-transparent border border-erl-border-default rounded text-erl-text-muted text-[7px] py-0.5 px-1.5 cursor-pointer tracking-wide uppercase">🖨</button>
                  </td>
                  <td className="py-1 pr-0">
                    {onRepeatOrder && (
                      <button onClick={() => onRepeatOrder(o.items)} className="bg-transparent border border-erl-border-default rounded text-erl-accent text-[7px] py-0.5 px-1.5 cursor-pointer tracking-wide uppercase" title="Repeat order">🔁</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reprint receipt modal */}
      {reprintOrder && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[9998]" onClick={() => setReprintOrder(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-[400px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div className="text-xs font-bold text-erl-text-primary font-display">Reprint Receipt</div>
                <button onClick={() => setReprintOrder(null)} className="bg-transparent border-none text-erl-text-muted text-base cursor-pointer">✕</button>
              </div>
              <Receipt order={reprintOrder} onPrint={() => setReprintOrder(null)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
