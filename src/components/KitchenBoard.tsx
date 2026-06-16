import React, { useState, useEffect } from "react";
import { Order, OrderStatus } from "../types";
import { formatTime, formatCurrency } from "../utils";
import { VoidCredentialModal } from "./VoidCredentialModal";
import { useViewport } from "../hooks/useViewport";

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
  const [mobileFilter, setMobileFilter] = useState<OrderStatus | 'all'>('all');
  const { isMobile } = useViewport();

  const mobileOrders = mobileFilter === 'all' ? orders : orders.filter((o) => o.status === mobileFilter);

  const handleVoidSuccess = () => {
    if (voidTarget) { onVoidOrder(voidTarget); setVoidTarget(null); }
  };

  const handleRefundSuccess = () => {
    if (refundTarget && onRefundOrder) { onRefundOrder(refundTarget); setRefundTarget(null); }
  };

  return (
    <div className={`flex-1 min-h-0 ${isMobile ? 'overflow-hidden' : 'flex gap-3 p-4 overflow-x-auto'}`}>
      {isMobile ? (
        <div className="flex flex-col flex-1 overflow-hidden min-h-0 h-full">
          {/* Mobile tabs */}
          <div className="flex gap-1.5 p-3 overflow-x-auto shrink-0">
            <button
              onClick={() => setMobileFilter('all')}
              className={`py-2.5 px-3.5 rounded-lg text-[11px] font-bold whitespace-nowrap min-h-[44px] transition-all ${
                mobileFilter === 'all' ? 'bg-erl-accent text-erl-sidebar' : 'bg-erl-surface text-erl-text-muted'
              }`}
            >
              All ({orders.length})
            </button>
            {COLUMNS.map((col) => {
              const count = orders.filter((o) => o.status === col.status).length;
              return (
                <button
                  key={col.status}
                  onClick={() => setMobileFilter(col.status)}
                  className={`py-2.5 px-3.5 rounded-lg text-[11px] font-bold whitespace-nowrap min-h-[44px] transition-all ${
                    mobileFilter === col.status ? 'text-erl-sidebar' : 'bg-erl-surface text-erl-text-muted'
                  }`}
                  style={mobileFilter === col.status ? { background: col.color } : undefined}
                >
                  {col.label} ({count})
                </button>
              );
            })}
          </div>
          {/* Mobile list */}
          <div className="scroll-area flex-1 overflow-y-auto p-3">
            {mobileOrders.length === 0 && (
              <div className="text-center py-8 text-erl-text-disabled text-sm tracking-wide">Empty</div>
            )}
            {mobileOrders.map((order) => (
              <div key={order.id} className="mb-3">
                <KitchenCard
                  order={order}
                  colColor={COLUMNS.find((c) => c.status === order.status)?.color || '#888'}
                  onUpdateStatus={onUpdateStatus}
                  isVoidPending={voidTarget === order.id}
                  onRequestVoid={() => setVoidTarget(order.id)}
                  isRefundPending={refundTarget === order.id}
                  onRequestRefund={() => setRefundTarget(order.id)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.status);
            return (
              <div key={col.status} className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-[200px]">
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
        </>
      )}
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
  // Live ticker — re-render every second so elapsed time and Late badge stay current
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
  const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 60000);
  const isLate = order.status === "preparing" && elapsed >= 10;

  return (
    <div className="animate-scale-in bg-erl-surface rounded-xl p-4 sm:p-3 transition-fast"
      style={{
        border: `1.5px solid ${isLate ? "var(--danger-border)" : "var(--border-subtle)"}`,
        borderLeft: `3px solid ${isLate ? "var(--danger)" : colColor}`,
      }}
    >
      {/* Top row: ID + time */}
      <div className="flex justify-between items-center mb-1.5">
        <div className="font-display text-base sm:text-[13px] font-bold text-erl-text-primary tracking-wide">
          {order.id.slice(0, 8).toUpperCase()}
        </div>
        <div className="flex items-center gap-2 sm:gap-[5px]">
          {isLate && <span className="pill pill-danger animate-pulse-slow text-[10px] sm:text-[7px] py-1 sm:py-0.5 px-2 sm:px-1.5">Late</span>}
          {order.status !== "completed" && !isLate && (
            <span className="text-[9px] sm:text-[7px] text-erl-text-faint font-mono">{elapsed}m</span>
          )}
          <div className="text-[10px] sm:text-[7.5px] text-erl-text-disabled tracking-wide">{formatTime(order.createdAt)}</div>
        </div>
      </div>

      {/* Meta pills */}
      <div className="flex gap-1.5 sm:gap-1 mb-2.5 sm:mb-2 flex-wrap">
        <span className="pill pill-gold text-[10px] sm:text-[7.5px] py-1 sm:py-[3px] px-2.5 sm:px-2">
          {order.customerName || (order.type === "dine-in" ? "Dine-in" : "Takeout")}
        </span>
        <span className="pill pill-muted text-[10px] sm:text-[7.5px] py-1 sm:py-[3px] px-2.5 sm:px-2">
          {order.staff.name.split(" ")[0]}
        </span>
        <span className="pill pill-muted ml-auto text-[10px] sm:text-[7.5px] py-1 sm:py-[3px] px-2.5 sm:px-2">
          {formatCurrency(order.total)}
        </span>
      </div>

      {/* Items */}
      <div className="mb-2.5 sm:mb-2">
        {order.items.map((ci) => (
          <div key={ci.item.id} className="text-xs sm:text-[10px] text-erl-text-muted mb-1 sm:mb-0.5 flex gap-2 sm:gap-[5px]">
            <span className="text-erl-accent font-semibold">{ci.qty}×</span>
            {ci.item.name}
            {ci.modifiers && ci.modifiers.length > 0 && (
              <span className="text-erl-accent-dim text-[10px] sm:text-[8.5px]">({ci.modifiers.map((m) => m.name).join(", ")})</span>
            )}
            {ci.notes && <span className="text-erl-accent-dim italic text-[10px] sm:text-[8.5px]">— {ci.notes}</span>}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 sm:gap-1">
        {order.status === "preparing" && (
          <>
            <button className="btn btn-success flex-1 py-2.5 sm:py-1.5 text-xs sm:text-[7.5px] rounded-lg min-h-[44px] sm:min-h-0" onClick={() => onUpdateStatus(order.id, "ready")}>Mark Ready ✓</button>
            {isVoidPending ? (
              <button disabled className="py-2.5 sm:py-1.5 px-3 sm:px-2.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-accent text-xs sm:text-[7.5px] font-bold tracking-wide uppercase min-h-[44px] sm:min-h-0">Auth…</button>
            ) : (
              <button onClick={onRequestVoid} className="btn-danger text-xs sm:text-[7.5px] py-2.5 sm:py-1.5 px-3 sm:px-2.5 rounded-lg min-h-[44px] sm:min-h-0">&#x2715; Void</button>
            )}
          </>
        )}
        {order.status === "pending" && (
          <>
            <button onClick={() => onUpdateStatus(order.id, "preparing")} className="btn btn-accent flex-1 py-2.5 sm:py-1.5 text-xs sm:text-[7.5px] rounded-lg min-h-[44px] sm:min-h-0">Start</button>
            {isVoidPending ? (
              <button disabled className="py-2.5 sm:py-1.5 px-3 sm:px-2.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-accent text-xs sm:text-[7.5px] font-bold tracking-wide uppercase min-h-[44px] sm:min-h-0">Auth…</button>
            ) : (
              <button onClick={onRequestVoid} className="btn-danger text-xs sm:text-[7.5px] py-2.5 sm:py-1.5 px-3 sm:px-2.5 rounded-lg min-h-[44px] sm:min-h-0">&#x2715; Void</button>
            )}
          </>
        )}
        {order.status === "ready" && (
          <button className="btn btn-accent flex-1 py-2.5 sm:py-1.5 text-xs sm:text-[7.5px] rounded-lg min-h-[44px] sm:min-h-0" onClick={() => onUpdateStatus(order.id, "completed")}>Serve ✓</button>
        )}
        {order.status === "completed" && (
          <div className="flex gap-1.5 sm:gap-1 items-center w-full">
            <div className="flex-1 text-center text-[10px] sm:text-[8px] text-erl-text-disabled tracking-wide py-2.5 sm:py-1.5">
              {order.completedAt ? `Done ${formatTime(order.completedAt)}` : "Completed"}
            </div>
            {isRefundPending ? (
              <button disabled className="py-2.5 sm:py-1.5 px-3 sm:px-2.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-danger text-xs sm:text-[7.5px] font-bold tracking-wide uppercase min-h-[44px] sm:min-h-0">Auth…</button>
            ) : onRequestRefund ? (
              <button onClick={onRequestRefund} className="btn-danger text-xs sm:text-[7.5px] py-2.5 sm:py-1.5 px-3 sm:px-2.5 rounded-lg min-h-[44px] sm:min-h-0">&#x21A9; Refund</button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
