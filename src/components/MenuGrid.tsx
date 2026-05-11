import React, { useState, useEffect } from "react";
import { MenuItem, CartItem, CartItemModifier } from "../types";
import { formatCurrency } from "../utils";
import { apiGet } from "../utils/api";
import { ModifierModal } from "./ModifierModal";

interface Props {
  cart: CartItem[];
  onAddItem: (item: MenuItem, modifiers?: CartItemModifier[]) => void;
}

export const MenuGrid: React.FC<Props> = ({ cart, onAddItem }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);

  const handleItemTap = (item: MenuItem, mods?: CartItemModifier[]) => {
    onAddItem(item, mods);
  };

  const openModifierModal = (item: MenuItem) => {
    setModifierItem(item);
  };

  useEffect(() => {
    setLoading(true);
    apiGet<any[]>("/menu")
      .then((data) => {
        const items: MenuItem[] = data.map((d: any) => ({
          ...d,
          price: Number(d.price) || 0,
          popular: !!d.popular,
          modifiers: (d.modifiers || []).map((m: any) => ({
            ...m,
            price: Number(m.price) || 0,
          })),
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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Category Tabs */}
      <div
        className="hide-scrollbar"
        style={{
          display: "flex",
          gap: 6,
          padding: "0.9rem 1rem 0.5rem",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {categories.map((cat: string) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "7px 16px",
              borderRadius: 20,
              border: `1.5px solid ${activeCategory === cat ? "var(--gold)" : "var(--border-default)"}`,
              background: activeCategory === cat ? "var(--gold)" : "transparent",
              color: activeCategory === cat ? "var(--bg-sidebar)" : "var(--text-muted)",
              fontSize: 9.5,
              fontWeight: activeCategory === cat ? 700 : 500,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.15s var(--ease-out)",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div
        className="scroll-area"
        style={{
          flex: 1,
          padding: "0.6rem 1rem 1rem",
          overflowY: "auto",
          minHeight: 0,
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
            <div className="animate-shimmer" style={{ width: 120, height: 14, borderRadius: 4, margin: "0 auto 8px" }} />
            <div className="animate-shimmer" style={{ width: 80, height: 10, borderRadius: 4, margin: "0 auto" }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem", fontSize: 12 }}>
            No items in this category
          </div>
        ) : (
          <div
            className="menu-grid-root"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {items.map((item) => (
                <MenuCard
                  key={`${item.id}-${(item.modifiers || []).map((m) => m.id || m.name).join("-")}`}
                  item={item}
                  cartItem={cart.find((ci) => ci.item.id === item.id)}
                  onAdd={handleItemTap}
                  onOpenModal={openModifierModal}
                />
              ))}
          </div>
        )}
      </div>

      {modifierItem && (
        <ModifierModal
          item={modifierItem}
          onAdd={(item, modifiers) => {
            onAddItem(item, modifiers);
            setModifierItem(null);
          }}
          onClose={() => setModifierItem(null)}
        />
      )}
    </div>
  );
};

/* ── Menu Card ────────────────────────────────────────────────────────────── */

interface MenuCardProps {
  item: MenuItem;
  cartItem?: CartItem;
  onAdd: (item: MenuItem, modifiers?: CartItemModifier[]) => void;
  onOpenModal: (item: MenuItem) => void;
}

const MenuCard: React.FC<MenuCardProps> = ({ item, cartItem, onAdd, onOpenModal }) => {
  const [hovered, setHovered] = useState(false);
  const hasImage = !!item.image;
  const modifiers = item.modifiers || [];

  const handleCardClick = () => {
    if (modifiers.length === 0) {
      onAdd(item);
    } else {
      onOpenModal(item);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: `1.5px solid ${cartItem ? "var(--gold)" : hovered ? "var(--border-medium)" : "var(--border-subtle)"}`,
        borderRadius: 14,
        cursor: "pointer",
        transition: "all 0.18s var(--ease-out)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? "0 6px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(201,135,58,0.06)" : "0 1px 3px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Image */}
      {hasImage && (
        <div style={{ width: "100%", height: 100, overflow: "hidden", background: "var(--bg-base)" }}>
          <img
            src={item.image}
            alt={item.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.35s var(--ease-out)",
              transform: hovered ? "scale(1.06)" : "scale(1)",
            }}
          />
        </div>
      )}

      <div style={{ padding: "12px 13px 12px", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {/* Top row: emoji + badges */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{item.emoji}</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            {item.popular && (
              <span style={{
                fontSize: 6.5,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
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
                fontSize: 6.5,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "var(--gold)",
                border: "1px solid var(--gold-dim)",
                padding: "2px 5px",
                borderRadius: 4,
              }}>
                {item.badge}
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, flex: 1 }}>
          {item.name}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 9.5,
          color: "var(--text-secondary)",
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {item.description}
        </div>

        {/* Bottom: price + qty */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 3 }}>
          <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>
            {formatCurrency(item.price)}
          </span>
          {cartItem && cartItem.qty > 0 && (
            <div style={{
              background: "var(--gold)",
              color: "var(--bg-sidebar)",
              borderRadius: "50%",
              width: 24,
              height: 24,
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
    </div>
  );
};