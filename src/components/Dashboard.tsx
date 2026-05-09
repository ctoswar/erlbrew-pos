import React, { useState, useEffect } from "react";
import { Order } from "../types";
import { buildDailySummary, formatCurrency, formatTime } from "../utils";
import { apiAdminGet, resetCogs, resetInventoryCosts } from "../utils/api";
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
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
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
      // Reset label after 3s
      setTimeout(() => setSyncStatus('idle'), 3000);
    }, 2000); // 2s debounce to avoid hammering on rapid changes
    return () => clearTimeout(timer);
  }, [orders.length]);

  const summary = buildDailySummary(orders, cogsData ?? undefined);
  const recentOrders = [...orders].slice(0, 8);

  const marginColor = (summary.profitMargin ?? 0) >= 30
    ? "var(--success)"
    : (summary.profitMargin ?? 0) >= 15
    ? "var(--gold)"
    : "var(--danger)";

  return (
    <div className="scroll-area" style={{ flex: 1, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", minHeight: 0 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div className="font-display" style={{ fontSize: 18, color: "var(--text-primary)" }}>Daily Dashboard</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{summary.date}</div>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Viewing as <strong style={{ color: "var(--gold)" }}>{staffName}</strong></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {syncStatus === 'syncing' && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1 }}>⟳ Syncing Sheet3…</span>
          )}
          {syncStatus === 'ok' && (
            <span style={{ fontSize: 9, color: 'var(--success)', letterSpacing: 1 }}>✓ Sheet3 synced</span>
          )}
          {syncStatus === 'error' && (
            <span style={{ fontSize: 9, color: 'var(--danger)', letterSpacing: 1 }}>✗ Sheet3 failed</span>
          )}
          {syncStatus === 'idle' && (
            <span
              style={{ fontSize: 9, color: 'var(--text-disabled)', letterSpacing: 1, cursor: 'pointer' }}
              onClick={async () => {
                setSyncStatus('syncing');
                try {
                  const r = await fetch('/api/sheets/sync-dashboard', { method: 'POST' });
                  setSyncStatus(r.ok ? 'ok' : 'error');
                } catch { setSyncStatus('error'); }
                setTimeout(() => setSyncStatus('idle'), 3000);
              }}
            >⇌ Sync Sheet3</span>
          )}
        </div>
      </div>

      {/* Date Range Selector */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Analysis Period</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([
              ["Today", "today"],
              ["This Week", "this_week"],
              ["Last Week", "last_week"],
              ["This Month", "this_month"],
              ["Last 2 Weeks", "last_2_weeks"],
              ["Custom", "custom"],
            ] as const).map(([label, value]) => (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                style={{
                  padding: "5px 10px",
                  fontSize: 9,
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: dateRange === value ? "var(--gold)" : "var(--border-subtle)",
                  background: dateRange === value ? "rgba(201,135,58,0.15)" : "transparent",
                  color: dateRange === value ? "var(--gold)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontWeight: dateRange === value ? 700 : 400,
                  letterSpacing: 0.5,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDateRange('custom'); }}
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                }}
              />
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDateRange('custom'); }}
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={fetchCogs}
                style={{
                  padding: "4px 10px",
                  fontSize: 9,
                  borderRadius: 6,
                  border: "1px solid var(--gold)",
                  background: "var(--gold)",
                  color: "var(--bg-base)",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reset Options */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>Reset Data</div>
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

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Total Revenue",   value: formatCurrency(summary.totalRevenue), sub: "Today" },
          { label: "Orders",          value: String(summary.totalOrders),          sub: "Completed" },
          { label: "Avg. Order",      value: formatCurrency(summary.avgOrderValue), sub: "Per ticket" },
          { label: "Active",          value: String(orders.filter(o => o.status === "preparing" || o.status === "ready").length), sub: "In kitchen" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 12px" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", marginBottom: 2 }}>{value}</div>
            <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: 1 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "COGS",    value: formatCurrency(summary.totalCOGS ?? 0),  sub: "Cost of Goods Sold", color: "var(--text-secondary)" },
          { label: "Profit",  value: formatCurrency(summary.grossProfit ?? 0), sub: "Revenue − COGS",     color: (summary.grossProfit ?? 0) >= 0 ? "var(--success)" : "var(--danger)" },
          { label: "Margin",  value: `${(summary.profitMargin ?? 0).toFixed(1)}%`, sub: "Profit ÷ Revenue", color: marginColor },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 12px" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 2 }}>{value}</div>
            <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: 1 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Top Items */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Top Items</div>
          {summary.topItems.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-disabled)", textAlign: "center", padding: "1rem 0" }}>No data yet</div>
          ) : summary.topItems.map((item, i) => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: "var(--gold-muted)", minWidth: 14 }}>#{i + 1}</div>
              <div style={{ flex: 1, fontSize: 11, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
              <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, minWidth: 24, textAlign: "right" }}>{item.qty}</div>
              {/* Bar */}
              <div style={{ width: 60, height: 4, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((item.qty / (summary.topItems[0]?.qty || 1)) * 100)}%`, height: "100%", background: "var(--gold)", borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* By Category */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Revenue by Category</div>
          {summary.byCategory.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-disabled)", textAlign: "center", padding: "1rem 0" }}>No data yet</div>
          ) : summary.byCategory.map((cat) => {
            const maxRev = Math.max(...summary.byCategory.map(c => c.revenue));
            return (
              <div key={cat.category} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{cat.category}</span>
                  <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 700 }}>{formatCurrency(cat.revenue)}</span>
                </div>
                <div style={{ width: "100%", height: 4, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((cat.revenue / maxRev) * 100)}%`, height: "100%", background: "var(--gold)", borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Methods */}
      {summary.byPayMethod.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Payment Methods</div>
          <div style={{ display: "flex", gap: 12 }}>
            {summary.byPayMethod.map((pm) => (
              <div key={pm.method} style={{ flex: 1, background: "var(--bg-base)", borderRadius: 8, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{pm.method === "cash" ? "💵" : pm.method === "card" ? "💳" : "📱"}</div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{pm.method}</div>
                <div style={{ fontSize: 14, color: "var(--gold)", fontWeight: 700 }}>{formatCurrency(pm.total)}</div>
                <div style={{ fontSize: 9, color: "var(--text-disabled)" }}>{pm.count} orders</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Analysis */}
      {summary.cogsDetails && summary.cogsDetails.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Cost Analysis</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["Order", "Revenue", "COGS", "Profit", "Margin"].map(h => (
                  <th key={h} style={{ textAlign: "right", fontSize: 8, color: "var(--text-disabled)", letterSpacing: 1.5, textTransform: "uppercase", padding: "0 0 8px 12px", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.cogsDetails.map((d) => {
                const m = d.total > 0 ? (d.profit / d.total) * 100 : 0;
                const mColor = m >= 30 ? "var(--success)" : m >= 15 ? "var(--gold)" : "var(--danger)";
                return (
                  <tr key={d.order_id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "7px 0 7px 12px", color: "var(--text-primary)", fontWeight: 700 }}>{d.order_id}</td>
                    <td style={{ padding: "7px 0 7px 12px", color: "var(--gold)", fontWeight: 700, textAlign: "right" }}>{formatCurrency(d.total)}</td>
                    <td style={{ padding: "7px 0 7px 12px", color: "var(--text-secondary)", textAlign: "right" }}>{formatCurrency(d.cogs)}</td>
                    <td style={{ padding: "7px 0 7px 12px", color: d.profit >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700, textAlign: "right" }}>{formatCurrency(d.profit)}</td>
                    <td style={{ padding: "7px 0 7px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: mColor, background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4 }}>{m.toFixed(1)}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Orders */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px" }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Recent Orders</div>
        {recentOrders.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--text-disabled)", textAlign: "center", padding: "1rem 0" }}>No orders yet</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["Order", "Time", "Staff", "Type", "Items", "Total", "Ref", "Status", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: 8, color: "var(--text-disabled)", letterSpacing: 1.5, textTransform: "uppercase", padding: "0 8px 8px 0", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-primary)", fontWeight: 700 }}>{o.id}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{formatTime(o.createdAt)}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.staff?.name?.split(" ")[0] ?? '—'}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.type === "dine-in" ? o.table : "Takeout"}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.items.reduce((s, ci) => s + (ci?.qty ?? 0), 0)}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--gold)", fontWeight: 700 }}>{formatCurrency(o.total)}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)", fontSize: 9 }}>
                    {o.payMethod === 'ewallet' && o.referenceNumber ? (
                      <span style={{ color: "var(--gold)", fontWeight: 600 }}>{o.referenceNumber}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: "7px 0 7px 0" }}>
                    <span className={`pill ${o.status === "completed" ? "pill-success" : o.status === "ready" ? "pill-gold" : "pill-muted"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td style={{ padding: "7px 0 7px 0" }}>
                    <button onClick={() => setReprintOrder(o)} style={{
                      background: "none", border: "1px solid var(--border-default)", borderRadius: 6,
                      color: "var(--text-muted)", fontSize: 8, padding: "3px 8px", cursor: "pointer",
                      letterSpacing: 1, textTransform: "uppercase",
                    }}>
                      🖨 Reprint
                    </button>
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
