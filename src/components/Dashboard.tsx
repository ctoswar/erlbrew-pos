import React, { useState, useEffect } from "react";
import { Order } from "../types";
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
}

export const Dashboard: React.FC<Props> = ({ orders, staffName }) => {
  const [cogsData, setCogsData] = useState<CogsData | null>(null);
  const [reprintOrder, setReprintOrder] = useState<Order | null>(null);
  const [_syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [dateRange, setDateRange] = useState<'today' | 'this_week' | 'last_week' | 'this_month' | 'last_2_weeks' | 'custom'>('today');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [resetMsg, setResetMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [yesterdayOrders, setYesterdayOrders] = useState<Order[]>([]);
  const [hourlyData, setHourlyData] = useState<{ hour: number; revenue: number; count: number }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<{ name: string; stock: number; threshold: number }[]>([]);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const getDateRange = (): { start: string; end: string } => {
    const today = new Date();
    const d = (offset: number) => {
      const x = new Date(today);
      x.setDate(x.getDate() + offset);
      return x;
    };

    switch (dateRange) {
      case 'today':
        return { start: fmt(today), end: fmt(today) };
      case 'this_week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return { start: fmt(startOfWeek), end: fmt(today) };
      }
      case 'last_week': {
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        return { start: fmt(startOfLastWeek), end: fmt(endOfLastWeek) };
      }
      case 'this_month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: fmt(startOfMonth), end: fmt(today) };
      }
      case 'last_2_weeks': {
        const twoWeeksAgo = d(-14);
        return { start: fmt(twoWeeksAgo), end: fmt(today) };
      }
      case 'custom':
        return { start: startDate, end: endDate };
      default:
        return { start: fmt(today), end: fmt(today) };
    }
  };

  const fetchCogs = () => {
    const { start, end } = getDateRange();
    apiAdminGet<CogsData>(`/orders/cogs?start=${start}&end=${end}`)
      .then(setCogsData)
      .catch((err) => console.error("Failed to fetch COGS data:", err));
  };

  const handleResetCOGSRange = async () => {
    if (!confirm(`Reset COGS data for ${startDate} to ${endDate}? This will set totals = subtotals (effectively 0 COGS) for orders in this range.`)) return;
    try {
      const result = await resetCogs(startDate, endDate);
      setResetMsg({ text: result.message, type: 'success' });
      fetchCogs();
    } catch (e: any) {
      setResetMsg({ text: e.message || 'Reset failed', type: 'error' });
    }
    setTimeout(() => setResetMsg(null), 3000);
  };

  const handleResetCOGSAll = async () => {
    if (!confirm('Reset ALL COGS data? This will set totals = subtotals for ALL orders. This cannot be undone.')) return;
    try {
      const result = await resetCogs(undefined, undefined, true);
      setResetMsg({ text: result.message, type: 'success' });
      fetchCogs();
    } catch (e: any) {
      setResetMsg({ text: e.message || 'Reset failed', type: 'error' });
    }
    setTimeout(() => setResetMsg(null), 3000);
  };

  const handleResetInventoryCosts = async () => {
    if (!confirm('Reset ALL inventory costs to 0? This will set all purchase_cost and unit_cost to 0. This cannot be undone.')) return;
    try {
      const result = await resetInventoryCosts();
      setResetMsg({ text: result.message, type: 'success' });
    } catch (e: any) {
      setResetMsg({ text: e.message || 'Reset failed', type: 'error' });
    }
    setTimeout(() => setResetMsg(null), 3000);
  };

  useEffect(() => {
    fetchCogs();
  }, [dateRange, startDate, endDate]);

  // Also re-fetch when switching presets
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
      } catch {
        setSyncStatus('error');
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [orders.length]);

  // Fetch yesterday's orders for day-over-day comparison
  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = fmt(yesterday);
    apiGet<any[]>('/orders?start=' + y + '&end=' + y)
      .then((data) => {
        const transformed = data.map((o: any) => ({
          ...o,
          payMethod: o.payMethod || o.pay_method || 'cash',
          createdAt: new Date(o.created_at),
          completedAt: o.completed_at ? new Date(o.completed_at) : undefined,
        })) as Order[];
        setYesterdayOrders(transformed);
      })
      .catch(() => {});
  }, []);

  // Build hourly revenue data from today's completed orders
  useEffect(() => {
    const now = new Date();
    const isToday = startDate === fmt(now) && endDate === fmt(now);
    if (!isToday) {
      setHourlyData([]);
      return;
    }
    const hours: { hour: number; revenue: number; count: number }[] = [];
    for (let h = 6; h <= 22; h++) {
      hours.push({ hour: h, revenue: 0, count: 0 });
    }
    orders
      .filter((o) => o.status === 'completed')
      .forEach((o) => {
        const h = o.createdAt.getHours();
        const slot = hours.find((s) => s.hour === h);
        if (slot) {
          slot.revenue += Number(o.total);
          slot.count += 1;
        }
      });
    setHourlyData(hours);
  }, [orders, startDate, endDate]);

  // Fetch low inventory items
  useEffect(() => {
    apiGet<any[]>('/inventory')
      .then((data) => {
        const low = data.filter(
          (item: any) =>
            item.stock <= item.low_stock_threshold &&
            item.low_stock_threshold > 0
        );
        setLowStockItems(
          low.map((item: any) => ({
            name: item.name,
            stock: item.stock,
            threshold: item.low_stock_threshold,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const summary = buildDailySummary(orders, cogsData ?? undefined);
  const yesterdaySummary = yesterdayOrders.length > 0
    ? buildDailySummary(yesterdayOrders)
    : null;
  const recentOrders = [...orders].slice(0, 8);

  const revenueDelta = yesterdaySummary
    ? summary.totalRevenue - yesterdaySummary.totalRevenue
    : 0;
  const ordersDelta = yesterdaySummary
    ? summary.totalOrders - yesterdaySummary.totalOrders
    : 0;
  const avgDelta = yesterdaySummary && yesterdaySummary.avgOrderValue > 0
    ? ((summary.avgOrderValue - yesterdaySummary.avgOrderValue) / yesterdaySummary.avgOrderValue) * 100
    : 0;

  const marginColor = (summary.profitMargin ?? 0) >= 30
    ? "var(--success)"
    : (summary.profitMargin ?? 0) >= 15
    ? "var(--gold)"
    : "var(--danger)";

return (
    <div className="scroll-area" style={{ flex: 1, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", minHeight: 0 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Daily Dashboard</div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>{summary.date}</div>
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Viewing as <strong style={{ color: "var(--gold)" }}>{staffName}</strong></div>
      </div>

      {/* Date Range Selector */}
      <div className="card-glass" style={{ padding: "12px 14px", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Period</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {([["Today","today"],["This Week","this_week"],["Last Week","last_week"],["This Month","this_month"],["Last 2 Weeks","last_2_weeks"],["Custom","custom"]] as const).map(([label, value]) => (
              <button key={value} onClick={() => setDateRange(value)}
                style={{
                  padding: "4px 8px", fontSize: 8, borderRadius: 6, border: "1px solid",
                  borderColor: dateRange === value ? "var(--gold)" : "var(--border-subtle)",
                  background: dateRange === value ? "rgba(201,135,58,0.15)" : "transparent",
                  color: dateRange === value ? "var(--gold)" : "var(--text-muted)",
                  cursor: "pointer", fontWeight: dateRange === value ? 700 : 400, letterSpacing: 0.5,
                }}
              >{label}</button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDateRange('custom'); }}
                style={{ padding: "3px 6px", fontSize: 9, borderRadius: 5, border: "1px solid var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-primary)" }} />
              <span style={{ color: "var(--text-muted)", fontSize: 9 }}>to</span>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDateRange('custom'); }}
                style={{ padding: "3px 6px", fontSize: 9, borderRadius: 5, border: "1px solid var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-primary)" }} />
              <button onClick={fetchCogs} style={{ padding: "3px 8px", fontSize: 8, borderRadius: 5, border: "1px solid var(--gold)", background: "var(--gold)", color: "var(--bg-base)", cursor: "pointer", fontWeight: 700 }}>Apply</button>
            </div>
          )}
        </div>
      </div>

      {/* Low Inventory Alert */}
      {lowStockItems.length > 0 && (
        <div className="card-glass" style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--danger)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: "var(--danger)", fontSize: 10 }}>⚠</span>
            <span style={{ fontSize: 9, color: "var(--text-primary)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Low Inventory ({lowStockItems.length})
            </span>
            <span style={{ fontSize: 8, color: "var(--text-muted)" }}>
              {lowStockItems.slice(0, 5).map((i) => `${i.name} (${i.stock}/${i.threshold})`).join(', ')}
              {lowStockItems.length > 5 ? ` +${lowStockItems.length - 5} more` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Reset Options */}
      <div className="card-glass" style={{ padding: "12px 14px", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Reset Data</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleResetCOGSRange}
              style={{
                padding: "6px 12px",
                fontSize: 9,
                borderRadius: 6,
                border: "1px solid var(--danger)",
                background: "transparent",
                color: "var(--danger)",
                cursor: "pointer",
                fontWeight: 500,
              }}
              title={`Reset COGS for ${startDate} to ${endDate}`}
            >
              Reset COGS (Selected Dates)
            </button>
            <button
              onClick={handleResetCOGSAll}
              style={{
                padding: "6px 12px",
                fontSize: 9,
                borderRadius: 6,
                border: "1px solid var(--danger)",
                background: "transparent",
                color: "var(--danger)",
                cursor: "pointer",
                fontWeight: 500,
              }}
              title="Reset ALL COGS data"
            >
              Reset COGS (All Time)
            </button>
            <button
              onClick={handleResetInventoryCosts}
              style={{
                padding: "6px 12px",
                fontSize: 9,
                borderRadius: 6,
                border: "1px solid var(--danger)",
                background: "transparent",
                color: "var(--danger)",
                cursor: "pointer",
                fontWeight: 500,
              }}
              title="Reset all inventory costs to 0"
            >
              Reset Inventory Costs
            </button>
          </div>
          {resetMsg && (
            <div style={{
              fontSize: 9,
              color: resetMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
              fontWeight: 600,
              letterSpacing: 0.5,
            }}>
              {resetMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards with Day-over-Day deltas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Total Revenue", value: formatCurrency(summary.totalRevenue), sub: "Today", delta: revenueDelta, fmt: (d: number) => formatCurrency(Math.abs(d)) },
          { label: "Orders", value: String(summary.totalOrders), sub: "Completed", delta: ordersDelta, fmt: (d: number) => String(Math.abs(Math.round(d))) },
          { label: "Avg. Order", value: formatCurrency(summary.avgOrderValue), sub: "Per ticket", delta: avgDelta, fmt: (d: number) => `${Math.abs(d).toFixed(1)}%` },
          { label: "Active", value: String(orders.filter(o => o.status === "preparing" || o.status === "ready").length), sub: "In kitchen", delta: 0, fmt: () => '' },
        ].map(({ label, value, sub, delta, fmt }) => {
          const isPositive = delta >= 0;
          const showDelta = label !== "Active" && yesterdaySummary;
          return (
            <div key={label} className="stat-card" style={{ padding: "16px 14px", borderRadius: 14, position: "relative" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>{label}</div>
              <div className="font-display" style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}>
                {sub}
                {showDelta && delta !== 0 && (
                  <span style={{
                    fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                    color: isPositive ? "var(--success)" : "var(--danger)",
                    background: isPositive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  }}>
                    {isPositive ? '↑' : '↓'} {fmt(delta)}
                  </span>
                )}
                {showDelta && delta === 0 && (
                  <span style={{ fontSize: 7, color: "var(--text-disabled)", fontWeight: 500 }}>— vs yesterday</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          { label: "COGS", value: formatCurrency(summary.totalCOGS ?? 0), sub: "Cost of Goods", color: "var(--text-secondary)" },
          { label: "Profit", value: formatCurrency(summary.grossProfit ?? 0), sub: "Revenue − COGS", color: (summary.grossProfit ?? 0) >= 0 ? "var(--success)" : "var(--danger)" },
          { label: "Margin", value: `${(summary.profitMargin ?? 0).toFixed(1)}%`, sub: "Profit ÷ Revenue", color: marginColor },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="stat-card" style={{ padding: "12px 12px", borderRadius: 10 }}>
            <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
            <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 1 }}>{value}</div>
            <div style={{ fontSize: 8, color: "var(--text-disabled)", letterSpacing: 1 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Hourly Sales Chart */}
      {hourlyData.length > 0 && (() => {
        const maxRev = Math.max(...hourlyData.map(h => h.revenue), 1);
        return (
          <div className="card-glass" style={{ padding: "12px 14px", borderRadius: 12 }}>
            <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>Hourly Sales</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
              {hourlyData.map((h) => (
                <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div
                    title={`${h.hour > 12 ? (h.hour - 12) + 'PM' : h.hour + 'AM'}: ${formatCurrency(h.revenue)} (${h.count} orders)`}
                    style={{
                      width: "100%", maxWidth: 24, borderRadius: "3px 3px 0 0",
                      height: Math.max(2, (h.revenue / maxRev) * 60),
                      background: h.revenue > 0 ? "var(--gold)" : "var(--border-subtle)",
                      opacity: h.revenue > 0 ? 1 : 0.3,
                      transition: "height 0.3s",
                    }}
                  />
                  <span style={{ fontSize: 6, color: "var(--text-disabled)", lineHeight: 1 }}>{h.hour > 12 ? h.hour - 12 : h.hour}{h.hour >= 12 ? 'p' : 'a'}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* Top Items */}
        <div className="stat-card" style={{ padding: "12px", borderRadius: 10 }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Top Items</div>
          {summary.topItems.length === 0 ? (
            <div style={{ fontSize: 10, color: "var(--text-disabled)", textAlign: "center", padding: "0.8rem 0" }}>No data yet</div>
          ) : summary.topItems.map((item, i) => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ fontSize: 8, color: "var(--gold-muted)", minWidth: 12 }}>#{i + 1}</div>
              <div style={{ flex: 1, fontSize: 10, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
              <div style={{ fontSize: 10, color: "var(--gold)", fontWeight: 600, minWidth: 20, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.qty}</div>
              <div style={{ width: 50, height: 3, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((item.qty / (summary.topItems[0]?.qty || 1)) * 100)}%`, height: "100%", background: "var(--gold)", borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* By Category */}
        <div className="stat-card" style={{ padding: "12px", borderRadius: 10 }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Revenue by Category</div>
          {summary.byCategory.length === 0 ? (
            <div style={{ fontSize: 10, color: "var(--text-disabled)", textAlign: "center", padding: "0.8rem 0" }}>No data yet</div>
          ) : summary.byCategory.map((cat) => {
            const maxRev = Math.max(...summary.byCategory.map(c => c.revenue));
            return (
              <div key={cat.category} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>{cat.category}</span>
                  <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(cat.revenue)}</span>
                </div>
                <div style={{ width: "100%", height: 3, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((cat.revenue / maxRev) * 100)}%`, height: "100%", background: "var(--gold)", borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Methods */}
      {summary.byPayMethod.length > 0 && (
        <div className="stat-card" style={{ padding: "12px", borderRadius: 10 }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Payment Methods</div>
          <div style={{ display: "flex", gap: 8 }}>
            {summary.byPayMethod.map((pm) => (
              <div key={pm.method} style={{ flex: 1, background: "var(--bg-base)", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 16, marginBottom: 2 }}>{pm.method === "cash" ? "💵" : pm.method === "card" ? "💳" : "📱"}</div>
                <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{pm.method}</div>
                <div style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(pm.total)}</div>
                <div style={{ fontSize: 8, color: "var(--text-disabled)" }}>{pm.count} orders</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Analysis */}
      {summary.cogsDetails && summary.cogsDetails.length > 0 && (
        <div className="stat-card" style={{ padding: "12px", borderRadius: 10 }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Cost Analysis</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr>
                {["Order", "Revenue", "COGS", "Profit", "Margin"].map(h => (
                  <th key={h} style={{ textAlign: "right", fontSize: 7, color: "var(--text-disabled)", letterSpacing: 1.5, textTransform: "uppercase", padding: "0 0 6px 8px", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.cogsDetails.map((d) => {
                const m = d.total > 0 ? (d.profit / d.total) * 100 : 0;
                const mColor = m >= 30 ? "var(--success)" : m >= 15 ? "var(--gold)" : "var(--danger)";
                return (
                  <tr key={d.order_id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "5px 0 5px 8px", color: "var(--text-primary)", fontWeight: 600 }}>{d.order_id}</td>
                    <td style={{ padding: "5px 0 5px 8px", color: "var(--gold)", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(d.total)}</td>
                    <td style={{ padding: "5px 0 5px 8px", color: "var(--text-secondary)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(d.cogs)}</td>
                    <td style={{ padding: "5px 0 5px 8px", color: d.profit >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(d.profit)}</td>
                    <td style={{ padding: "5px 0 5px 8px", textAlign: "right" }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: mColor, background: "rgba(0,0,0,0.2)", padding: "1px 5px", borderRadius: 3 }}>{m.toFixed(1)}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Orders */}
      <div className="stat-card" style={{ padding: "12px", borderRadius: 10 }}>
        <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Recent Orders</div>
        {recentOrders.length === 0 ? (
          <div style={{ fontSize: 10, color: "var(--text-disabled)", textAlign: "center", padding: "0.8rem 0" }}>No orders yet</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr>
                {["Order", "Time", "Staff", "Type", "Items", "Total", "Ref", "Status", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: 7, color: "var(--text-disabled)", letterSpacing: 1.5, textTransform: "uppercase", padding: "0 6px 6px 0", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "5px 6px 5px 0", color: "var(--text-primary)", fontWeight: 600, fontSize: 9 }}>{o.id.slice(0, 8)}</td>
                  <td style={{ padding: "5px 6px 5px 0", color: "var(--text-muted)", fontSize: 9 }}>{formatTime(o.createdAt)}</td>
                  <td style={{ padding: "5px 6px 5px 0", color: "var(--text-muted)", fontSize: 9 }}>{o.staff?.name?.split(" ")[0] ?? '—'}</td>
                  <td style={{ padding: "5px 6px 5px 0", color: "var(--text-muted)", fontSize: 9 }}>{o.type === "dine-in" ? (o.customerName || "Dine-in") : "Takeout"}</td>
                  <td style={{ padding: "5px 6px 5px 0", color: "var(--text-muted)", fontSize: 9, fontVariantNumeric: "tabular-nums" }}>{o.items.reduce((s, ci) => s + (ci?.qty ?? 0), 0)}</td>
                  <td style={{ padding: "5px 6px 5px 0", color: "var(--gold)", fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: 9 }}>{formatCurrency(o.total)}</td>
                  <td style={{ padding: "5px 6px 5px 0", color: "var(--text-muted)", fontSize: 8 }}>
                    {o.payMethod === 'ewallet' && o.referenceNumber ? (
                      <span style={{ color: "var(--gold)", fontWeight: 500 }}>{o.referenceNumber}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: "5px 0 5px 0" }}>
                    <span className={`pill ${o.status === "completed" ? "pill-success" : o.status === "ready" ? "pill-gold" : "pill-muted"}`} style={{ fontSize: 7, padding: "2px 6px" }}>
                      {o.status}
                    </span>
                  </td>
                  <td style={{ padding: "5px 0 5px 0" }}>
                    <button onClick={() => setReprintOrder(o)} style={{
                      background: "none", border: "1px solid var(--border-default)", borderRadius: 5,
                      color: "var(--text-muted)", fontSize: 7, padding: "2px 6px", cursor: "pointer",
                      letterSpacing: 0.5, textTransform: "uppercase",
                    }}>🖨</button>
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
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9998 }} onClick={() => setReprintOrder(null)} />
          <div style={{
            position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem",
          }}>
            <div style={{
              background: "var(--bg-elevated)", border: "1.5px solid var(--border-medium)", borderRadius: 16, padding: "1.5rem",
              width: 400, maxHeight: "90vh", overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Playfair Display', serif" }}>
                  Reprint Receipt
                </div>
                <button onClick={() => setReprintOrder(null)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}>
                  ✕
                </button>
              </div>
              <Receipt order={reprintOrder} onPrint={() => setReprintOrder(null)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
