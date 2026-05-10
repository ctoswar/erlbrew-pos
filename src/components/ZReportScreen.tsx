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
    <div style={{ padding: "1rem 1.2rem", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
            Z-Report
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Generate end-of-day sales summary
          </div>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn btn-gold" style={{ padding: "8px 18px", fontSize: 10 }}>
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {/* Last generated report */}
      {lastReport && (
        <div className="card-glass" style={{ padding: "1rem" }}>
          <div className="font-display" style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
            📊 Report — {new Date(lastReport.period_end).toLocaleTimeString()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat label="Total Sales" value={formatCurrency(lastReport.total_sales)} gold />
            <Stat label="Orders" value={String(lastReport.total_orders)} />
            <Stat label="Cash" value={formatCurrency(lastReport.total_cash)} />
            <Stat label="Card" value={formatCurrency(lastReport.total_card)} />
            <Stat label="E-Wallet" value={formatCurrency(lastReport.total_ewallet)} />
            <Stat label="Refunds" value={formatCurrency(lastReport.total_refunds)} color="var(--danger)" />
            <Stat label="Voids" value={String(lastReport.total_voids)} color="var(--text-muted)" />
            <Stat label="COGS" value={formatCurrency(lastReport.total_cogs)} />
            <Stat label="Gross Profit" value={formatCurrency(lastReport.gross_profit)} color={lastReport.gross_profit >= 0 ? "var(--success)" : "var(--danger)"} />
          </div>
        </div>
      )}

      {/* Past reports */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>
          Recent Reports
        </div>
        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: 11, padding: "2rem 0", textAlign: "center" }}>Loading...</div>
        ) : reports.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 11, padding: "2rem 0", textAlign: "center" }}>No reports yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reports.map((r) => (
              <div key={r.id} className="card" style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                    {r.report_date} • {new Date(r.period_start).toLocaleTimeString()} — {new Date(r.period_end).toLocaleTimeString()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {r.total_orders} orders • {formatCurrency(r.total_sales)} sales
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: r.gross_profit >= 0 ? "var(--success)" : "var(--danger)" }}>
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
    <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: gold ? "'Playfair Display', serif" : undefined, color: color || (gold ? "var(--gold)" : "var(--text-primary)") }}>
      {value}
    </div>
  </div>
);