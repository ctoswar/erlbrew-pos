import React, { useState } from "react";
import { ZReport } from "../utils/api";
import { formatCurrency } from "../utils";
import { loadPrintSettings, PrintSettings } from "./AdminPrintSettings";
import { getStoreInfo } from "../utils/receiptUtils";

interface Props {
  report: ZReport;
  onClose: () => void;
}

export const ZReportPreview: React.FC<Props> = ({ report, onClose }) => {
  const [settings] = useState<PrintSettings>(loadPrintSettings());
  const [printError, setPrintError] = useState("");

  const STORE = getStoreInfo();

  const PAPER_WIDTH = settings.paperSize === "57mm" ? 216 : settings.paperSize === "58mm" ? 226 : 302;

  const periodStart = new Date(report.period_start).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const periodEnd = new Date(report.period_end).toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  const handlePrint = async () => {
    setPrintError("");
    if (settings.printVia === "bluetooth") {
      try {
        await printZReportViaBluetooth(report, settings);
        onClose();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setPrintError(`Print failed: ${msg}. Make sure the print server is running.`);
      }
    } else {
      openZReportPrintWindow(report, settings);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card-glass overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[92vh] min-w-0 w-full max-w-[420px]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-erl-border-subtle flex-shrink-0">
          <div>
            <div className="font-display text-[14px] font-bold text-erl-text-primary">
              Z-Report Preview
            </div>
            <div className="text-[11px] text-erl-text-faint mt-0.5">
              {settings.paperSize} · {settings.printCopies} {settings.printCopies === 1 ? "copy" : "copies"} · {settings.printVia === "browser" ? "Browser" : "Bluetooth"}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-text-primary hover:bg-erl-surface transition-colors cursor-pointer bg-transparent border-none text-base">
            ✕
          </button>
        </div>

        {/* Scrollable receipt paper */}
        <div className="flex-1 overflow-y-auto overflow-x-auto px-5 py-4 flex justify-center bg-[#e8e4df]">
          <div
            className="receipt-print-target flex-shrink-0"
            style={{
              background: "#fff",
              width: PAPER_WIDTH,
              padding: "20px 16px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
              borderRadius: 2,
              fontFamily: "'Courier New', monospace",
              fontSize: 11,
              lineHeight: 1.5,
              color: "#111",
            }}
          >
            {/* 1. Store Header */}
            {settings.showStoreHeader && (
              <div className="text-center mb-2">
                {STORE.logo && <div className="mb-1"><img src={STORE.logo} alt="Logo" style={{ maxHeight: 48, margin: '0 auto' }} /></div>}
                <div className="text-[15px] font-bold tracking-wide">{STORE.name}</div>
              </div>
            )}

            {/* 2. Report Title */}
            <div className="border-y-2 border-[#222] py-1 text-center mb-2">
              <strong className="text-[10px] tracking-wider">Z-REPORT</strong>
              <div className="text-[9px] text-[#555]">END OF DAY SUMMARY</div>
            </div>

            {/* 3. Report Period */}
            <div className="text-[10px] mb-1.5">
              <div>Date   : {report.report_date}</div>
              <div>From   : {periodStart}</div>
              <div>To     : {periodEnd}</div>
            </div>

            <div className="border-t border-dashed border-[#aaa] mb-1.5" />

            {/* 4. Sales Summary */}
            <div className="text-[10px] mb-1.5">
              <div className="font-bold mb-1 tracking-wide">SALES SUMMARY</div>
              <div className="flex justify-between"><span>Total Sales:</span><span>{formatCurrency(report.total_sales)}</span></div>
              <div className="flex justify-between"><span>Total Orders:</span><span>{report.total_orders}</span></div>
            </div>

            <div className="border-t border-dashed border-[#aaa] mb-1.5" />

            {/* 5. Payment Breakdown */}
            <div className="text-[10px] mb-1.5">
              <div className="font-bold mb-1 tracking-wide">PAYMENT BREAKDOWN</div>
              <div className="flex justify-between"><span>Cash:</span><span>{formatCurrency(report.total_cash)}</span></div>
              <div className="flex justify-between"><span>Card:</span><span>{formatCurrency(report.total_card)}</span></div>
              <div className="flex justify-between"><span>E-Wallet:</span><span>{formatCurrency(report.total_ewallet)}</span></div>
            </div>

            <div className="border-t border-dashed border-[#aaa] mb-1.5" />

            {/* 6. Deductions */}
            <div className="text-[10px] mb-1.5">
              <div className="font-bold mb-1 tracking-wide">DEDUCTIONS</div>
              <div className="flex justify-between"><span>Refunds:</span><span>{formatCurrency(report.total_refunds)}</span></div>
              <div className="flex justify-between"><span>Voids:</span><span>{report.total_voids}</span></div>
            </div>

            <div className="border-t border-dashed border-[#aaa] mb-1.5" />

            {/* 7. COGS & Profit */}
            <div className="text-[10px] mb-1">
              <div className="flex justify-between"><span>COGS:</span><span>{formatCurrency(report.total_cogs)}</span></div>
            </div>
            <div className="border-y-2 border-[#222] py-[5px] mb-1.5">
              <div className="flex justify-between font-bold text-[13px]">
                <span>GROSS PROFIT</span><span>{formatCurrency(report.gross_profit)}</span>
              </div>
            </div>

            {/* 8. Footer */}
            <div className="border-t border-dashed border-[#aaa] pt-2 text-center text-[10px]">
              <div className="mb-0.5">Report generated successfully</div>
              <div className="mb-2">Keep this copy for your records</div>
            </div>
          </div>
        </div>

        {/* Print error */}
        {printError && (
          <div className="mx-5 px-4 py-2.5 bg-erl-danger-bg border border-erl-danger-border rounded-xl text-[12px] text-erl-danger">
            {printError}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 px-5 py-4 border-t border-erl-border-subtle flex-shrink-0">
          <button className="btn btn-outline flex-1 text-[12px] py-2.5" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent flex-1 text-[12px] py-2.5"
            onClick={handlePrint}
          >
            🖨 Print ({settings.printCopies})
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Print helpers (same pattern as ReceiptPreview) ─────────── */

function buildZReportLines(report: ZReport, settings: PrintSettings): string[] {
  const STORE = getStoreInfo();
  const W = settings.paperSize === '57mm' ? 32 : settings.paperSize === '58mm' ? 34 : 44;

  function padCenter(text: string, width = W): string {
    const s = text.length <= width ? text : text.substring(0, width - 2) + '..';
    return ' '.repeat(Math.max(0, Math.floor((width - s.length) / 2))) + s;
  }
  function padRight(text: string, width = W): string {
    const s = text.length <= width ? text : text.substring(0, width - 1) + '…';
    return s.padEnd(width);
  }
  function padLeft(text: string, width = W): string {
    return text.padStart(width);
  }
  function ln(char = '-'): string { return char.repeat(W); }

  const lines: string[] = [];

  if (settings.showStoreHeader) {
    lines.push(padCenter(STORE.name));
    lines.push(ln("="));
  }

  lines.push(padCenter("Z-REPORT"));
  lines.push(padCenter("END OF DAY SUMMARY"));
  lines.push(ln("="));

  const periodStart = new Date(report.period_start).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const periodEnd = new Date(report.period_end).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  lines.push(`Date   : ${report.report_date}`);
  lines.push(`From   : ${periodStart}`);
  lines.push(`To     : ${periodEnd}`);
  lines.push(ln("-"));

  lines.push(padRight("SALES SUMMARY", W));
  lines.push(ln("-"));
  lines.push(`${padRight("Total Sales:", 22)}${padLeft(formatCurrency(report.total_sales).replace("₱","").trim(), 9)}`);
  lines.push(`${padRight("Total Orders:", 22)}${padLeft(String(report.total_orders), 9)}`);
  lines.push(ln("-"));

  lines.push(padRight("PAYMENT BREAKDOWN", W));
  lines.push(ln("-"));
  lines.push(`${padRight("Cash:", 22)}${padLeft(formatCurrency(report.total_cash).replace("₱","").trim(), 9)}`);
  lines.push(`${padRight("Card:", 22)}${padLeft(formatCurrency(report.total_card).replace("₱","").trim(), 9)}`);
  lines.push(`${padRight("E-Wallet:", 22)}${padLeft(formatCurrency(report.total_ewallet).replace("₱","").trim(), 9)}`);
  lines.push(ln("-"));

  lines.push(padRight("DEDUCTIONS", W));
  lines.push(ln("-"));
  lines.push(`${padRight("Refunds:", 22)}${padLeft(formatCurrency(report.total_refunds).replace("₱","").trim(), 9)}`);
  lines.push(`${padRight("Voids:", 22)}${padLeft(String(report.total_voids), 9)}`);
  lines.push(ln("-"));

  lines.push(`${padRight("COGS:", 22)}${padLeft(formatCurrency(report.total_cogs).replace("₱","").trim(), 9)}`);
  lines.push(ln("="));
  lines.push(`${padRight("GROSS PROFIT:", 22)}${padLeft(formatCurrency(report.gross_profit).replace("₱","").trim(), 9)}`);
  lines.push(ln("="));

  lines.push(" ");
  lines.push(padCenter("Report generated successfully"));
  lines.push(padCenter("Keep this copy for your records"));
  lines.push(" ");
  lines.push(" ");

  return lines;
}

function openZReportPrintWindow(report: ZReport, settings: PrintSettings): void {
  const FONT = "'Courier New', 'Lucida Console', monospace";
  const FONT_SIZE = 11;
  const lines = buildZReportLines(report, settings);
  const PAPER_MM = settings.paperSize === '57mm' ? 57 : settings.paperSize === '58mm' ? 58 : 80;

  const win = window.open("", "_blank", "width=400,height=700");
  if (!win) return;
  const doc = win.document;
  doc.write("<!DOCTYPE html><html><head>");
  doc.write("<title>Z-Report</title>");
  doc.write(`<style>
    @page { margin: 0; size: ${PAPER_MM}mm auto; }
    body {
      font-family: ${FONT}; font-size: ${FONT_SIZE}px; line-height: 1.4;
      width: ${PAPER_MM}mm; margin: 0; padding: 8px 6px;
      box-sizing: border-box; color: #000; background: #fff;
    }
    pre {
      font-family: ${FONT}; font-size: ${FONT_SIZE}px; line-height: 1.45;
      margin: 0; white-space: pre-wrap; word-break: keep-all;
    }
  </style>`);
  doc.write("</head><body>");
  doc.write(`<pre>${lines.join("\n")}</pre>`);
  doc.write(`<script>window.print(); window.close();<\/script>`);
  doc.write("</body></html>");
  doc.close();
}

async function printZReportViaBluetooth(report: ZReport, settings: PrintSettings): Promise<void> {
  const lines = buildZReportLines(report, settings);

  // Use backend proxy (same as order receipts)
  const baseUrl = (import.meta.env.VITE_API_URL as string) || '';

  // Repeat lines for multi-copy
  const allLines = Array(settings.printCopies).fill(lines).flat();

  const res = await fetch(`${baseUrl}/api/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lines: allLines,
      paperSize: settings.paperSize,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Print server error ${res.status}`);
  }
}
