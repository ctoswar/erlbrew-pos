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
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-erl-border-default flex-shrink-0">
        <div className="text-[9px] text-erl-accent tracking-widest uppercase font-bold mb-3">
          Order History
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex flex-col gap-[3px]">
            <label className="text-[8px] text-erl-text-faint tracking-wide uppercase">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]" />
          </div>
          <div className="flex flex-col gap-[3px]">
            <label className="text-[8px] text-erl-text-faint tracking-wide uppercase">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]" />
          </div>
          <div className="flex flex-col gap-[3px]">
            <label className="text-[8px] text-erl-text-faint tracking-wide uppercase">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]">
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
            className="flex-1 min-w-[150px] bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]" />
          <button onClick={handleSearch} disabled={loading} className={`
            px-4 py-1.5 rounded-md border-none bg-erl-accent text-erl-sidebar text-[9px] font-bold tracking-wide uppercase whitespace-nowrap
            ${loading ? "cursor-wait" : "cursor-pointer"}
          `}>
            {loading ? "⟳" : "Search"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="scroll-area flex-1 overflow-y-auto min-h-0 p-4">
        {loading && orders.length === 0 ? (
          <div className="text-center text-erl-muted py-12">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-erl-muted py-12 text-xs">
            No orders found for this period.
          </div>
        ) : (
          <>
            <div className="text-[9px] text-erl-text-faint mb-2.5 tracking-wide">
              {total} order{total !== 1 ? 's' : ''} found
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-erl-border-default">
                  {["Order", "Date", "Time", "Staff", "Type", "Items", "Total", "Payment", "Status"].map(h => (
                    <th key={h} className="text-left text-[8px] text-erl-text-disabled tracking-widest uppercase pb-2 pr-2 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-erl-border-subtle">
                    <td className="py-1.5 pr-2 text-erl-text-primary font-bold font-mono text-[10px]">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-1.5 pr-2 text-erl-muted text-[10px]">
                      {o.createdAt.toLocaleDateString("en-PH", { month: "short", day: "2-digit" })}
                    </td>
                    <td className="py-1.5 pr-2 text-erl-muted text-[10px]">
                      {formatTime(o.createdAt)}
                    </td>
                    <td className="py-1.5 pr-2 text-erl-muted">{o.staff?.name?.split(" ")[0] ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-erl-muted">{o.type === "dine-in" ? o.customerName || "Dine-in" : "Takeout"}</td>
                    <td className="py-1.5 pr-2 text-erl-muted">{o.items.reduce((s, ci) => s + (ci?.qty ?? 0), 0)}</td>
                    <td className="py-1.5 pr-2 text-erl-accent font-bold">{formatCurrency(o.total)}</td>
                    <td className="py-1.5 pr-2 text-erl-muted text-[10px] capitalize">{o.payMethod}</td>
                    <td className="py-1.5">
                      <span className={`pill text-[8px] ${o.status === "completed" ? "pill-success" : o.status === "ready" ? "pill-gold" : o.status === "voided" || o.status === "refunded" ? "pill-danger" : "pill-muted"}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <button onClick={() => fetchHistory(0)} disabled={offset === 0} className={`
                  px-3 py-1.5 rounded-md border border-erl-border-default bg-transparent text-[9px]
                  ${offset === 0 ? "text-erl-text-disabled cursor-default" : "text-erl-text-primary cursor-pointer"}
                `}>« First</button>
                <button onClick={() => fetchHistory(Math.max(0, offset - limit))} disabled={offset === 0} className={`
                  px-3 py-1.5 rounded-md border border-erl-border-default bg-transparent text-[9px]
                  ${offset === 0 ? "text-erl-text-disabled cursor-default" : "text-erl-text-primary cursor-pointer"}
                `}>← Prev</button>
                <span className="text-[10px] text-erl-muted">
                  Page {currentPage} of {totalPages}
                </span>
                <button onClick={() => fetchHistory(offset + limit)} disabled={offset + limit >= total} className={`
                  px-3 py-1.5 rounded-md border border-erl-border-default bg-transparent text-[9px]
                  ${offset + limit >= total ? "text-erl-text-disabled cursor-default" : "text-erl-text-primary cursor-pointer"}
                `}>Next →</button>
                <button onClick={() => fetchHistory((totalPages - 1) * limit)} disabled={offset + limit >= total} className={`
                  px-3 py-1.5 rounded-md border border-erl-border-default bg-transparent text-[9px]
                  ${offset + limit >= total ? "text-erl-text-disabled cursor-default" : "text-erl-text-primary cursor-pointer"}
                `}>Last »</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
