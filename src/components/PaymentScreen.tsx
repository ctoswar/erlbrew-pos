import React, { useState } from "react";
import { PayMethod } from "../types";
import { formatCurrency, getQuickCashAmounts } from "../utils";
import { loadPrintSettings } from "./AdminPrintSettings";

interface Props {
  total: number;
  discountLabel?: string;
  discountAmount?: number;
  onBack: () => void;
  onConfirm: (method: PayMethod, cashTendered?: number, referenceNumber?: string) => void;
}

export const PaymentScreen: React.FC<Props> = ({
  total,
  discountLabel,
  discountAmount,
  onBack,
  onConfirm,
}) => {
  const [method, setMethod] = useState<PayMethod>("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [splitEwallet, setSplitEwallet] = useState("");
  const [splitRef, setSplitRef] = useState("");
  const printSettings = loadPrintSettings();

  const cash = parseFloat(cashGiven) || 0;
  const change = cash - total;
  const quickAmounts = getQuickCashAmounts(total);
  const splitEwalletNum = parseFloat(splitEwallet) || 0;
  const splitCashNeeded = total - splitEwalletNum;
  const canConfirm = splitMode
    ? splitEwalletNum > 0 && splitEwalletNum < total && splitRef.trim() !== "" && cashGiven !== "" && parseFloat(cashGiven) >= splitCashNeeded
    : method !== "cash" || (cashGiven !== "" && cash >= total);
  const canConfirmEwallet = method === "ewallet" && referenceNumber.trim() !== "";

  const handleConfirm = () => {
    if (splitMode) {
      onConfirm("cash", parseFloat(cashGiven) || 0, `SPLIT:₱${splitEwalletNum.toFixed(0)}-${splitRef}`);
    } else {
      onConfirm(method, method === "cash" ? cash : undefined, method === "ewallet" ? referenceNumber : undefined);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-erl-base p-3 sm:p-4 md:p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-erl-accent/[0.02] blur-[120px] pointer-events-none" />

      <div className="animate-scale-in card-glass py-6 px-4 sm:py-8 sm:px-7 w-full max-w-[460px] rounded-2xl relative">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="btn-ghost text-xs py-2 px-3 min-h-[44px] text-erl-text-muted rounded-xl hover:bg-white/[0.03] transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-erl-accent/10 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div className="font-display text-xl font-bold text-erl-text-primary tracking-wide">
              Payment
            </div>
          </div>
        </div>

        {/* Amount Due */}
        <div className="text-center mb-7">
          <div className="text-[10px] text-erl-text-muted tracking-[4px] uppercase mb-2 font-bold">Amount Due</div>
          <div className="font-display text-[32px] sm:text-[40px] md:text-[48px] font-bold text-erl-accent tracking-tight leading-none">{formatCurrency(total)}</div>
          {discountLabel && discountAmount && (
            <div className="text-xs text-erl-success mt-2 font-semibold">{discountLabel} (−{formatCurrency(discountAmount)})</div>
          )}
        </div>

        {/* Method Tabs */}
        {!splitMode && (
          <div className="flex gap-2 mb-6">
            {(["cash", "card", "ewallet"] as PayMethod[]).map((m) => (
              <button key={m} onClick={() => { setMethod(m); setCashGiven(""); }}
                className={`flex-1 min-h-[44px] flex items-center justify-center py-3 rounded-2xl border-2 text-[10px] font-bold tracking-[0.12em] uppercase cursor-pointer transition-all duration-250 ease-out ${
                  method === m
                    ? "bg-erl-accent/8 border-erl-accent/30 text-erl-accent shadow-[0_0_16px_rgba(196,149,106,0.08)]"
                    : "bg-transparent border-erl-border-default text-erl-text-faint hover:border-erl-border-medium hover:text-erl-text-secondary hover:bg-erl-accent/[0.02]"
                }`}
              >{m === "cash" ? "💵 Cash" : m === "card" ? "💳 Card" : "📱 E-Wallet"}</button>
            ))}
          </div>
        )}

        {/* Cash Panel */}
        {method === "cash" && (
          <div className="mb-6">
            <div className="text-[10px] text-erl-text-muted tracking-[4px] uppercase mb-3 font-bold">Cash Tendered</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
              {quickAmounts.map((amt) => (
                <button key={amt} onClick={() => setCashGiven(String(amt))}
                  className={`rounded-2xl py-2.5 px-3 min-h-[44px] text-sm font-bold cursor-pointer transition-all duration-200 ease-out ${
                    cashGiven === String(amt)
                      ? "bg-erl-accent border-2 border-erl-accent text-erl-base shadow-[0_2px_10px_rgba(196,149,106,0.3)]"
                      : "bg-erl-surface border-2 border-erl-border-subtle text-erl-text-muted hover:border-erl-border-medium hover:text-erl-text-secondary"
                  }`}
                >{formatCurrency(amt)}</button>
              ))}
            </div>
            <input type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} placeholder="Or enter amount" className="mb-3 min-h-[44px]" />
            {cashGiven && cash >= total && (
              <div className="bg-erl-success/[0.05] border border-erl-success/20 rounded-2xl py-5 px-5 text-center">
                <div className="text-[10px] text-erl-success tracking-[4px] uppercase mb-2 font-bold">Change</div>
                <div className="font-display text-[28px] sm:text-[32px] md:text-[36px] font-bold text-erl-success tracking-tight">{formatCurrency(change)}</div>
              </div>
            )}
            {cashGiven && cash < total && (
              <div className="bg-erl-danger/[0.05] border border-erl-danger/20 rounded-2xl py-4 px-4 text-center">
                <div className="text-sm text-erl-danger font-semibold">Short by {formatCurrency(total - cash)}</div>
              </div>
            )}
          </div>
        )}

        {/* Card Panel */}
        {method === "card" && (
          <div className="text-center py-10 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-erl-accent/[0.05] border border-erl-accent/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">💳</span>
            </div>
            <div className="text-base text-erl-text-primary font-semibold mb-2">Present Card to Terminal</div>
            <div className="text-sm text-erl-text-muted leading-relaxed">Tap, insert, or swipe<br />then confirm below</div>
          </div>
        )}

        {/* E-Wallet Panel */}
        {method === "ewallet" && (
          <div className="mb-6">
            <div className="bg-erl-accent/[0.03] rounded-2xl p-6 mb-4 text-center border border-erl-accent/[0.06]">
              <div className="text-[10px] text-erl-text-muted tracking-[4px] uppercase mb-3 font-bold">GCash Reference</div>
              <div className="inline-flex items-center gap-2 bg-erl-accent/[0.06] border-2 border-dashed border-erl-accent/25 rounded-2xl py-3.5 px-6 mb-3">
                <span className="text-lg sm:text-xl md:text-2xl font-bold text-erl-accent tracking-widest font-mono">{printSettings.gcashNumber || "0917-123-4567"}</span>
                <button onClick={() => navigator.clipboard.writeText("09171234567")}
                  className="bg-transparent border-none cursor-pointer text-erl-accent-muted text-sm py-1 px-2 rounded-xl hover:bg-erl-accent/[0.08] transition-colors">
                  📋
                </button>
              </div>
              <div className="text-xs text-erl-text-muted leading-relaxed">
                Open GCash → <strong className="text-erl-text-primary">Pay Bills → Search "Erlbrew"</strong><br />
                <span className="text-[11px]">Amount: {formatCurrency(total)}</span>
              </div>
            </div>
            <div className="mb-3">
              <div className="text-[10px] text-erl-text-muted tracking-[3px] uppercase mb-2 font-bold">Customer's Reference No.</div>
              <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="e.g. REF-123456789" className="min-h-[44px]" />
            </div>
            <div className="text-xs text-erl-text-muted text-center font-medium">Tap <strong className="text-erl-accent">Confirm & Place Order</strong> once paid</div>
          </div>
        )}

        {/* Split Bill Toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-erl-text-muted justify-center font-medium">
            <input type="checkbox" checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} className="accent-erl-accent w-4 h-4 rounded" />
            Split bill (Cash + E-Wallet)
          </label>
        </div>

        {/* Split Bill Panel */}
        {splitMode && (
          <div className="mb-4 p-5 bg-erl-accent/[0.03] rounded-2xl border border-erl-accent/[0.08]">
            <div className="text-[10px] text-erl-accent tracking-[2px] uppercase font-bold mb-3">Split Payment</div>
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[10px] text-erl-text-faint mb-1.5 font-semibold">E-Wallet Amount</div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-erl-text-muted text-sm pointer-events-none font-semibold">₱</span>
                  <input type="number" value={splitEwallet} onChange={(e) => setSplitEwallet(e.target.value)} placeholder="0.00" min="0" max={total}
                    className="w-full py-3 pl-8 pr-4 min-h-[44px] rounded-2xl border-2 border-erl-border-default bg-erl-surface text-erl-text-primary text-sm focus:border-erl-accent focus:shadow-[0_0_0_3px_rgba(196,149,106,0.1)] transition-all" />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-erl-text-faint mb-1.5 font-semibold">E-Wallet Reference</div>
                <input type="text" value={splitRef} onChange={(e) => setSplitRef(e.target.value)} placeholder="GCash ref number…"
                  className="w-full py-3 px-4 min-h-[44px] rounded-2xl border-2 border-erl-border-default bg-erl-surface text-erl-text-primary text-sm focus:border-erl-accent focus:shadow-[0_0_0_3px_rgba(196,149,106,0.1)] transition-all" />
              </div>
              {splitEwalletNum > 0 && (
                <div className="p-3.5 bg-erl-accent/[0.04] rounded-xl text-xs text-erl-text-muted">
                  <div className="flex justify-between mb-1.5"><span>E-Wallet:</span> <strong className="text-erl-accent">₱{splitEwalletNum.toFixed(2)}</strong></div>
                  <div className="flex justify-between"><span>Cash due:</span> <strong className="text-erl-text-primary">₱{Math.max(0, splitCashNeeded).toFixed(2)}</strong></div>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          className={`btn w-full text-[11px] py-4 min-h-[44px] rounded-2xl tracking-[0.12em] font-bold transition-all duration-300 whitespace-normal break-words leading-tight ${
            canConfirm && (method !== "ewallet" || canConfirmEwallet)
              ? "btn-accent shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              : "bg-erl-border-default text-erl-text-disabled cursor-not-allowed"
          }`}
          onClick={handleConfirm}
          disabled={!canConfirm || (method === "ewallet" && !canConfirmEwallet)}
        >
          {splitMode ? `Split (₱${splitEwalletNum.toFixed(0)} GCash + ₱${Math.max(0, splitCashNeeded).toFixed(0)} Cash)` : "Confirm & Place Order ✓"}
        </button>
        <div className="text-center mt-3">
          <span className="text-[10px] text-erl-text-faint tracking-wide font-medium">
            {method === "cash" ? `Change: ${formatCurrency(change)}` : method === "card" ? "Present card" : "Pay via GCash"}
          </span>
        </div>
      </div>
    </div>
  );
};