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
    if (voidTarget) { onVoidOrder(voidTarget); setVoidTarget(null); }
  };

  const handleRefundSuccess = () => {
    if (refundTarget && onRefundOrder) { onRefundOrder(refundTarget); setRefundTarget(null); }
  };

  return (
    <div className="flex gap-3 p-4 flex-1 overflow-hidden min-h-0">
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) => o.status === col.status);
        return (
          <div key={col.status} className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Column header */}
            <div className="card-glass flex items-center gap-1.5 mb-2.5 shrink-0 py-2 px-3 rounded-[10px]">
              <div className="w-[7px] h-[7px] rounded-full" style={{ background: col.color, boxShadow: `0 0 5px ${col.color}44` }} />
              <div className="text-[8.5px] tracking-[1.5px] uppercase font-bold" style={{ color: col.color }}>{col.label}</div>
              <div className="text-[8px] text-erl-text-disabled ml-auto bg-erl-surface rounded-[10px] px-[7px] leading-[18px] font-bold">{colOrders.length}</div>
            </div>

            {/* Orders */}
            <div className="scroll-area flex-1 flex flex-col gap-1.5 overflow-y-auto min-h-0">
              {colOrders.length === 0 && (
                <div className="text-center py-8 text-erl-text-disabled text-[9px] tracking-wide">Empty</div>
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
        <VoidCredentialModal orderId={voidTarget} onCancel={() => setVoidTarget(null)} onVoidSuccess={handleVoidSuccess} action="void" />
      )}
      {refundTarget && (
        <VoidCredentialModal orderId={refundTarget} onCancel={() => setRefundTarget(null)} onVoidSuccess={handleRefundSuccess} action="refund" />
      )}
    </div>
  );
};

/* Kitchen Card */

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
    <div className="animate-scale-in bg-erl-surface rounded-xl p-3 transition-fast"
      style={{
        border: `1.5px solid ${isLate ? "var(--danger-border)" : "var(--border-subtle)"}`,
        borderLeft: `3px solid ${isLate ? "var(--danger)" : colColor}`,
      }}
    >
      {/* Top row: ID + time */}
      <div className="flex justify-between items-center mb-1.5">
        <div className="font-display text-[13px] font-bold text-erl-text-primary tracking-wide">
          {order.id.slice(0, 8).toUpperCase()}
        </div>
        <div className="flex items-center gap-[5px]">
          {isLate && <span className="pill pill-danger animate-pulse-slow text-[7px] py-0.5 px-1.5">Late</span>}
          <div className="text-[7.5px] text-erl-text-disabled tracking-wide">{formatTime(order.createdAt)}</div>
        </div>
      </div>

      {/* Meta pills */}
      <div className="flex gap-1 mb-2 flex-wrap">
        <span className="pill pill-gold text-[7.5px] py-[3px] px-2">
          {order.type === "dine-in" ? (order.customerName || "Dine-in") : "Takeout"}
        </span>
        <span className="pill pill-muted text-[7.5px] py-[3px] px-2">
          {order.staff.name.split(" ")[0]}
        </span>
        <span className="pill pill-muted ml-auto text-[7.5px] py-[3px] px-2">
          {formatCurrency(order.total)}
        </span>
      </div>

      {/* Items */}
      <div className="mb-2">
        {order.items.map((ci) => (
          <div key={ci.item.id} className="text-[10px] text-erl-text-muted mb-0.5 flex gap-[5px]">
            <span className="text-erl-accent font-semibold">{ci.qty}×</span>
            {ci.item.name}
            {ci.modifiers && ci.modifiers.length > 0 && (
              <span className="text-erl-accent-dim text-[8.5px]">({ci.modifiers.map((m) => m.name).join(", ")})</span>
            )}
            {ci.notes && <span className="text-erl-accent-dim italic text-[8.5px]">— {ci.notes}</span>}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        {order.status === "preparing" && (
          <>
            <button className="btn btn-success flex-1 py-1.5 text-[7.5px] rounded-lg" onClick={() => onUpdateStatus(order.id, "ready")}>Mark Ready ✓</button>
            {isVoidPending ? (
              <button disabled className="py-1.5 px-2.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-accent text-[7.5px] font-bold tracking-wide uppercase">Auth…</button>
            ) : (
              <button onClick={onRequestVoid} className="btn-danger text-[7.5px] py-1.5 px-2.5 rounded-lg">&#x2715; Void</button>
            )}
          </>
        )}
        {order.status === "pending" && (
          <>
            <button onClick={() => onUpdateStatus(order.id, "preparing")} className="btn btn-accent flex-1 py-1.5 text-[7.5px] rounded-lg">Start</button>
            {isVoidPending ? (
              <button disabled className="py-1.5 px-2.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-accent text-[7.5px] font-bold tracking-wide uppercase">Auth…</button>
            ) : (
              <button onClick={onRequestVoid} className="btn-danger text-[7.5px] py-1.5 px-2.5 rounded-lg">&#x2715; Void</button>
            )}
          </>
        )}
        {order.status === "ready" && (
          <button className="btn btn-accent flex-1 py-1.5 text-[7.5px] rounded-lg" onClick={() => onUpdateStatus(order.id, "completed")}>Serve ✓</button>
        )}
        {order.status === "completed" && (
          <div className="flex gap-1 items-center w-full">
            <div className="flex-1 text-center text-[8px] text-erl-text-disabled tracking-wide py-1.5">
              {order.completedAt ? `Done ${formatTime(order.completedAt)}` : "Completed"}
            </div>
            {isRefundPending ? (
              <button disabled className="py-1.5 px-2.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-danger text-[7.5px] font-bold tracking-wide uppercase">Auth…</button>
            ) : onRequestRefund ? (
              <button onClick={onRequestRefund} className="btn-danger text-[7.5px] py-1.5 px-2.5 rounded-lg">&#x21A9; Refund</button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
