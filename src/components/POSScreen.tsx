import React, { useState, useCallback, useEffect } from "react";
import { Staff, Screen, OrderType, PayMethod, Order, CartItem } from "../types";
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
import { useViewport } from "../hooks/useViewport";
import { openCashDrawer } from "../utils/receiptUtils";
import { calcGrand } from "../utils";

interface Props {
  staff: Staff;
  onLogout: () => void;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export const POSScreen: React.FC<Props> = ({ staff, onLogout }) => {
  const [screen, setScreen] = useState<Screen>("pos");
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const { isMobile, isTablet } = useViewport();
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [splitItems, setSplitItems] = useState<CartItem[]>([]);
  const [splitMode, setSplitMode] = useState(false);
  const [splitSelections, setSplitSelections] = useState<Set<string>>(new Set());

  function cartItemKey(ci: CartItem): string {
    const modKey = (ci.modifiers || []).map((m) => m.name).sort().join("|");
    return modKey ? `${ci.item.id}::${modKey}` : ci.item.id;
  }

  // Session timeout
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

  const isOrderFlow = screen === "pos" || screen === "checkout" || screen === "payment";
  const showDesktopCart = !isMobile && isOrderFlow;

  const { cart, discount, addItem, updateQty, clearCart, applyDiscount, removeDiscount, addNote } = useCart();

  useEffect(() => {
    try {
      localStorage.setItem("erlbrew_cart_meta", JSON.stringify({ orderType, customerName }));
      localStorage.setItem("erlbrew_cart_version", String(Date.now()));
    } catch {}
  }, [orderType, customerName, cart]);

  const { orders, placeOrder, updateStatus, voidOrder, refundOrder, activeOrders, pendingCount } = useOrders();
  useKitchenEvents();

  const handleNavigate = useCallback((s: Screen) => setScreen(s), []);

  const handleCheckout = () => {
    if (cart.length > 0) setScreen("checkout");
  };

  const handleConfirmPayment = (method: PayMethod, cashTendered?: number, referenceNumber?: string) => {
    const order = placeOrder(cart, staff, orderType, customerName, customerPhone, method, cashTendered, discount, referenceNumber);
    setLastOrder(order);
    clearCart();
    setCustomerPhone("");
    setMobileCartOpen(false);
    openCashDrawer().catch((err) => console.error("Failed to open cash drawer:", err));
    setScreen("success");
  };

  const handleOrderDone = () => {
    if (splitItems.length > 0) {
      splitItems.forEach((ci) => {
        addItem(ci.item, ci.modifiers);
        for (let i = 1; i < ci.qty; i++) addItem(ci.item, ci.modifiers);
      });
      setSplitItems([]);
      setSplitMode(false);
      setScreen("pos");
      setLastOrder(null);
      return;
    }
    setScreen("pos");
    setLastOrder(null);
  };

  const handleStartSplit = () => { setSplitMode(true); setSplitSelections(new Set()); };
  const handleCancelSplit = () => { setSplitMode(false); setSplitSelections(new Set()); };

  const handleToggleSplitItem = (key: string) => {
    setSplitSelections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSplitConfirm = (selectedKeys: string[]) => {
    const selectedSet = new Set(selectedKeys);
    const remaining: CartItem[] = [];
    const moved: CartItem[] = [];
    cart.forEach((ci) => {
      if (selectedSet.has(cartItemKey(ci))) moved.push(ci);
      else remaining.push(ci);
    });
    if (moved.length === 0 || remaining.length === 0) return;
    clearCart();
    remaining.forEach((ci) => {
      addItem(ci.item, ci.modifiers);
      for (let i = 1; i < ci.qty; i++) addItem(ci.item, ci.modifiers);
    });
    setSplitItems(moved);
    setSplitMode(false);
    setSplitSelections(new Set());
  };

  const handleRepeatOrder = () => {
    if (!lastOrder) return;
    lastOrder.items.forEach((ci) => {
      addItem(ci.item, ci.modifiers);
      for (let i = 1; i < ci.qty; i++) addItem(ci.item, ci.modifiers);
    });
    setCustomerName(lastOrder.customerName || "");
    setOrderType(lastOrder.type);
    setLastOrder(null);
    setScreen("pos");
  };

  const handleBack = () => {
    if (screen === "checkout") setScreen("pos");
    else if (screen === "payment") setScreen("checkout");
  };

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const renderMobileCartSheet = () => (
    <>
      <div className="cart-overlay" onClick={() => setMobileCartOpen(false)} />
      <div className="cart-bottomsheet">
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-[38px] h-1 rounded-sm bg-erl-border-medium" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-erl-border-subtle">
          <div className="font-display text-[15px] text-erl-text-primary">Current Order</div>
          <div className="flex gap-2 items-center">
            {cart.length > 0 && (
              <button className="btn btn-danger" onClick={() => { clearCart(); setMobileCartOpen(false); }}>
                Clear All
              </button>
            )}
            <button
              onClick={() => setMobileCartOpen(false)}
              className="bg-transparent border-none text-erl-text-secondary text-xl cursor-pointer px-1"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
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
            splitMode={splitMode}
            splitSelections={splitSelections}
            onToggleSplitItem={handleToggleSplitItem}
            onStartSplit={handleStartSplit}
            onCancelSplit={handleCancelSplit}
            onSplitConfirm={handleSplitConfirm}
          />
        </div>
      </div>
    </>
  );

  const renderMobileCartButton = () => (
    <button
      onClick={() => setMobileCartOpen(true)}
      className="fixed bottom-5 right-5 z-[900] w-[60px] h-[60px] rounded-full bg-erl-accent text-erl-sidebar border-none flex flex-col items-center justify-center cursor-pointer text-[10px] font-bold tracking-wide gap-0.5 shadow-[0_4px_20px_rgba(201,135,58,0.5)]"
    >
      <span className="text-lg">🛒</span>
      <span>{cartCount}</span>
    </button>
  );

  const renderDesktopCart = () => {
    const cartWidth = isTablet ? 260 : 320;
    return (
      <div className="shrink-0 flex flex-col h-full" style={{ width: cartWidth }}>
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
          splitMode={splitMode}
          splitSelections={splitSelections}
          onToggleSplitItem={handleToggleSplitItem}
          onStartSplit={handleStartSplit}
          onCancelSplit={handleCancelSplit}
          onSplitConfirm={handleSplitConfirm}
        />
      </div>
    );
  };

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
            customerPhone={customerPhone}
            staffName={staff.name}
            onBack={handleBack}
            onContinue={() => setScreen("payment")}
            onCustomerNameChange={setCustomerName}
            onCustomerPhoneChange={setCustomerPhone}
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
        return lastOrder ? <SuccessScreen order={lastOrder} onDone={handleOrderDone} onRepeat={handleRepeatOrder} /> : null;
      case "kitchen":
        return <KitchenBoard orders={orders} onUpdateStatus={updateStatus} onVoidOrder={voidOrder} onRefundOrder={refundOrder} />;
      case "dashboard":
        return <Dashboard orders={orders} staffName={staff.name} onRepeatOrder={(items) => {
          items.forEach((ci) => {
            addItem(ci.item, ci.modifiers);
            for (let i = 1; i < ci.qty; i++) addItem(ci.item, ci.modifiers);
          });
          handleNavigate("pos");
        }} />;
      case "admin":
        return <AdminScreen />;
      case "time":
        return <TimeKeeping />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Left Column */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isMobile ? 'max-w-full' : ''}`}>
        <Topbar
          staff={staff}
          screen={screen}
          activeOrderCount={activeOrders.length}
          onNavigate={handleNavigate}
          onLogout={onLogout}
        />
        <div className="flex-1 flex overflow-hidden min-h-0">
          {renderMainScreen()}
        </div>
      </div>

      {/* Offline queue indicator */}
      {pendingCount > 0 && (
        <div className="fixed bottom-4 left-4 z-[999] bg-erl-accent/10 border border-erl-accent-dim rounded-[10px] px-3.5 py-2 flex items-center gap-2 text-[10px] text-erl-accent font-bold backdrop-blur-sm animate-fade-in-up">
          <span className="text-sm">📡</span>
          <span>{pendingCount} order{pendingCount > 1 ? 's' : ''} pending sync</span>
        </div>
      )}

      {/* Desktop cart panel */}
      {showDesktopCart && renderDesktopCart()}

      {/* Mobile floating cart button */}
      {isMobile && cart.length > 0 && !mobileCartOpen && renderMobileCartButton()}

      {/* Mobile cart bottom sheet */}
      {isMobile && mobileCartOpen && renderMobileCartSheet()}

      {/* Discount modal */}
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
