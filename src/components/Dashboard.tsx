import React, { useState, useEffect } from "react";
import { Order } from "../types";
import { buildDailySummary, formatCurrency, formatTime } from "../utils";
import { apiAdminGet } from "../utils/api";

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

  useEffect(() => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    apiAdminGet<CogsData>(`/orders/cogs?start=${fmt(today)}&end=${fmt(today)}`)
      .then(setCogsData)
      .catch(() => {});
  }, []);

  const summary = buildDailySummary(orders, cogsData ?? undefined);
  const recentOrders = [...orders].slice(0, 8);

  const marginColor = (summary.profitMargin ?? 0) >= 30
    ? "var(--success)"
    : (summary.profitMargin ?? 0) >= 15
    ? "var(--gold)"
    : "var(--danger)";

  return (
    <div className="scroll-area" style={{ flex: 1, padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div className="font-display" style={{ fontSize: 18, color: "var(--text-primary)" }}>Daily Dashboard</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{summary.date}</div>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Viewing as <strong style={{ color: "var(--gold)" }}>{staffName}</strong></div>
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
                {["Order", "Time", "Staff", "Type", "Items", "Total", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: 8, color: "var(--text-disabled)", letterSpacing: 1.5, textTransform: "uppercase", padding: "0 8px 8px 0", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-primary)", fontWeight: 700 }}>{o.id}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{formatTime(o.createdAt)}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.staff.name.split(" ")[0]}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.type === "dine-in" ? o.table : "Takeout"}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.items.reduce((s, ci) => s + ci.qty, 0)}</td>
                  <td style={{ padding: "7px 8px 7px 0", color: "var(--gold)", fontWeight: 700 }}>{formatCurrency(o.total)}</td>
                  <td style={{ padding: "7px 0 7px 0" }}>
                    <span className={`pill ${o.status === "completed" ? "pill-success" : o.status === "ready" ? "pill-gold" : "pill-muted"}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
