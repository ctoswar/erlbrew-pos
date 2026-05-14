import React, { useState } from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";
import { loadPrintSettings, PrintSettings } from "./AdminPrintSettings";
import { openPrintWindow, printViaBluetooth } from "../utils/receiptUtils";

interface Props {
  order: Order;
  onClose: () => void;
}

export const ReceiptPreview: React.FC<Props> = ({ order, onClose }) => {
  const [settings] = useState<PrintSettings>(loadPrintSettings());

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const payLabel = order.payMethod === "cash" ? "CASH" : order.payMethod === "card" ? "CARD" : "E-WALLET";

  const handlePrint = async () => {
    const discountAmount = order.discount?.amount;
    const discountLabel = order.discount?.label;
    if (settings.printVia === "bluetooth") {
      try {
        await printViaBluetooth(order, settings, discountAmount, discountLabel);
        onClose();
      } catch (e: any) {
        const msg = e?.message || e?.reason?.message || String(e);
        alert(`Print failed:\n${msg}\n\nMake sure the print server is running.`);
      }
    } else {
      openPrintWindow(order, settings, discountAmount, discountLabel);
      onClose();
    }
  };

  const PAPER_WIDTH = settings.paperSize === "58mm" ? 240 : 280;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/75 flex items-center justify-center backdrop-blur-sm">
      {/* Preview pane */}
      <div className="bg-erl-elevated rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] min-w-[360px]">
        {/* Toolbar */}
        <div className="bg-erl-sidebar px-5 py-3.5 border-b border-erl-border-default flex items-center justify-between flex-shrink-0">
          <div className="text-[13px] font-bold text-erl-text-primary font-display">
            Receipt Preview
          </div>
          <div className="text-[9px] text-erl-muted">
            {settings.paperSize} · {settings.printCopies} {settings.printCopies === 1 ? "copy" : "copies"}
          </div>
          <button onClick={onClose} className="bg-none border-none text-erl-muted text-xl cursor-pointer px-1">✕</button>
        </div>

        {/* Scrollable receipt paper */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex justify-center bg-[#e8e4df]">
          {/* Receipt paper — class added so @media print can isolate it */}
          <div
            className="receipt-print-target"
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
                <div className="text-[15px] font-bold tracking-wide">ERLBREW CAFE</div>
                <div className="text-[9px] mt-[3px] text-[#555]">Unit 1, Ground Floor</div>
                <div className="text-[9px] text-[#555]">123 Main St, BGC, Taguig</div>
                <div className="text-[9px] text-[#555]">Tel: (02) 8888-8888</div>
              </div>
            )}

            {/* 2. BIR Info */}
            {settings.showBIRInfo && (
              <>
                <div className="border-y-2 border-[#222] py-1 text-center mb-2">
                  <strong className="text-[10px] tracking-wider">OFFICIAL RECEIPT</strong>
                </div>
                <div className="text-[9px] mb-1.5 leading-relaxed">
                  <div>ATP No  : ATP-2024-00-00000</div>
                  <div>ATP Date: Jan 01, 2024</div>
                  <div>COR No  : COR-2024-00-00000</div>
                  <div>Serial  : ERL-2024-00001</div>
                  <div>PTU No  : PTU-2024-00-00000</div>
                  <div>Machine : POS-01</div>
                  <div>Accr No : ACC-2024-0001</div>
                </div>
                <div className="border-t border-dashed border-[#aaa] mb-1.5" />
              </>
            )}

            {/* 3. Transaction Info */}
            <div className="text-[10px] mb-1.5">
              <div>Date: {dateStr}</div>
              <div>Time: {timeStr}</div>
              <div>Slip No: {order.id}</div>
              <div>Server : {order.staff.name}</div>
              <div>Type   : {order.type === "dine-in" ? `DINE-IN${order.customerName ? ` / ${order.customerName}` : ""}` : "TAKEOUT"}</div>
            </div>

            <div className="border-t border-dashed border-[#aaa] mb-1.5" />

            {/* 4. Line Items */}
            <div className="border-y border-dashed border-[#aaa] py-1 mb-1.5">
              <div className="flex text-[9px] text-[#555]">
                <span className="flex-1">QTY&nbsp; ITEM</span>
                <span>AMOUNT</span>
              </div>
            </div>

            <div className="mb-1.5">
              {order.items.map((ci, idx) => (
                <div key={ci.item.id + '-' + idx} className="mb-[5px]">
                  <div className="flex justify-between">
                    <div className="flex-1 pr-2">
                      <span className="font-bold">{ci.qty}×</span> {ci.item.name}
                    </div>
                    <div className="font-bold whitespace-nowrap">
                      {formatCurrency(ci.item.price * ci.qty)}
                    </div>
                  </div>
                  {ci.qty > 1 && (
                    <div className="text-[9px] text-[#888] pl-5">
                      @ {formatCurrency(ci.item.price)} ea
                    </div>
                  )}
                  {ci.modifiers && ci.modifiers.length > 0 && ci.modifiers.map((m, mi) => (
                    <div key={mi} className="text-[9px] text-[#666] pl-5">
                      + {m.name}{m.price > 0 ? ` (${formatCurrency(m.price)})` : ''}
                    </div>
                  ))}
                  {ci.notes && (
                    <div className="text-[9px] text-[#777] pl-5 italic">
                      Note: {ci.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-[#aaa] mb-1.5" />

            {/* 5. Totals */}
            <div className="text-[10px] mb-1">
              <div className="flex justify-between">
                <span>Subtotal:</span><span>{formatCurrency(order.subtotal)}</span>
              </div>
            </div>

            <div className="border-y-2 border-[#222] py-[5px] mb-1.5">
              <div className="flex justify-between font-bold text-[13px]">
                <span>TOTAL DUE</span><span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {/* 6. Payment */}
            <div className="text-[10px] mb-1.5">
              <div>Payment : {payLabel}</div>
              {order.payMethod === "ewallet" && order.referenceNumber && (
                <div>Ref No  : {order.referenceNumber}</div>
              )}
              {order.payMethod === "cash" && order.cashTendered && (
                <>
                  <div>Tendered: {formatCurrency(order.cashTendered)}</div>
                  <div>Change  : {formatCurrency(order.cashTendered - order.total)}</div>
                </>
              )}
            </div>

            {/* 7. QR Code (optional) */}
            {settings.showQRCode && (
              <>
                <div className="border-t border-dashed border-[#aaa] mb-1.5" />
                <div className="text-center py-2 text-[#555]">
                  <div className="text-[10px] tracking-wide">[ QR CODE ]</div>
                  <div className="text-[9px] text-[#888]">Scan to Pay</div>
                </div>
              </>
            )}

            {/* 8. Footer */}
            {settings.showCustomerCopy && (
              <div className="border-t border-dashed border-[#aaa] pt-2 text-center text-[10px]">
                <div className="mb-0.5">Thank you for dining with us!</div>
                <div className="mb-2">Please come again!</div>
                <div className="text-[8px] text-[#aaa] mb-0.5">** CUSTOMER COPY **</div>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="bg-erl-sidebar px-5 py-3.5 border-t border-erl-border-default flex gap-2.5 justify-end flex-shrink-0">
          <button className="btn btn-outline text-[10px] px-4.5 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent text-[10px] px-4.5 py-2"
            onClick={handlePrint}
          >
            🖨 Print ({settings.printCopies})
          </button>
        </div>
      </div>
    </div>
  );
};
