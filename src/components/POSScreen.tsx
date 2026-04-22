import React, { useState, useCallback } from "react";
import { Staff, Screen, Category, OrderType, PayMethod, Order } from "../types";
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

interface Props {
  staff: Staff;
  onLogout: () => void;
}

export const POSScreen: React.FC<Props> = ({ staff, onLogout }) => {
  const [screen, setScreen] = useState<Screen>("pos");
  const [category, setCategory] = useState<Category>("Signature Brews");
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [table, setTable] = useState("1");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const { cart, addItem, updateQty, clearCart } = useCart();
  const { orders, placeOrder, updateStatus, activeOrders } = useOrders();

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
    setScreen("success");
  };

  const handleOrderDone = () => {
    setScreen("pos");
    setLastOrder(null);
  };

  const showCart =
    screen === "pos" ||
    screen === "checkout" ||
    screen === "payment" ||
    screen === "success";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ── Left Column ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          staff={staff}
          screen={screen}
          activeOrderCount={activeOrders.length}
          onNavigate={handleNavigate}
          onLogout={onLogout}
        />

        {/* Screen router */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {screen === "pos" && (
            <MenuGrid
              category={category}
              cart={cart}
              onCategoryChange={setCategory}
              onAddItem={addItem}
            />
          )}

          {screen === "checkout" && (
            <CheckoutScreen
              cart={cart}
              orderType={orderType}
              table={table}
              staffName={staff.name}
              onBack={() => setScreen("pos")}
              onContinue={() => setScreen("payment")}
            />
          )}

          {screen === "payment" && (
            <PaymentScreen
              total={cart.reduce((s, ci) => s + ci.item.price * ci.qty, 0) * 1.12}
              onBack={() => setScreen("checkout")}
              onConfirm={handleConfirmPayment}
            />
          )}

          {screen === "success" && lastOrder && (
            <SuccessScreen order={lastOrder} onDone={handleOrderDone} />
          )}

          {screen === "kitchen" && (
            <KitchenBoard orders={orders} onUpdateStatus={updateStatus} />
          )}

          {screen === "dashboard" && (
            <Dashboard orders={orders} staffName={staff.name} />
          )}
        </div>
      </div>

      {/* ── Right Cart Panel (only on order flow) ── */}
      {(screen === "pos") && (
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
      )}
    </div>
  );
};
