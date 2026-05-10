import React, { useState } from "react";
import { Order, OrderStatus } from "../types";
import { formatTime, formatCurrency } from "../utils";
import { VoidCredentialModal } from "./VoidCredentialModal";

interface Props {
  orders: Order[];
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  onVoidOrder: (id: string) => void;
}

const COLUMNS: { status: OrderStatus; label: string; color: string }[] = [
  { status: "pending", label: "Pending", color: "#888" },
  { status: "preparing", label: "Preparing", color: "#e8a020" },
  { status: "ready", label: "Ready to Serve", color: "var(--success)" },
  { status: "completed", label: "Completed", color: "var(--gold)" },
];

export const KitchenBoard: React.FC<Props> = ({ orders, onUpdateStatus, onVoidOrder }) => {
  const [voidTarget, setVoidTarget] = useState<string | null>(null);

  const handleVoidSuccess = () => {
    if (voidTarget) {
      onVoidOrder(voidTarget);
      setVoidTarget(null);
    }
  };

  return (
    <div style={{ display: "flex", gap: 16, padding: "1.2rem", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) => o.status === col.status);
        return (
          <div
            key={col.status}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {/* Column header */}
            <div
              className="card-glass"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                flexShrink: 0,
                padding: "10px 14px",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: col.color,
                  boxShadow: `0 0 6px ${col.color}44`,
                }}
              />
              <div
                style={{
                  fontSize: 9,
                  color: col.color,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                {col.label}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "var(--text-disabled)",
                  marginLeft: "auto",
                  background: "var(--bg-surface)",
                  borderRadius: "50%",
                  width: 22,
                  height: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                {colOrders.length}
              </div>
            </div>

            {/* Orders */}
            <div
              className="scroll-area"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                overflowY: "auto",
                minHeight: 0,
              }}
            >
              {colOrders.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2.5rem 0",
                    color: "var(--text-disabled)",
                    fontSize: 10,
                    letterSpacing: 1,
                  }}
                >
                  Empty
                </div>
              )}
              {colOrders.map((order) => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  colColor={col.color}
                  onUpdateStatus={onUpdateStatus}
                  isVoidPending={voidTarget === order.id}
                  onRequestVoid={() => setVoidTarget(order.id)}
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
}

const KitchenCard: React.FC<KitchenCardProps> = ({
  order,
  colColor,
  onUpdateStatus,
  isVoidPending,
  onRequestVoid,
}) => {
  const createdAt =
    order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
  const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 60000);
  const isLate = order.status === "preparing" && elapsed >= 10;

  return (
    <div
      className="animate-scaleIn card-glass"
      style={{
        padding: 14,
        borderRadius: 12,
        borderLeft: `3px solid ${isLate ? "var(--danger)" : colColor}`,
      }}
    >
      {/* Top row: ID + time */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div
          className="font-display"
          style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}
        >
          {order.id.slice(0, 8).toUpperCase()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isLate && (
            <span className="pill pill-danger animate-pulse">Late</span>
          )}
          <div style={{ fontSize: 8, color: "var(--text-disabled)", letterSpacing: 1 }}>
            {formatTime(order.createdAt)}
          </div>
        </div>
      </div>

      {/* Meta pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <span className="pill pill-gold">
          {order.type === "dine-in" ? order.table : "Takeout"}
        </span>
        <span className="pill pill-muted">
          {order.staff.name.split(" ")[0]}
        </span>
        <span className="pill pill-muted" style={{ marginLeft: "auto" }}>
          {formatCurrency(order.total)}
        </span>
      </div>

      {/* Items */}
      {order.items.map((ci) => (
        <div
          key={ci.item.id}
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 3,
            display: "flex",
            gap: 6,
          }}
        >
          <span style={{ color: "var(--gold)", fontWeight: 700 }}>{ci.qty}×</span>
          {ci.item.name}
          {ci.modifiers && ci.modifiers.length > 0 && (
            <span style={{ color: "var(--gold-dim)", fontSize: 9.5 }}>
              ({ci.modifiers.map((m) => m.name).join(", ")})
            </span>
          )}
          {ci.notes && (
            <span style={{ color: "var(--gold-dim)", fontStyle: "italic" }}>
              {"—"} {ci.notes}
            </span>
          )}
        </div>
      ))}

      {/* Actions */}
      <div style={{ marginTop: 10, display: "flex", gap: 5 }}>
        {order.status === "preparing" && (
          <>
            <button
              className="btn btn-success"
              onClick={() => onUpdateStatus(order.id, "ready")}
              style={{ flex: 1, padding: "8px 0", fontSize: 8 }}
            >
              Mark Ready ✓
            </button>
            {isVoidPending ? (
              <button
                disabled
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-base)",
                  color: "var(--gold)",
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Authorizing…
              </button>
            ) : (
              <button onClick={onRequestVoid} className="btn-danger" style={{ fontSize: 8, padding: "8px 10px" }}>
                &#x2715; Void
              </button>
            )}
          </>
        )}
        {order.status === "pending" && (
          <>
            <button
              onClick={() => onUpdateStatus(order.id, "preparing")}
              className="btn btn-gold"
              style={{ flex: 1, padding: "8px 0", fontSize: 8 }}
            >
              Start Preparing
            </button>
            {isVoidPending ? (
              <button
                disabled
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-base)",
                  color: "var(--gold)",
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Authorizing…
              </button>
            ) : (
              <button onClick={onRequestVoid} className="btn-danger" style={{ fontSize: 8, padding: "8px 10px" }}>
                &#x2715; Void
              </button>
            )}
          </>
        )}
        {order.status === "ready" && (
          <button
            className="btn btn-gold"
            onClick={() => onUpdateStatus(order.id, "completed")}
            style={{ flex: 1, padding: "8px 0", fontSize: 8 }}
          >
            Complete &amp; Serve
          </button>
        )}
        {order.status === "completed" && (
          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 9,
              color: "var(--text-disabled)",
              letterSpacing: 1,
              padding: "8px 0",
            }}
          >
            {order.completedAt
              ? `Done at ${formatTime(order.completedAt)}`
              : "Completed"}
          </div>
        )}
      </div>
    </div>
  );
};