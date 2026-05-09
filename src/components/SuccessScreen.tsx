import React, { useState, useEffect, useRef } from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";
import { ReceiptPreview } from "./ReceiptPreview";
import { openCashDrawer } from "../utils/receiptUtils";

interface Props {
  order: Order;
  onDone: () => void;
}

const AUTO_CLOSE_DELAY = 15000; // 15 seconds before auto-return (was 3s)

export const SuccessScreen: React.FC<Props> = ({ order, onDone }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_CLOSE_DELAY / 1000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-close after delay
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
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
      <div className="animate-successPop" style={{ textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--success-bg)", border: "2px solid var(--success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>
          ✓
        </div>
        <div className="font-display" style={{ fontSize: 28, color: "var(--success)", marginBottom: 6 }}>Order Placed!</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>{order.id}</div>
        <div style={{ fontSize: 12, color: "var(--gold-muted)", marginBottom: 8 }}>
          {order.type === "dine-in" ? order.table : "Takeout"} · {formatCurrency(order.total)}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-disabled)", letterSpacing: 2 }}>Sent to kitchen…</div>

        <div style={{ marginTop: 12, fontSize: 10, color: "var(--text-faint)" }}>
          Auto-return in {countdown}s
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
          <button
            className="btn btn-gold"
            onClick={() => setShowPreview(true)}
            style={{ fontSize: 10, padding: "9px 20px" }}
          >
            🖨 Print Receipt
          </button>
          <button
            className="btn btn-outline"
            onClick={handlePrintAndDone}
            style={{ fontSize: 10, padding: "9px 20px" }}
          >
            Print & Done
          </button>
          <button className="btn btn-outline" onClick={onDone} style={{ fontSize: 10, padding: "9px 20px" }}>
            New Order
          </button>
        </div>
      </div>

      {showPreview && (
        <ReceiptPreview order={order} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
};
