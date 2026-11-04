import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Order } from "../types";
import { formatCurrency } from "../utils";
import { loadPrintSettings, PrintSettings } from "./AdminPrintSettings";
import { openPrintWindow, printViaBluetooth, getStoreInfo, parseSplitPayment, getCashDue, getPaymentLabel } from "../utils/receiptUtils";

interface Props {
  order: Order;
  onClose: () => void;
}

// CSS custom property for the row-reveal stagger (--i). Strictly typed so the
// numeric custom property passes tsc without `any`.
type RevealStyle = React.CSSProperties & { "--i": number };
const reveal = (i: number): RevealStyle => ({ "--i": i });

export const ReceiptPreview: React.FC<Props> = ({ order, onClose }) => {
  const [settings] = useState<PrintSettings>(loadPrintSettings());
  const [printError, setPrintError] = useState("");
  // Drives the "feeding the receipt into the printer" animation on Print click
  const [printing, setPrinting] = useState(false);

  const STORE = getStoreInfo();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const payLabel = getPaymentLabel(order);
  const split = parseSplitPayment(order);
  const cashDue = getCashDue(order);

  const FEED_MS = 1050; // keep in sync with the receipt-feed keyframes in global.css

  const handlePrint = async () => {
    if (printing) return;
    setPrintError("");
    setPrinting(true);
    const discountAmount = order.discount?.amount;
    const discountLabel = order.discount?.label;
    try {
      if (settings.printVia === "bluetooth") {
        // Print request and feed animation run in parallel (~1.05s each) so the
        // real print isn't slowed down by the animation — whichever finishes
        // first just has to wait for the other.
        const [feed] = await Promise.all([
          new Promise((r) => setTimeout(r, FEED_MS)),
          printViaBluetooth(order, settings, discountAmount, discountLabel),
        ]);
        void feed;
        onClose(); // fresh unmount next open → replay any animation
      } else {
        await new Promise((r) => setTimeout(r, FEED_MS));
        openPrintWindow(order, settings, discountAmount, discountLabel);
        onClose();
      }
    } catch (e: unknown) {
      const err = e as { message?: string; reason?: { message?: string } };
      const msg = err?.message || err?.reason?.message || String(e);
      setPrintError(`Print failed: ${msg}. Make sure the print server is running.`);
      setPrinting(false); // let the cashier retry without reloading
    }
  };

  // Pixel widths matching the print output at Courier New 11px
  const PAPER_WIDTH = settings.paperSize === "57mm" ? 216 : settings.paperSize === "58mm" ? 226 : 302;
  // Make the WiFi join QR a bit larger on narrow 57mm paper so it's easier to scan
  const WIFI_QR_SIZE = settings.paperSize === "57mm" ? 120 : 100;

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
          <div className={"receipt-slot-scene" + (printing ? " receipt-feeding" : "")} style={{ width: PAPER_WIDTH }}>
            {/* Decorative printer slot — screen only, hidden in print output */}
            <div className="receipt-slot" aria-hidden="true" />
            {/* Clip container: paper hides here before sliding out of the slot */}
            <div className="receipt-slot-paper">
              <div
                className="receipt-print-target receipt-anim-paper receipt-torn"
                style={{
                  background: "#fff",
                  width: PAPER_WIDTH,
                  padding: "20px 16px",
                  borderRadius: 2,
                  fontFamily: "'Courier New', monospace",
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: "#111",
                }}
              >
            {/* 1. Store Header */}
            {settings.showStoreHeader && (
              <div className="receipt-reveal text-center mb-2" style={reveal(0)}>
                {STORE.logo && <div className="mb-1"><img src={STORE.logo} alt="Logo" style={{ maxHeight: 48, margin: '0 auto' }} /></div>}
                <div className="text-[15px] font-bold tracking-wide">{STORE.name}</div>
                {addressLines.map((line, i) => (
                  <div key={i} className="text-[9px] mt-[2px] text-[#555]">{line}</div>
                ))}
                {STORE.tel && <div className="text-[9px] text-[#555]">Tel: {STORE.tel}</div>}
              </div>
            )}
            {settings.showStoreHeader && (
              <div className="receipt-reveal border-y-2 border-[#222] py-1 text-center mb-2" style={reveal(1)}>
                <strong className="text-[10px] tracking-wider">ACKNOWLEDGMENT RECEIPT</strong>
              </div>
            )}

            {/* 2. BIR Info */}
            {settings.showBIRInfo && (
              <>
                <div className="receipt-reveal text-[9px] mb-1.5 leading-relaxed" style={reveal(2)}>
                  <div>TIN     : {STORE.tin}</div>
                  <div>ATP No  : {STORE.atpNo}</div>
                  <div>ATP Date: {STORE.atpDate}</div>
                  <div>COR No  : {STORE.birCorNo}</div>
                  <div>Serial  : {STORE.serial}</div>
                  <div>PTU No  : {STORE.ptuNo}</div>
                  <div>Machine : {STORE.machineNo}</div>
                  <div>Accr No : {STORE.posAccNo}</div>
                </div>
                <div className="receipt-reveal border-t border-dashed border-[#aaa] mb-1.5" style={reveal(3)} />
              </>
            )}

            {/* 3. Transaction Info */}
            <div className="receipt-reveal text-[10px] mb-1.5" style={reveal(4)}>
              <div>Date: {dateStr}</div>
              <div>Time: {timeStr}</div>
              <div>Slip No: {order.id}</div>
              <div>Server : {order.staff.name}</div>
              <div>Type   : {order.type === "dine-in" ? `DINE-IN${order.customerName ? ` / ${order.customerName}` : ""}` : "TAKEOUT"}</div>
            </div>

            <div className="receipt-reveal border-t border-dashed border-[#aaa] mb-1.5" style={reveal(5)} />

            {/* 4. Line Items */}
            <div className="receipt-reveal border-y border-dashed border-[#aaa] py-1 mb-1.5" style={reveal(6)}>
              <div className="flex text-[9px] text-[#555]">
                <span className="flex-1">QTY&nbsp; ITEM</span>
                <span>AMOUNT</span>
              </div>
            </div>

            <div className="receipt-reveal mb-1.5" style={reveal(7)}>
              {order.items.map((ci, idx) => {
                const modifierTotal = (ci.modifiers || []).reduce((s, m) => s + m.price * (m.qty || 1), 0);
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
                        + {(m.qty || 1) > 1 ? `${m.qty}× ` : ''}{m.name}{m.price > 0 ? ` (${formatCurrency(m.price * (m.qty || 1))})` : ''}
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

            <div className="receipt-reveal border-t border-dashed border-[#aaa] mb-1.5" style={reveal(8)} />

            {/* 5. Totals */}
            <div className="receipt-reveal text-[10px] mb-1" style={reveal(9)}>
              <div className="flex justify-between">
                <span>Subtotal:</span><span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount && order.discount.amount > 0 && (
                <div className="flex justify-between text-[#c97a7a]">
                  <span>{order.discount.label}:</span><span>-{formatCurrency(order.discount.amount)}</span>
                </div>
              )}
            </div>

            <div className="receipt-reveal border-y-2 border-[#222] py-[5px] mb-1.5" style={reveal(10)}>
              <div className="flex justify-between font-bold text-[13px]">
                <span>TOTAL DUE</span><span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {/* 6. Payment */}
            <div className="receipt-reveal text-[10px] mb-1.5" style={reveal(11)}>
              <div>Payment : {payLabel}</div>
              {split && (
                <>
                  <div>E-Wallet: {formatCurrency(split.ewalletAmount)}</div>
                  <div>Ref No  : {split.reference}</div>
                  <div>Cash due: {formatCurrency(cashDue)}</div>
                </>
              )}
              {!split && order.payMethod === "ewallet" && order.referenceNumber && (
                <div>Ref No  : {order.referenceNumber}</div>
              )}
              {order.payMethod === "cash" && order.cashTendered && (
                <>
                  <div>Tendered: {formatCurrency(order.cashTendered)}</div>
                  <div>Change  : {formatCurrency(order.cashTendered - cashDue)}</div>
                </>
              )}
            </div>

            {/* 7. WiFi Info (optional) */}
            {settings.showWifiInfo && (
              <>
                <div className="receipt-reveal border-t border-dashed border-[#aaa] mb-1.5" style={reveal(12)} />
                <div className="receipt-reveal text-center py-1" style={reveal(13)}>
                  <div className="text-[10px] font-bold tracking-wide mb-1">Wi-Fi</div>
                  {settings.wifiAsQR && settings.wifiSsid ? (
                    <>
                      <QRCodeSVG
                        value={`WIFI:T:WPA;S:${settings.wifiSsid};P:${settings.wifiPassword};;`}
                        size={WIFI_QR_SIZE}
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
                <div className="receipt-reveal border-t border-dashed border-[#aaa] mb-1.5" style={reveal(14)} />
                <div className="receipt-reveal text-center py-2 text-[#555]" style={reveal(15)}>
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
              <div className="receipt-reveal border-t border-dashed border-[#aaa] pt-2 text-center text-[10px]" style={reveal(16)}>
                <div className="mb-0.5">Thank you for dining with us!</div>
                <div className="mb-2">Please come again!</div>
                <div className="text-[8px] text-[#aaa] mb-0.5">** CUSTOMER COPY **</div>
              </div>
            )}
              </div>
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
          <button className="btn btn-outline flex-1 text-[12px] py-2.5" onClick={onClose} disabled={printing}>
            Cancel
          </button>
          <button
            className="btn btn-accent flex-1 text-[12px] py-2.5"
            onClick={handlePrint}
            disabled={printing}
          >
            {printing ? "🖨 Printing…" : `🖨 Print (${settings.printCopies})`}
          </button>
        </div>
      </div>
    </div>
  );
};