import React, { useState, useCallback, useEffect } from "react";
import { Staff, Screen, OrderType, PayMethod, Order } from "../types";
import { useCart } from "../hooks/useCart";
import { useOrders } from "../hooks/useOrders";
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

interface Props {
  staff: Staff;
  onLogout: () => void;
}

const MOBILE_BREAKPOINT = 768;

export const POSScreen: React.FC<Props> = ({ staff, onLogout }) => {
  const [screen, setScreen] = useState<Screen>("pos");
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [table, setTable] = useState("1");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Track viewport width for responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { cart, addItem, updateQty, clearCart } = useCart();

  // Sync cart meta to localStorage for CustomerDisplay (second monitor)
  useEffect(() => {
    try {
      localStorage.setItem("erlbrew_cart_meta", JSON.stringify({ orderType, table }));
      const v = String(Date.now());
      localStorage.setItem("erlbrew_cart_version", v);
    } catch {}
  }, [orderType, table, cart]);
  const { orders, placeOrder, updateStatus, voidOrder, activeOrders } = useOrders();

  const handleNavigate = useCallback((s: Screen) => {
    setScreen(s);
  }, []);

  const handleCheckout = () => {
    if (cart.length > 0) setScreen("checkout");
  };

  const handleConfirmPayment = (method: PayMethod) => {
    const order = placeOrder(cart, staff, orderType, table, method);
    setLastOrder(order);
    clearCart();
    setMobileCartOpen(false);
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
                style={{ fontSize: 8, padding: "5px 10px" }}
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
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <CartPanel
            cart={cart}
            orderType={orderType}
            table={table}
            onUpdateQty={updateQty}
            onClearCart={() => { clearCart(); setMobileCartOpen(false); }}
            onOrderTypeChange={setOrderType}
            onTableChange={setTable}
            onCheckout={() => { setMobileCartOpen(false); handleCheckout(); }}
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
  const renderDesktopCart = () => (
    <div className="hide-tablet" style={{ width: 300, flexShrink: 0 }}>
      <CartPanel
        cart={cart}
        orderType={orderType}
        table={table}
        onUpdateQty={updateQty}
        onClearCart={clearCart}
        onOrderTypeChange={setOrderType}
        onTableChange={setTable}
        onCheckout={handleCheckout}
      />
    </div>
  );

  // ── Main screen router ──────────────────────────────────────────────────────
  const renderMainScreen = () => {
    switch (screen) {
      case "pos":
        return <MenuGrid cart={cart} onAddItem={addItem} />;
      case "checkout":
        return (
          <CheckoutScreen
            cart={cart}
            orderType={orderType}
            table={table}
            staffName={staff.name}
            onBack={handleBack}
            onContinue={() => setScreen("payment")}
          />
        );
      case "payment":
        return (
          <PaymentScreen
            total={cart.reduce((s, ci) => s + ci.item.price * ci.qty, 0)}
            onBack={handleBack}
            onConfirm={handleConfirmPayment}
          />
        );
      case "success":
        return lastOrder ? <SuccessScreen order={lastOrder} onDone={handleOrderDone} /> : null;
      case "kitchen":
        return <KitchenBoard orders={orders} onUpdateStatus={updateStatus} staffRole={staff.role} onVoidOrder={voidOrder} />;
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
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {renderMainScreen()}
        </div>
      </div>

      {/* ── Desktop cart panel (non-mobile) ── */}
      {!isMobile && screen === "pos" && (
        renderDesktopCart()
      )}

      {/* ── Mobile floating cart button (only on pos screen, when not in checkout flow) ── */}
      {isMobile && screen === "pos" && cart.length > 0 && !mobileCartOpen && (
        renderMobileCartButton()
      )}

      {/* ── Mobile cart bottom sheet ── */}
      {isMobile && mobileCartOpen && (
        renderMobileCartSheet()
      )}
    </div>
  );
};