import React, { useState, useEffect, useRef } from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";
import { ReceiptPreview } from "./ReceiptPreview";
import { openCashDrawer } from "../utils/receiptUtils";

interface Props {
  order: Order;
  onDone: () => void;
}

const AUTO_CLOSE_DELAY = 15000;

export const SuccessScreen: React.FC<Props> = ({ order, onDone }) => {
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
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
      <div className="animate-successPop" style={{ textAlign: "center", padding: "0 1rem" }}>
        {/* Checkmark */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(122,201,122,0.15), rgba(122,201,122,0.05))",
          border: "2px solid rgba(122,201,122,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px", fontSize: 32, color: "var(--success)",
          boxShadow: "0 0 40px rgba(122,201,122,0.12)",
        }}>&#x2713;</div>

        <div className="font-display" style={{ fontSize: 26, color: "var(--success)", marginBottom: 6, letterSpacing: 1 }}>Order Placed!</div>

        {/* Order ID */}
        <div className="card-glass animate-scaleIn" style={{ display: "inline-block", padding: "8px 22px", borderRadius: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)", letterSpacing: 2, fontFamily: "'Courier New', monospace" }}>
            {order.id}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--gold-dim)", marginBottom: 6, letterSpacing: 1 }}>
          {order.type === "dine-in" ? (order.customerName || "Dine-in") : "Takeout"} &middot; {formatCurrency(order.total)}
        </div>

        <div style={{ fontSize: 10, color: "var(--text-disabled)", letterSpacing: 2, marginBottom: 2 }}>Sent to kitchen…</div>
        <div style={{ marginTop: 8, fontSize: 9, color: "var(--text-faint)" }}>Auto-return in {countdown}s</div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button className="btn btn-gold" onClick={() => setShowPreview(true)} style={{ fontSize: 9, padding: "9px 18px" }}>&#x1F5A8; Print Receipt</button>
          <button className="btn btn-outline" onClick={handlePrintAndDone} style={{ fontSize: 9, padding: "9px 18px" }}>Print &amp; Done</button>
          <button className="btn btn-outline" onClick={onDone} style={{ fontSize: 9, padding: "9px 18px" }}>New Order</button>
        </div>
      </div>

      {showPreview && <ReceiptPreview order={order} onClose={() => setShowPreview(false)} />}
    </div>
  );
};