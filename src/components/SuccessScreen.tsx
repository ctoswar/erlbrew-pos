import React, { useState, useEffect, useRef } from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";
import { ReceiptPreview } from "./ReceiptPreview";
import { openCashDrawer } from "../utils/receiptUtils";

const AUTO_CLOSE_DELAY = 15000;

interface Props {
  order: Order;
  onDone: () => void;
  onRepeat?: () => void;
}

export const SuccessScreen: React.FC<Props> = ({ order, onDone, onRepeat }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_CLOSE_DELAY / 1000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDone, AUTO_CLOSE_DELAY);
    intervalRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line

  const handlePrintAndDone = () => {
    openCashDrawer().catch(() => {});
    onDone();
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-erl-base relative overflow-hidden">
      {/* Ambient success glow */}
      <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-erl-success/[0.03] blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-erl-accent/[0.02] blur-[100px] pointer-events-none" />

      <div className="animate-success-pop text-center px-6 relative max-w-md mx-auto">
        {/* Success Mark */}
        <div className="relative mx-auto mb-8 w-28 h-28">
          {/* Outer glow ring */}
          <div className="absolute -inset-4 rounded-full bg-erl-success/5 animate-pulse-slow" style={{ boxShadow: '0 0 60px rgba(122,191,122,0.1)' }} />
          {/* Success circle */}
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-erl-success/15 to-erl-success/[0.02] border-2 border-erl-success/25 flex items-center justify-center shadow-[0_0_60px_rgba(122,191,122,0.08)]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-erl-success">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>

        <div className="font-display text-3xl text-erl-success mb-3 tracking-wide font-bold">Order Placed!</div>

        {/* Order ID */}
        <div className="animate-scale-in card-glass inline-block py-4 px-7 rounded-2xl mb-3">
          <div className="text-[10px] text-erl-text-muted tracking-[3px] uppercase mb-1.5 font-bold">Order ID</div>
          <div className="text-xl font-bold text-erl-accent tracking-[0.2em] font-mono">
            {order.id}
          </div>
        </div>

        <div className="text-sm text-erl-accent-dim mb-2 tracking-wide font-semibold">
          {order.type === "dine-in" ? (order.customerName || "Dine-in") : "Takeout"} &middot; {formatCurrency(order.total)}
        </div>

        <div className="text-xs text-erl-text-disabled tracking-[2px] mb-1 font-semibold uppercase">Sent to kitchen…</div>
        <div className="mt-2 text-xs text-erl-text-faint font-medium">Auto-return in {countdown}s</div>

        <div className="flex gap-3 justify-center mt-8 flex-wrap">
          <button className="btn btn-accent text-[10px] py-3 px-5 shadow-lg hover:shadow-xl transition-all rounded-xl tracking-[0.1em]" onClick={() => setShowPreview(true)}>
            🖨 Print Receipt
          </button>
          <button className="btn btn-outline text-[10px] py-3 px-5 rounded-xl tracking-[0.1em]" onClick={handlePrintAndDone}>
            Print & Done
          </button>
          {onRepeat && (
            <button className="btn btn-outline text-[10px] py-3 px-5 rounded-xl tracking-[0.1em]" onClick={onRepeat}>
              🔁 Repeat Order
            </button>
          )}
          <button className="btn btn-outline text-[10px] py-3 px-5 rounded-xl tracking-[0.1em]" onClick={onDone}>
            New Order
          </button>
        </div>
      </div>

      {showPreview && <ReceiptPreview order={order} onClose={() => setShowPreview(false)} />}
    </div>
  );
};