import React, { useEffect } from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";

interface Props {
  order: Order;
  onDone: () => void;
}

export const SuccessScreen: React.FC<Props> = ({ order, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

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
        <button className="btn btn-outline" onClick={onDone} style={{ marginTop: 24, fontSize: 10, padding: "9px 20px" }}>
          New Order
        </button>
      </div>
    </div>
  );
};
