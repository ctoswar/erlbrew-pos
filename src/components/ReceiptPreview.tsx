import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Order } from "../types";
import { formatCurrency } from "../utils";
import { loadPrintSettings, PrintSettings } from "./AdminPrintSettings";
import { openPrintWindow, printViaBluetooth, getStoreInfo } from "../utils/receiptUtils";

interface Props {
  order: Order;
  onClose: () => void;
}

export const ReceiptPreview: React.FC<Props> = ({ order, onClose }) => {
  const [settings] = useState<PrintSettings>(loadPrintSettings());
  const [printError, setPrintError] = useState("");

  const STORE = getStoreInfo();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const payLabel = order.payMethod === "cash" ? "CASH" : order.payMethod === "card" ? "CARD" : "E-WALLET";

  const handlePrint = async () => {
    setPrintError("");
    const discountAmount = order.discount?.amount;
    const discountLabel = order.discount?.label;
    if (settings.printVia === "bluetooth") {
      try {
        await printViaBluetooth(order, settings, discountAmount, discountLabel);
        onClose();
      } catch (e: any) {
        const msg = e?.message || e?.reason?.message || String(e);
        setPrintError(`Print failed: ${msg}. Make sure the print server is running.`);
      }
    } else {
      openPrintWindow(order, settings, discountAmount, discountLabel);
      onClose();
    }
  };

  const PAPER_WIDTH = settings.paperSize === "58mm" ? 240 : 280;

  // Resolve store address: use company_address, splitting on commas if long
  const addressLines = STORE.addr1
    ? STORE.addr1.length > 30
      ? [STORE.addr1.substring(0, STORE.addr1.lastIndexOf(',', 30)).trim(), STORE.addr1.substring(STORE.addr1.lastIndexOf(',', 30) + 1).trim()]
      : [STORE.addr1]
    : [];

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card-glass overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[92vh] min-w-0 w-full max-w-[420px]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-erl-border-subtle flex-shrink-0">
          <div>
            <div className="font-display text-[14px] font-bold text-erl-text-primary">
              Receipt Preview
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
                {addressLines.map((line, i) => (
                  <div key={i} className="text-[9px] mt-[2px] text-[#555]">{line}</div>
                ))}
                {STORE.tel && <div className="text-[9px] text-[#555]">Tel: {STORE.tel}</div>}
              </div>
            )}

            {/* 2. BIR Info */}
            {settings.showBIRInfo && (
              <>
                <div className="border-y-2 border-[#222] py-1 text-center mb-2">
                  <strong className="text-[10px] tracking-wider">ACKNOWLEDGMENT RECEIPT</strong>
                </div>
                <div className="text-[9px] mb-1.5 leading-relaxed">
                  <div>ATP No  : {STORE.atpNo}</div>
                  <div>ATP Date: {STORE.atpDate}</div>
                  <div>COR No  : {STORE.birCorNo}</div>
                  <div>Serial  : {STORE.serial}</div>
                  <div>PTU No  : {STORE.ptuNo}</div>
                  <div>Machine : {STORE.machineNo}</div>
                  <div>Accr No : {STORE.posAccNo}</div>
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
              {order.items.map((ci, idx) => {
                const modifierTotal = (ci.modifiers || []).reduce((s, m) => s + m.price, 0);
                const lineTotal = (ci.item.price + modifierTotal) * ci.qty;
                return (
                  <div key={ci.item.id + '-' + idx} className="mb-[5px]">
                    <div className="flex justify-between">
                      <div className="flex-1 pr-2">
                        <span className="font-bold">{ci.qty}×</span> {ci.item.name}
                      </div>
                      <div className="font-bold whitespace-nowrap">
                        {formatCurrency(lineTotal)}
                      </div>
                    </div>
                    {ci.qty > 1 && (
                      <div className="text-[9px] text-[#888] pl-5">
                        @ {formatCurrency(ci.item.price + modifierTotal)} ea
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
                );
              })}
            </div>

            <div className="border-t border-dashed border-[#aaa] mb-1.5" />

            {/* 5. Totals */}
            <div className="text-[10px] mb-1">
              <div className="flex justify-between">
                <span>Subtotal:</span><span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount && order.discount.amount > 0 && (
                <div className="flex justify-between text-[#c97a7a]">
                  <span>{order.discount.label}:</span><span>-{formatCurrency(order.discount.amount)}</span>
                </div>
              )}
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

            {/* 7. WiFi Info (optional) */}
            {settings.showWifiInfo && (
              <>
                <div className="border-t border-dashed border-[#aaa] mb-1.5" />
                <div className="text-center py-1">
                  <div className="text-[10px] font-bold tracking-wide mb-1">Wi-Fi</div>
                  {settings.wifiAsQR && settings.wifiSsid ? (
                    <>
                      <QRCodeSVG
                        value={`WIFI:T:WPA;S:${settings.wifiSsid};P:${settings.wifiPassword};;`}
                        size={100}
                        level="M"
                        includeMargin={false}
                        style={{ margin: "0 auto" }}
                      />
                      <div className="text-[8px] text-[#888] mt-1">Scan to join Wi-Fi</div>
                    </>
                  ) : (
                    <div className="text-[10px] leading-relaxed">
                      <div>Network: {settings.wifiSsid}</div>
                      <div>Password: {settings.wifiPassword}</div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 8. QR Code (optional) */}
            {settings.showQRCode && (
              <>
                <div className="border-t border-dashed border-[#aaa] mb-1.5" />
                <div className="text-center py-2 text-[#555]">
                  {settings.qrCodeUrl ? (
                    <>
                      <QRCodeSVG value={settings.qrCodeUrl} size={120} level="M" includeMargin={false} style={{ margin: "0 auto" }} />
                      <div className="text-[9px] text-[#888] mt-1">Scan for more info</div>
                    </>
                  ) : (
                    <>
                      <div className="text-[10px] tracking-wide">[ QR CODE ]</div>
                      <div className="text-[9px] text-[#888]">Set a URL in Print Settings</div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* 9. Footer */}
            {settings.showCustomerCopy && (
              <div className="border-t border-dashed border-[#aaa] pt-2 text-center text-[10px]">
                <div className="mb-0.5">Thank you for dining with us!</div>
                <div className="mb-2">Please come again!</div>
                <div className="text-[8px] text-[#aaa] mb-0.5">** CUSTOMER COPY **</div>
              </div>
            )}
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