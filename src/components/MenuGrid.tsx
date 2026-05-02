import React, { useState, useEffect } from "react";
import { MenuItem, CartItem } from "../types";
import { formatCurrency } from "../utils";
import { apiGet } from "../utils/api";

interface Props {
  cart: CartItem[];
  onAddItem: (item: MenuItem) => void;
}

export const MenuGrid: React.FC<Props> = ({ cart, onAddItem }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    apiGet<any[]>('/menu')
    .then((data) => {
      const items: MenuItem[] = data.map((d: any) => ({
        ...d,
        price: Number(d.price) || 0,
        popular: !!d.popular,
      }));
      setMenuItems(items);
      const cats = [...new Set(items.map((i) => i.category))];
      if (cats.length > 0 && !activeCategory) {
        setActiveCategory(cats[0]);
      }
    })
    .catch(() => setMenuItems([]))
    .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(menuItems.map((i) => i.category))];
  const items = menuItems.filter((m) => m.category === activeCategory);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Category Tabs — horizontally scrollable on mobile */}
      <div style={{
        display: "flex",
        gap: 8,
        padding: "0.85rem 1rem 0",
        flexShrink: 0,
        overflowX: "auto",
        scrollbarWidth: "none" as const,
      }}>
        {categories.map((cat: string) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "7px 16px",
              borderRadius: 20,
              border: `1.5px solid ${activeCategory === cat ? "var(--gold)" : "var(--border-default)"}`,
              background: activeCategory === cat ? "var(--gold)" : "transparent",
              color: activeCategory === cat ? "var(--bg-sidebar)" : "var(--text-secondary)",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase" as const,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.18s",
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      {/* Grid */}
      <div className="scroll-area" style={{ flex: 1, padding: "0.9rem 1rem" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
            Loading menu...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem", fontSize: 12 }}>
            No items in this category
          </div>
        ) : (
          <div className="menu-grid-root"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {items.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                cartItem={cart.find((ci) => ci.item.id === item.id)}
                onAdd={onAddItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface MenuCardProps {
  item: MenuItem;
  cartItem?: CartItem;
  onAdd: (item: MenuItem) => void;
}

const MenuCard: React.FC<MenuCardProps> = ({ item, cartItem, onAdd }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onAdd(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: `1.5px solid ${cartItem ? "var(--gold)" : hovered ? "var(--border-medium)" : "var(--border-subtle)"}`,
        borderRadius: 14,
        padding: "14px 14px 12px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? "0 6px 20px rgba(0,0,0,0.35)" : "0 1px 4px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 140,
      }}
    >
      {/* Top row: emoji + optional badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{item.emoji}</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {item.popular && (
            <span style={{
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase" as const,
              color: "var(--bg-sidebar)",
              background: "var(--gold)",
              padding: "2px 6px",
              borderRadius: 4,
            }}>
              Popular
            </span>
          )}
          {item.badge && (
            <span style={{
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase" as const,
              color: "var(--gold)",
              border: "1px solid var(--gold-dim)",
              padding: "2px 6px",
              borderRadius: 4,
            }}>
              {item.badge}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <div style={{
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--text-primary)",
        lineHeight: 1.3,
        flex: 1,
      }}>
        {item.name}
      </div>

      {/* Description — clamped to 2 lines */}
      <div style={{
        fontSize: 9.5,
        color: "var(--text-secondary)",
        lineHeight: 1.5,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {item.description}
      </div>

      {/* Bottom: price + qty badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4 }}>
        <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>
          {formatCurrency(item.price)}
        </span>
        {cartItem && (
          <div style={{
            background: "var(--gold)",
            color: "var(--bg-sidebar)",
            borderRadius: "50%",
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
          }}>
            {cartItem.qty}
          </div>
        )}
      </div>
    </div>
  );
};
