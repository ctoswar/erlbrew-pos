import React, { useState, useEffect } from "react";
import { formatDate, formatTime } from "../utils";
import { getAuditLogs, AuditLog } from "../utils/api";

const ACTION_LABELS: Record<string, string> = {
  order_void: "Order Void",
  order_refund: "Order Refund",
  fresh_start: "Fresh Start",
  inventory_create: "Inventory Create",
  inventory_update: "Inventory Update",
  inventory_delete: "Inventory Delete",
  inventory_reset_costs: "Reset Costs",
  staff_create: "Staff Create",
  staff_update: "Staff Update",
};

export const AdminAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [actionFilter, setActionFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        startDate,
        endDate,
        action: actionFilter || undefined,
        limit,
        offset,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      console.error("Failed to fetch audit logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate, actionFilter, offset]);

  const actions = Object.entries(ACTION_LABELS);

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
        <h2 className="font-display text-lg font-bold text-erl-text-primary">Audit Log</h2>
        <div className="text-[10px] text-erl-text-muted">{total} total events</div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row flex-wrap gap-3 mb-6">
        <div className="w-full md:w-auto">
          <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">From</div>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setOffset(0); }}
            className="w-full md:w-auto bg-erl-surface border border-erl-border-default rounded-lg px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent" />
        </div>
        <div className="w-full md:w-auto">
          <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">To</div>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setOffset(0); }}
            className="w-full md:w-auto bg-erl-surface border border-erl-border-default rounded-lg px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent" />
        </div>
        <div className="w-full md:w-auto">
          <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">Action</div>
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
            className="w-full md:w-auto bg-erl-surface border border-erl-border-default rounded-lg px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent cursor-pointer">
            <option value="">All actions</option>
            {actions.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={fetchLogs} disabled={loading}
            className="w-full md:w-auto px-4 py-2 rounded-lg bg-erl-accent text-white text-xs font-bold tracking-wide cursor-pointer hover:bg-erl-accent-hover transition-colors disabled:opacity-50">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-erl-border-default">
              <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Time</th>
              <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Staff</th>
              <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Action</th>
              <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Entity</th>
              <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-erl-border-subtle hover:bg-erl-surface/50 transition-colors">
                <td className="py-2.5 px-3 text-[10px] text-erl-text-secondary whitespace-nowrap">
                  <div>{formatDate(new Date(log.created_at))}</div>
                  <div className="text-erl-text-faint">{formatTime(new Date(log.created_at))}</div>
                </td>
                <td className="py-2.5 px-3 text-[10px] text-erl-text-primary whitespace-nowrap">
                  {log.staff_name || <span className="text-erl-text-faint">—</span>}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                    log.action.includes('void') || log.action.includes('delete') || log.action.includes('reset')
                      ? 'bg-erl-danger/10 text-erl-danger'
                      : log.action.includes('create')
                      ? 'bg-erl-success/10 text-erl-success'
                      : 'bg-erl-accent/10 text-erl-accent'
                  }`}>
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-[10px] text-erl-text-secondary whitespace-nowrap">
                  {log.entity_type ? `${log.entity_type} #${String(log.entity_id).slice(0, 12)}` : <span className="text-erl-text-faint">—</span>}
                </td>
                <td className="py-2.5 px-3 text-[10px] text-erl-text-secondary max-w-[300px] truncate">
                  {log.details ? JSON.stringify(log.details) : <span className="text-erl-text-faint">—</span>}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[10px] text-erl-text-muted">No audit events found for this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setOffset((p) => Math.max(0, p - limit))} disabled={offset === 0}
            className="px-3 py-1.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-text-secondary text-[10px] font-bold cursor-pointer hover:bg-erl-surface disabled:opacity-40 disabled:cursor-default">
            ← Previous
          </button>
          <span className="text-[10px] text-erl-text-muted">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button onClick={() => setOffset((p) => p + limit)} disabled={offset + limit >= total}
            className="px-3 py-1.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-text-secondary text-[10px] font-bold cursor-pointer hover:bg-erl-surface disabled:opacity-40 disabled:cursor-default">
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
