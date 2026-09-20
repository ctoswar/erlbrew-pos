import React from "react";

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

  return (
    <>
      <div className="fixed inset-0 bg-black/65 z-[998]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[360px]">
          <div className="font-display text-base font-bold text-erl-text-primary mb-4">Export Timekeeping Report</div>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1.5 block">From</label>
              <input
                type="date"
                value={printFrom}
                onChange={(e) => onFromChange(e.target.value)}
                className="w-full text-sm bg-erl-base border border-erl-border-medium rounded-xl px-3 py-2.5 text-erl-text-primary outline-none focus:border-erl-accent"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1.5 block">To</label>
              <input
                type="date"
                value={printTo}
                onChange={(e) => onToChange(e.target.value)}
                className="w-full text-sm bg-erl-base border border-erl-border-medium rounded-xl px-3 py-2.5 text-erl-text-primary outline-none focus:border-erl-accent"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="btn btn-ghost text-xs px-4 py-2.5 min-h-[44px]">
              Cancel
            </button>
            <button onClick={onExportPDF} className="btn btn-accent text-xs px-5 py-2.5 font-semibold tracking-wide min-h-[44px]">
              PDF
            </button>
            <button onClick={onPrint} className="btn btn-accent text-xs px-5 py-2.5 font-semibold tracking-wide min-h-[44px]">
              Print
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExportReportModal;
