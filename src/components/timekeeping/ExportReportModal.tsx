import React from "react";
import { AnimatedDatePicker } from "../AnimatedDatePicker";

interface Props {
  show: boolean;
  printFrom: string;
  printTo: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onPrint: () => void;
  onExportPDF: () => void;
  onClose: () => void;
}

const toDateInputValue = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const ExportReportModal: React.FC<Props> = ({
  show,
  printFrom,
  printTo,
  onFromChange,
  onToChange,
  onPrint,
  onExportPDF,
  onClose,
}) => {
  if (!show) return null;

  const applyPreset = (preset: "today" | "week" | "month") => {
    const now = new Date();
    if (preset === "today") {
      onFromChange(toDateInputValue(now));
      onToChange(toDateInputValue(now));
    } else if (preset === "week") {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      onFromChange(toDateInputValue(from));
      onToChange(toDateInputValue(now));
    } else {
      onFromChange(toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
      onToChange(toDateInputValue(now));
    }
  };

  const isValidRange = Boolean(printFrom && printTo && printFrom <= printTo);

  const presets: { key: "today" | "week" | "month"; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "Last 7 days" },
    { key: "month", label: "This month" },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="animate-scale-in bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl w-full max-w-[420px]">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-erl-border-subtle flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-erl-accent/10 flex items-center justify-center flex-shrink-0">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-base font-bold text-erl-text-primary">Export Timekeeping Report</div>
              <div className="text-[11px] text-erl-text-muted mt-0.5">Pick a date range to generate the report</div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-text-primary hover:bg-erl-surface transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="px-6 py-5">
            {/* Quick presets */}
            <div className="flex gap-2 mb-4">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className="flex-1 text-[11px] font-semibold tracking-wide px-3 py-2 rounded-lg border border-erl-border-default text-erl-text-secondary hover:border-erl-accent/40 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[36px]"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1.5 block">From</label>
                <AnimatedDatePicker
                  value={printFrom}
                  onChange={onFromChange}
                  max={printTo || undefined}
                />
              </div>
              <div className="min-w-0">
                <label className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1.5 block">To</label>
                <AnimatedDatePicker
                  value={printTo}
                  onChange={onToChange}
                  min={printFrom || undefined}
                />
              </div>
            </div>

            {!isValidRange && printFrom && printTo && (
              <div className="mt-3 text-[11px] text-erl-danger font-semibold">
                “From” date must not be after “To” date.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 px-6 py-4 border-t border-erl-border-subtle">
            <button onClick={onClose} className="btn btn-ghost flex-1 text-xs px-4 py-2.5 min-h-[44px]">
              Cancel
            </button>
            <button
              onClick={onExportPDF}
              disabled={!isValidRange}
              className="btn btn-outline flex-1 text-xs px-4 py-2.5 font-semibold tracking-wide min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              PDF
            </button>
            <button
              onClick={onPrint}
              disabled={!isValidRange}
              className="btn btn-accent flex-1 text-xs px-4 py-2.5 font-semibold tracking-wide min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExportReportModal;
