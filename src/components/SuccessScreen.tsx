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
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
      }}
    >
      <div className="animate-successPop" style={{ textAlign: "center" }}>
        {/* Success checkmark */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(122,201,122,0.15), rgba(122,201,122,0.05))",
            border: "2px solid rgba(122,201,122,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: 36,
            color: "var(--success)",
            boxShadow: "0 0 40px rgba(122,201,122,0.15)",
          }}
        >
          &#x2713;
        </div>

        <div
          className="font-display"
          style={{ fontSize: 30, color: "var(--success)", marginBottom: 8, letterSpacing: 1 }}
        >
          Order Placed!
        </div>

        {/* Order ID card */}
        <div
          className="card-glass animate-scaleIn"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            borderRadius: 12,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--gold)",
              letterSpacing: 2,
              fontFamily: "'Courier New', monospace",
            }}
          >
            {order.id}
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: "var(--gold-dim)",
            marginBottom: 8,
            letterSpacing: 1,
          }}
        >
          {order.type === "dine-in" ? `Table ${order.table}` : "Takeout"} &middot;{" "}
          {formatCurrency(order.total)}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--text-disabled)",
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          Sent to kitchen&hellip;
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: "var(--text-faint)" }}>
          Auto-return in {countdown}s
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          <button
            className="btn btn-gold"
            onClick={() => setShowPreview(true)}
            style={{ fontSize: 10, padding: "10px 22px" }}
          >
            &#x1F5A8; Print Receipt
          </button>
          <button
            className="btn btn-outline"
            onClick={handlePrintAndDone}
            style={{ fontSize: 10, padding: "10px 22px" }}
          >
            Print &amp; Done
          </button>
          <button
            className="btn btn-outline"
            onClick={onDone}
            style={{ fontSize: 10, padding: "10px 22px" }}
          >
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