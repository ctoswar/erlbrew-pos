import React, { useState, useCallback } from "react";
import { Order } from "../types";
import { formatCurrency, formatTime } from "../utils";
import { apiGet } from "../utils/api";
import { serverOrderToOrder } from "../hooks/useOrders";

interface HistoryResponse {
  orders: any[];
  total: number;
  limit: number;
  offset: number;
}

export const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchHistory = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('start', startDate);
      params.set('end', endDate);
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', String(limit));
      params.set('offset', String(newOffset));

      const data = await apiGet<HistoryResponse>(`/orders/history?${params}`);
      setOrders(data.orders.map(serverOrderToOrder));
      setTotal(data.total);
      setOffset(newOffset);
    } catch (err) {
      console.error("Failed to load order history:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, search, statusFilter]);

  const handleSearch = () => { fetchHistory(0); };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "0.9rem 1rem", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
          Order History
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 1, textTransform: "uppercase" }}>From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-primary)", padding: "6px 10px", fontSize: 11 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 1, textTransform: "uppercase" }}>To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-primary)", padding: "6px 10px", fontSize: 11 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 1, textTransform: "uppercase" }}>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-primary)", padding: "6px 10px", fontSize: 11 }}>
              <option value="">All</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID or staff…"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{ flex: 1, minWidth: 150, background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-primary)", padding: "6px 10px", fontSize: 11 }} />
          <button onClick={handleSearch} disabled={loading} style={{
            padding: "6px 16px", borderRadius: 6, border: "none", background: "var(--gold)",
            color: "var(--bg-sidebar)", fontSize: 9, fontWeight: 700, cursor: loading ? "wait" : "pointer",
            letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap",
          }}>
            {loading ? "⟳" : "Search"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="scroll-area" style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "1rem" }}>
        {loading && orders.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem", fontSize: 12 }}>
            No orders found for this period.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 10, letterSpacing: 1 }}>
              {total} order{total !== 1 ? 's' : ''} found
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {["Order", "Date", "Time", "Staff", "Type", "Items", "Total", "Payment", "Status"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 8, color: "var(--text-disabled)", letterSpacing: 1.5, textTransform: "uppercase", padding: "0 8px 8px 0", fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--text-primary)", fontWeight: 700, fontFamily: "monospace", fontSize: 10 }}>
                      #{o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)", fontSize: 10 }}>
                      {o.createdAt.toLocaleDateString("en-PH", { month: "short", day: "2-digit" })}
                    </td>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)", fontSize: 10 }}>
                      {formatTime(o.createdAt)}
                    </td>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.staff?.name?.split(" ")[0] ?? '—'}</td>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.type === "dine-in" ? o.table || "Dine-in" : "Takeout"}</td>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)" }}>{o.items.reduce((s, ci) => s + (ci?.qty ?? 0), 0)}</td>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--gold)", fontWeight: 700 }}>{formatCurrency(o.total)}</td>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--text-muted)", fontSize: 10, textTransform: "capitalize" }}>{o.payMethod}</td>
                    <td style={{ padding: "7px 0 7px 0" }}>
                      <span className={`pill ${o.status === "completed" ? "pill-success" : o.status === "ready" ? "pill-gold" : o.status === "voided" || o.status === "refunded" ? "pill-danger" : "pill-muted"}`}
                        style={{ fontSize: 8 }}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
                <button onClick={() => fetchHistory(0)} disabled={offset === 0} style={{
                  padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                  background: "transparent", color: offset === 0 ? "var(--text-disabled)" : "var(--text-primary)",
                  fontSize: 9, cursor: offset === 0 ? "default" : "pointer",
                }}>« First</button>
                <button onClick={() => fetchHistory(Math.max(0, offset - limit))} disabled={offset === 0} style={{
                  padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                  background: "transparent", color: offset === 0 ? "var(--text-disabled)" : "var(--text-primary)",
                  fontSize: 9, cursor: offset === 0 ? "default" : "pointer",
                }}>← Prev</button>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button onClick={() => fetchHistory(offset + limit)} disabled={offset + limit >= total} style={{
                  padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                  background: "transparent", color: offset + limit >= total ? "var(--text-disabled)" : "var(--text-primary)",
                  fontSize: 9, cursor: offset + limit >= total ? "default" : "pointer",
                }}>Next →</button>
                <button onClick={() => fetchHistory((totalPages - 1) * limit)} disabled={offset + limit >= total} style={{
                  padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                  background: "transparent", color: offset + limit >= total ? "var(--text-disabled)" : "var(--text-primary)",
                  fontSize: 9, cursor: offset + limit >= total ? "default" : "pointer",
                }}>Last »</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};