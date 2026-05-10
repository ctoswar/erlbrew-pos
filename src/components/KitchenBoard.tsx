import React, { useState } from "react";
import { Order, OrderStatus } from "../types";
import { formatTime, formatCurrency } from "../utils";
import { VoidCredentialModal } from "./VoidCredentialModal";

interface Props {
  orders: Order[];
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  onVoidOrder: (id: string) => void;
  onRefundOrder?: (id: string) => void;
}

const COLUMNS: { status: OrderStatus; label: string; color: string }[] = [
  { status: "pending", label: "Pending", color: "#888" },
  { status: "preparing", label: "Preparing", color: "#e8a020" },
  { status: "ready", label: "Ready to Serve", color: "var(--success)" },
  { status: "completed", label: "Completed", color: "var(--gold)" },
];

export const KitchenBoard: React.FC<Props> = ({ orders, onUpdateStatus, onVoidOrder, onRefundOrder }) => {
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<string | null>(null);

  const handleVoidSuccess = () => {
    if (voidTarget) {
      onVoidOrder(voidTarget);
      setVoidTarget(null);
    }
  };

  const handleRefundSuccess = () => {
    if (refundTarget && onRefundOrder) {
      onRefundOrder(refundTarget);
      setRefundTarget(null);
    }
  };

  return (
    <div style={{ display: "flex", gap: 12, padding: "1rem", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) => o.status === col.status);
        return (
          <div key={col.status} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            {/* Column header */}
            <div className="card-glass" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexShrink: 0, padding: "8px 12px", borderRadius: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color, boxShadow: `0 0 5px ${col.color}44` }} />
              <div style={{ fontSize: 8.5, color: col.color, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>{col.label}</div>
              <div style={{ fontSize: 8, color: "var(--text-disabled)", marginLeft: "auto", background: "var(--bg-surface)", borderRadius: 10, padding: "0 7px", lineHeight: "18px", fontWeight: 700 }}>{colOrders.length}</div>
            </div>

            {/* Orders */}
            <div className="scroll-area" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minHeight: 0 }}>
              {colOrders.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-disabled)", fontSize: 9, letterSpacing: 1 }}>Empty</div>
              )}
              {colOrders.map((order) => (
                <KitchenCard key={order.id} order={order} colColor={col.color}
                  onUpdateStatus={onUpdateStatus}
                  isVoidPending={voidTarget === order.id} onRequestVoid={() => setVoidTarget(order.id)}
                  isRefundPending={refundTarget === order.id} onRequestRefund={() => setRefundTarget(order.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {voidTarget && (
        <VoidCredentialModal
          orderId={voidTarget}
          onCancel={() => setVoidTarget(null)}
          onVoidSuccess={handleVoidSuccess}
          action="void"
        />
      )}
      {refundTarget && (
        <VoidCredentialModal
          orderId={refundTarget}
          onCancel={() => setRefundTarget(null)}
          onVoidSuccess={handleRefundSuccess}
          action="refund"
        />
      )}
    </div>
  );
};

/* ── Kitchen Card ─────────────────────────────────────────────────────────── */

interface KitchenCardProps {
  order: Order;
  colColor: string;
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  isVoidPending: boolean;
  onRequestVoid: () => void;
  isRefundPending?: boolean;
  onRequestRefund?: () => void;
}

const KitchenCard: React.FC<KitchenCardProps> = ({ order, colColor, onUpdateStatus, isVoidPending, onRequestVoid, isRefundPending, onRequestRefund }) => {
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
  const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 60000);
  const isLate = order.status === "preparing" && elapsed >= 10;

  return (
    <div className="animate-scaleIn" style={{
      background: "var(--bg-surface)", border: `1.5px solid ${isLate ? "var(--danger-border)" : "var(--border-subtle)"}`,
      borderRadius: 12, padding: 12, borderLeft: `3px solid ${isLate ? "var(--danger)" : colColor}`,
      transition: "var(--transition-fast)",
    }}>
      {/* Top row: ID + time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 0.5 }}>
          {order.id.slice(0, 8).toUpperCase()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {isLate && <span className="pill pill-danger animate-pulse" style={{ fontSize: 7, padding: "2px 6px" }}>Late</span>}
          <div style={{ fontSize: 7.5, color: "var(--text-disabled)", letterSpacing: 1 }}>{formatTime(order.createdAt)}</div>
        </div>
      </div>

      {/* Meta pills */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="pill pill-gold" style={{ fontSize: 7.5, padding: "3px 8px" }}>
          {order.type === "dine-in" ? (order.customerName || "Dine-in") : "Takeout"}
        </span>
        <span className="pill pill-muted" style={{ fontSize: 7.5, padding: "3px 8px" }}>
          {order.staff.name.split(" ")[0]}
        </span>
        <span className="pill pill-muted" style={{ marginLeft: "auto", fontSize: 7.5, padding: "3px 8px" }}>
          {formatCurrency(order.total)}
        </span>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 8 }}>
        {order.items.map((ci) => (
          <div key={ci.item.id} style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2, display: "flex", gap: 5 }}>
            <span style={{ color: "var(--gold)", fontWeight: 600 }}>{ci.qty}×</span>
            {ci.item.name}
            {ci.modifiers && ci.modifiers.length > 0 && (
              <span style={{ color: "var(--gold-dim)", fontSize: 8.5 }}>({ci.modifiers.map((m) => m.name).join(", ")})</span>
            )}
            {ci.notes && <span style={{ color: "var(--gold-dim)", fontStyle: "italic", fontSize: 8.5 }}>— {ci.notes}</span>}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4 }}>
        {order.status === "preparing" && (
          <>
            <button className="btn btn-success" onClick={() => onUpdateStatus(order.id, "ready")} style={{ flex: 1, padding: "6px 0", fontSize: 7.5, borderRadius: 7 }}>Mark Ready ✓</button>
            {isVoidPending ? (
              <button disabled style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--bg-base)", color: "var(--gold)", fontSize: 7.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Auth…</button>
            ) : (
              <button onClick={onRequestVoid} className="btn-danger" style={{ fontSize: 7.5, padding: "6px 10px", borderRadius: 7 }}>&#x2715; Void</button>
            )}
          </>
        )}
        {order.status === "pending" && (
          <>
            <button onClick={() => onUpdateStatus(order.id, "preparing")} className="btn btn-gold" style={{ flex: 1, padding: "6px 0", fontSize: 7.5, borderRadius: 7 }}>Start</button>
            {isVoidPending ? (
              <button disabled style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--bg-base)", color: "var(--gold)", fontSize: 7.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Auth…</button>
            ) : (
              <button onClick={onRequestVoid} className="btn-danger" style={{ fontSize: 7.5, padding: "6px 10px", borderRadius: 7 }}>&#x2715; Void</button>
            )}
          </>
        )}
        {order.status === "ready" && (
          <button className="btn btn-gold" onClick={() => onUpdateStatus(order.id, "completed")} style={{ flex: 1, padding: "6px 0", fontSize: 7.5, borderRadius: 7 }}>Serve ✓</button>
        )}
        {order.status === "completed" && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, textAlign: "center", fontSize: 8, color: "var(--text-disabled)", letterSpacing: 1, padding: "6px 0" }}>
              {order.completedAt ? `Done ${formatTime(order.completedAt)}` : "Completed"}
            </div>
            {isRefundPending ? (
              <button disabled style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--bg-base)", color: "var(--danger)", fontSize: 7.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Auth…</button>
            ) : onRequestRefund ? (
              <button onClick={onRequestRefund} className="btn-danger" style={{ fontSize: 7.5, padding: "6px 10px", borderRadius: 7 }}>&#x21A9; Refund</button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};