import React, { useState, useEffect } from "react";
import { generateZReport, getZReports, ZReport } from "../utils/api";
import { formatCurrency } from "../utils";

export const ZReportScreen: React.FC = () => {
  const [reports, setReports] = useState<ZReport[]>([]);
  const [lastReport, setLastReport] = useState<ZReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadReports = () => {
    setLoading(true);
    getZReports(10)
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReports(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const report = await generateZReport();
      setLastReport(report);
      loadReports();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="px-5 py-4 flex flex-col gap-3.5 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] text-erl-accent tracking-widest font-bold uppercase">
            Z-Report
          </div>
          <div className="text-[11px] text-erl-muted mt-0.5">
            Generate end-of-day sales summary
          </div>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn btn-accent px-4.5 py-2 text-[10px]">
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {/* Last generated report */}
      {lastReport && (
        <div className="card-glass p-4">
          <div className="font-display text-xs font-bold text-erl-text-primary mb-2.5">
            📊 Report — {new Date(lastReport.period_end).toLocaleTimeString()}
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            <Stat label="Total Sales" value={formatCurrency(lastReport.total_sales)} gold />
            <Stat label="Orders" value={String(lastReport.total_orders)} />
            <Stat label="Cash" value={formatCurrency(lastReport.total_cash)} />
            <Stat label="Card" value={formatCurrency(lastReport.total_card)} />
            <Stat label="E-Wallet" value={formatCurrency(lastReport.total_ewallet)} />
            <Stat label="Refunds" value={formatCurrency(lastReport.total_refunds)} color="text-erl-danger" />
            <Stat label="Voids" value={String(lastReport.total_voids)} color="text-erl-muted" />
            <Stat label="COGS" value={formatCurrency(lastReport.total_cogs)} />
            <Stat label="Gross Profit" value={formatCurrency(lastReport.gross_profit)} color={lastReport.gross_profit >= 0 ? "text-erl-success" : "text-erl-danger"} />
          </div>
        </div>
      )}

      {/* Past reports */}
      <div>
        <div className="text-[10px] font-bold text-erl-secondary tracking-wider uppercase mb-2">
          Recent Reports
        </div>
        {loading ? (
          <div className="text-erl-muted text-[11px] py-8 text-center">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="text-erl-muted text-[11px] py-8 text-center">No reports yet</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {reports.map((r) => (
              <div key={r.id} className="card flex items-center gap-2.5 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-erl-text-primary">
                    {r.report_date} • {new Date(r.period_start).toLocaleTimeString()} — {new Date(r.period_end).toLocaleTimeString()}
                  </div>
                  <div className="text-[10px] text-erl-muted">
                    {r.total_orders} orders • {formatCurrency(r.total_sales)} sales
                  </div>
                </div>
                <div className={`text-xs font-bold ${r.gross_profit >= 0 ? "text-erl-success" : "text-erl-danger"}`}>
                  {formatCurrency(r.gross_profit)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; color?: string; gold?: boolean }> = ({ label, value, color, gold }) => (
  <div>
    <div className="text-[9px] text-erl-muted tracking-wide font-semibold">{label}</div>
    <div className={`text-sm font-bold ${gold ? "font-display text-erl-accent" : color || "text-erl-text-primary"}`}>
      {value}
    </div>
  </div>
);
