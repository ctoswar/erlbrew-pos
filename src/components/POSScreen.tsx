import React, { useState, useCallback, useEffect } from "react";
import { Staff, Screen, OrderType, PayMethod, Order } from "../types";
import { useCart } from "../hooks/useCart";
import { useOrders } from "../hooks/useOrders";
import { useKitchenEvents } from "../hooks/useKitchenEvents";
import { Topbar } from "./Topbar";
import { MenuGrid } from "./MenuGrid";
import { CartPanel } from "./CartPanel";
import { CheckoutScreen } from "./CheckoutScreen";
import { PaymentScreen } from "./PaymentScreen";
import { SuccessScreen } from "./SuccessScreen";
import { KitchenBoard } from "./KitchenBoard";
import { Dashboard } from "./Dashboard";
import { AdminScreen } from "./AdminScreen";
import { TimeKeeping } from "./TimeKeeping";
import { DiscountModal } from "./DiscountModal";
import { openCashDrawer } from "../utils/receiptUtils";
import { calcGrand } from "../utils";

interface Props {
  staff: Staff;
  onLogout: () => void;
}

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min inactivity → auto-logout

export const POSScreen: React.FC<Props> = ({ staff, onLogout }) => {
  const [screen, setScreen] = useState<Screen>("pos");
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [customerName, setCustomerName] = useState("");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [isTablet, setIsTablet] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Track viewport width for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      setIsTablet(window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Session timeout — reset on any user interaction
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onLogout, SESSION_TIMEOUT_MS);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [onLogout]);

  // Cart visible on tablet+ throughout order flow
  const isOrderFlow = screen === "pos" || screen === "checkout" || screen === "payment";
  const showDesktopCart = !isMobile && isOrderFlow;

  const { cart, discount, addItem, updateQty, clearCart, applyDiscount, removeDiscount, addNote } = useCart();

  // Sync cart meta to localStorage for CustomerDisplay (second monitor)
  // Note: cart is in deps because useCart returns a new object reference on every render.
  // This is intentional - we want to sync orderType/table changes immediately.
  useEffect(() => {
    try {
      localStorage.setItem("erlbrew_cart_meta", JSON.stringify({ orderType, customerName }));
      const v = String(Date.now());
      localStorage.setItem("erlbrew_cart_version", v);
    } catch {}
  }, [orderType, customerName, cart]);
  const { orders, placeOrder, updateStatus, voidOrder, refundOrder, activeOrders, pendingCount } = useOrders();
  useKitchenEvents(); // Establish SSE connection for real-time order updates

  const handleNavigate = useCallback((s: Screen) => {
    setScreen(s);
  }, []);

  const handleCheckout = () => {
    if (cart.length > 0) setScreen("checkout");
  };

  const handleConfirmPayment = (method: PayMethod, cashTendered?: number, referenceNumber?: string) => {
    const order = placeOrder(cart, staff, orderType, customerName, method, cashTendered, discount, referenceNumber);
    setLastOrder(order);
    clearCart();
    setMobileCartOpen(false);

    // Open cash drawer via Pi Bluetooth print server (fire-and-forget)
    openCashDrawer().catch((err) => console.error("Failed to open cash drawer:", err));

    setScreen("success");
  };

  const handleOrderDone = () => {
    setScreen("pos");
    setLastOrder(null);
  };

  const handleBack = () => {
    if (screen === "checkout") setScreen("pos");
    else if (screen === "payment") setScreen("checkout");
  };

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  // ── Mobile cart bottom sheet ────────────────────────────────────────────────
  const renderMobileCartSheet = () => (
    <>
      <div className="cart-overlay" onClick={() => setMobileCartOpen(false)} />
      <div className="cart-bottomsheet">
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: "var(--border-medium)" }} />
        </div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="font-display" style={{ fontSize: 15, color: "var(--text-primary)" }}>
            Current Order
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {cart.length > 0 && (
                  <button
                    className="btn btn-danger"
                    onClick={() => { clearCart(); setMobileCartOpen(false); }}
                  >
                    Clear All
                  </button>
                )}
            <button
              onClick={() => setMobileCartOpen(false)}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer", padding: "0 4px" }}
            >
              ✕
            </button>
          </div>
        </div>
        {/* Cart panel content (scrollable) */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <CartPanel
            cart={cart}
            discount={discount}
            orderType={orderType}
            customerName={customerName}
            onUpdateQty={updateQty}
            onClearCart={() => { clearCart(); setMobileCartOpen(false); }}
            onOrderTypeChange={setOrderType}
            onCustomerNameChange={setCustomerName}
            onCheckout={() => { setMobileCartOpen(false); handleCheckout(); }}
            onOpenDiscount={() => setShowDiscountModal(true)}
            onRemoveDiscount={removeDiscount}
            onAddNote={addNote}
          />
        </div>
      </div>
    </>
  );

  // ── Mobile floating cart button ─────────────────────────────────────────────
  const renderMobileCartButton = () => (
    <button
      onClick={() => setMobileCartOpen(true)}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 900,
        background: "var(--gold)",
        color: "var(--bg-sidebar)",
        border: "none",
        borderRadius: "50%",
        width: 60,
        height: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 20px rgba(201,135,58,0.5)",
        cursor: "pointer",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        gap: 2,
      }}
    >
      <span style={{ fontSize: 18 }}>🛒</span>
      <span>{cartCount}</span>
    </button>
  );

  // ── Desktop cart panel (always visible on right) ────────────────────────────
  const renderDesktopCart = () => {
    // Tablet: compact width; desktop: full width
    const cartWidth = isTablet ? 260 : 320;
    return (
      <div style={{ width: cartWidth, flexShrink: 0, display: "flex", flexDirection: "column", height: "100%" }}>
        <CartPanel
          cart={cart}
          discount={discount}
          orderType={orderType}
          customerName={customerName}
          onUpdateQty={updateQty}
          onClearCart={clearCart}
          onOrderTypeChange={setOrderType}
          onCustomerNameChange={setCustomerName}
          onCheckout={handleCheckout}
          onOpenDiscount={() => setShowDiscountModal(true)}
          onRemoveDiscount={removeDiscount}
          onAddNote={addNote}
        />
      </div>
    );
  };

  // ── Main screen router ──────────────────────────────────────────────────────
  const renderMainScreen = () => {
    switch (screen) {
      case "pos":
        return <MenuGrid cart={cart} onAddItem={addItem} />;
      case "checkout":
        return (
          <CheckoutScreen
            cart={cart}
            discount={discount}
            orderType={orderType}
            customerName={customerName}
            staffName={staff.name}
            onBack={handleBack}
            onContinue={() => setScreen("payment")}
          />
        );
      case "payment":
        return (
          <PaymentScreen
            total={calcGrand(cart.reduce((s, ci) => s + ci.item.price * ci.qty, 0), discount)}
            discountLabel={discount?.label}
            discountAmount={discount?.amount}
            onBack={handleBack}
            onConfirm={handleConfirmPayment}
          />
        );
      case "success":
        return lastOrder ? <SuccessScreen order={lastOrder} onDone={handleOrderDone} /> : null;
      case "kitchen":
        return <KitchenBoard orders={orders} onUpdateStatus={updateStatus} onVoidOrder={voidOrder} onRefundOrder={refundOrder} />;
case "dashboard":
  return <Dashboard orders={orders} staffName={staff.name} />;
case "admin":
      return <AdminScreen />;
    case "time":
      return <TimeKeeping />;
    default:
        return null;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", position: "relative" }}>
      {/* ── Left Column ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxWidth: isMobile ? "100%" : undefined,
        }}
      >
        <Topbar
          staff={staff}
          screen={screen}
          activeOrderCount={activeOrders.length}
          onNavigate={handleNavigate}
          onLogout={onLogout}
        />

        {/* Screen router */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {renderMainScreen()}
        </div>
      </div>

      {/* Offline queue indicator */}
      {pendingCount > 0 && (
        <div style={{
          position: "fixed", bottom: 16, left: 16, zIndex: 999,
          background: "rgba(201,135,58,0.12)", border: "1px solid var(--gold-dim)",
          borderRadius: 10, padding: "8px 14px",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 10, color: "var(--gold)", fontWeight: 700,
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          animation: "fadeInUp 0.3s ease",
        }}>
          <span style={{ fontSize: 14 }}>📡</span>
          <span>{pendingCount} order{pendingCount > 1 ? 's' : ''} pending sync</span>
        </div>
      )}

      {/* ── Desktop cart panel (tablet+) — visible throughout order flow ── */}
      {showDesktopCart && renderDesktopCart()}

      {/* ── Mobile floating cart button ── */}
      {isMobile && cart.length > 0 && !mobileCartOpen && (
        renderMobileCartButton()
      )}

{/* ── Mobile cart bottom sheet ── */}
      {isMobile && mobileCartOpen && (
        renderMobileCartSheet()
      )}

      {/* ── Discount modal ── */}
      {showDiscountModal && (
        <DiscountModal
          subtotal={cart.reduce((s, ci) => s + ci.item.price * ci.qty, 0)}
          currentDiscount={discount}
          onApply={(type, label, value) => {
            const sub = cart.reduce((s, ci) => s + ci.item.price * ci.qty, 0);
            applyDiscount(type, label, value, sub);
          }}
          onRemove={removeDiscount}
          onClose={() => setShowDiscountModal(false)}
        />
      )}

    </div>
  );
};