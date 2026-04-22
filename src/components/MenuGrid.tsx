import React from "react";
import { MenuItem, Category, CartItem } from "../types";
import { MENU, CATEGORIES } from "../data";
import { formatCurrency } from "../utils";

interface Props {
  category: Category;
  cart: CartItem[];
  onCategoryChange: (c: Category) => void;
  onAddItem: (item: MenuItem) => void;
}

export const MenuGrid: React.FC<Props> = ({ category, cart, onCategoryChange, onAddItem }) => {
  const items = MENU.filter((m) => m.category === category);

  return (
    <>
      {/* Category Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "1rem 1.2rem 0", flexShrink: 0, flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => (
          <button key={cat} className={`btn tab ${category === cat ? "active" : ""}`}
            onClick={() => onCategoryChange(cat)}
            style={{ background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-disabled)", fontSize: 9, padding: "8px 14px", whiteSpace: "nowrap" }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="scroll-area" style={{ flex: 1, padding: "1rem 1.2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 11 }}>
          {items.map((item) => (
            <MenuCard key={item.id} item={item} cartItem={cart.find((ci) => ci.item.id === item.id)} onAdd={onAddItem} />
          ))}
        </div>
      </div>
    </>
  );
};

interface MenuCardProps {
  item: MenuItem;
  cartItem?: CartItem;
  onAdd: (item: MenuItem) => void;
}

const MenuCard: React.FC<MenuCardProps> = ({ item, cartItem, onAdd }) => (
  <div onClick={() => onAdd(item)}
    style={{ background: "var(--bg-surface)", border: `1px solid ${cartItem ? "var(--gold)" : item.popular ? "var(--border-default)" : "var(--border-subtle)"}`, borderRadius: 12, padding: 14, cursor: "pointer", transition: "border-color 0.15s, transform 0.1s", position: "relative", overflow: "hidden" }}
    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}>

    {item.popular && (
      <div style={{ position: "absolute", top: 8, right: 8, background: "var(--gold)", color: "var(--bg-sidebar)", fontSize: 7, letterSpacing: 1, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
        Popular
      </div>
    )}

    <div style={{ fontSize: 26, marginBottom: 8 }}>{item.emoji}</div>

    {item.badge && (
      <div className="badge" style={{ marginBottom: 3 }}>{item.badge}</div>
    )}

    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>
      {item.name}
    </div>
    <div style={{ fontSize: 10, color: "var(--gold-muted)", lineHeight: 1.4, marginBottom: 10 }}>
      {item.description.slice(0, 62)}…
    </div>

    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>
        {formatCurrency(item.price)}
      </div>
      {cartItem && (
        <div style={{ background: "var(--gold)", color: "var(--bg-sidebar)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
          {cartItem.qty}
        </div>
      )}
    </div>
  </div>
);
