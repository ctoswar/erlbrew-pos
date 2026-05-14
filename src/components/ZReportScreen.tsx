import React, { useState, useEffect, useMemo } from "react";
import { generateZReport, getZReports, ZReport } from "../utils/api";
import { formatCurrency } from "../utils";

export const ZReportScreen: React.FC = () => {
  const [reports, setReports] = useState<ZReport[]>([]);
  const [lastReport, setLastReport] = useState<ZReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const loadReports = () => {
    setLoading(true);
    setError("");
    getZReports(10)
      .then(setReports)
      .catch(() => setError("Failed to load reports"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReports(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const report = await generateZReport();
      setLastReport(report);
      loadReports();
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("401") || msg.includes("NO_TOKEN") || msg.includes("INVALID_TOKEN") || msg.includes("TOKEN_EXPIRED")) {
        setError("Session expired — please log out and log in again.");
      } else {
        setError(e.message || "Failed to generate report");
      }
    } finally {
      setGenerating(false);
    }
  };

  interface StatItem {
    label: string;
    value: string;
    accent?: boolean;
    danger?: boolean;
    success?: boolean;
    muted?: boolean;
  }

  // Compute totals from last report for summary cards
  const lastReportStats = useMemo((): StatItem[] | null => {
    if (!lastReport) return null;
    return [
      { label: "Total Sales", value: formatCurrency(lastReport.total_sales), accent: true },
      { label: "Orders", value: String(lastReport.total_orders) },
      { label: "Cash", value: formatCurrency(lastReport.total_cash) },
      { label: "Card", value: formatCurrency(lastReport.total_card) },
      { label: "E-Wallet", value: formatCurrency(lastReport.total_ewallet) },
      { label: "Refunds", value: formatCurrency(lastReport.total_refunds), danger: true },
      { label: "Voids", value: String(lastReport.total_voids), muted: true },
      { label: "COGS", value: formatCurrency(lastReport.total_cogs) },
      { label: "Gross Profit", value: formatCurrency(lastReport.gross_profit), success: lastReport.gross_profit >= 0, danger: lastReport.gross_profit < 0 },
    ];
  }, [lastReport]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="glass-panel flex items-center justify-between px-5 py-3.5 border-b border-erl-accent/10 flex-shrink-0 rounded-none">
        <div>
          <h2 className="font-display text-base font-bold text-erl-text-primary tracking-wide">
            Z-Report
          </h2>
          <div className="text-[11px] text-erl-text-muted mt-0.5">
            Generate end-of-day sales summaries
          </div>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn btn-accent text-[11px] px-4 py-2 tracking-wide">
          {generating ? "Generating…" : "Generate Report"}
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────── */}
      {error && (
        <div className="mx-5 mt-4 px-4 py-2.5 bg-erl-danger-bg border border-erl-danger-border rounded-xl text-[12px] text-erl-danger">
          {error}
        </div>
      )}

      {/* ── Last Report ─────────────────────────────────────── */}
      {lastReport && lastReportStats && (
        <div className="mx-5 mt-4 card-glass overflow-hidden rounded-2xl">
          {/* Report header */}
          <div className="px-5 pt-4 pb-3 border-b border-erl-border-subtle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[20px]">📊</span>
                <div>
                  <div className="text-[14px] font-bold text-erl-text-primary">
                    Report — {new Date(lastReport.period_end).toLocaleTimeString()}
                  </div>
                  <div className="text-[11px] text-erl-text-faint">
                    {new Date(lastReport.period_start).toLocaleString()} → {new Date(lastReport.period_end).toLocaleString()}
                  </div>
                </div>
              </div>
              <span className="pill text-[10px] px-2.5 py-1 bg-erl-success/10 text-erl-success border border-erl-success/20">Generated</span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-px bg-erl-border-subtle/30">
            {lastReportStats.map((stat) => (
              <div key={stat.label} className={`
                px-4 py-3
                ${stat.accent ? "bg-erl-accent/8" : stat.danger ? "bg-erl-danger/5" : stat.success ? "bg-erl-success/5" : "bg-erl-surface/60"}
              `}>
                <div className="text-[11px] text-erl-text-faint tracking-wide uppercase font-semibold">{stat.label}</div>
                <div className={`
                  text-[15px] font-bold mt-0.5 tabular-nums
                  ${stat.accent ? "text-erl-accent font-display" : stat.danger ? "text-erl-danger" : stat.success ? "text-erl-success" : stat.muted ? "text-erl-text-faint" : "text-erl-text-primary"}
                `}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Reports ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
        <div className="text-[12px] font-bold text-erl-text-secondary tracking-wider uppercase mb-3">
          Recent Reports
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="animate-shimmer w-28 h-4 rounded-md" />
            <div className="animate-shimmer w-20 h-3 rounded-md" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <span className="text-2xl">📋</span>
            <div className="text-[13px] text-erl-text-disabled">No reports generated yet</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-erl-border-subtle bg-erl-surface/60 px-4 py-3 hover:border-erl-border-medium hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-erl-text-primary">
                      {r.report_date}
                    </div>
                    <div className="text-[11px] text-erl-text-faint mt-0.5">
                      {new Date(r.period_start).toLocaleTimeString()} → {new Date(r.period_end).toLocaleTimeString()}
                      <span className="mx-1.5">·</span>
                      {r.total_orders} order{r.total_orders !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <div className="text-right">
                      <div className="text-[12px] text-erl-text-faint">Sales</div>
                      <div className="text-[13px] font-bold text-erl-accent tabular-nums">{formatCurrency(r.total_sales)}</div>
                    </div>
                    <div className="w-px h-8 bg-erl-border-subtle" />
                    <div className="text-right">
                      <div className="text-[12px] text-erl-text-faint">Profit</div>
                      <div className={`text-[13px] font-bold tabular-nums ${r.gross_profit >= 0 ? "text-erl-success" : "text-erl-danger"}`}>
                        {formatCurrency(r.gross_profit)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};