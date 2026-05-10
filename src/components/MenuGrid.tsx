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

  const handleItemTap = (item: MenuItem) => {
    if (item.modifiers && item.modifiers.length > 0) {
      setModifierItem(item);
    } else {
      onAddItem(item);
    }
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
        style={{
          display: "flex",
          gap: 8,
          padding: "1rem 1.2rem 0",
          flexShrink: 0,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {categories.map((cat: string) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "8px 18px",
              borderRadius: 24,
              border: `1.5px solid ${activeCategory === cat ? "var(--gold)" : "var(--border-default)"}`,
              background: activeCategory === cat ? "var(--gold)" : "transparent",
              color:
                activeCategory === cat ? "var(--bg-sidebar)" : "var(--text-secondary)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.18s var(--ease-out)",
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
          padding: "1.2rem 1.2rem",
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
          <div
            style={{
              textAlign: "center",
              color: "var(--text-muted)",
              padding: "3rem",
              fontSize: 12,
            }}
          >
            No items in this category
          </div>
        ) : (
          <div
            className="menu-grid-root"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
            }}
          >
            {items.map((item) => (
              <MenuCard
                key={`${item.id}-${(item.modifiers || []).map((m) => m.id || m.name).join("-")}`}
                item={item}
                cartItem={cart.find((ci) => ci.item.id === item.id)}
                onAdd={handleItemTap}
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
  onAdd: (item: MenuItem) => void;
}

const MenuCard: React.FC<MenuCardProps> = ({ item, cartItem, onAdd }) => {
  const [hovered, setHovered] = useState(false);
  const hasImage = !!item.image;

  return (
    <div
      onClick={() => onAdd(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: `1.5px solid ${
          cartItem
            ? "var(--gold)"
            : hovered
              ? "var(--border-medium)"
              : "var(--border-subtle)"
        }`,
        borderRadius: 16,
        cursor: "pointer",
        transition: "all 0.2s var(--ease-out)",
        transform: hovered ? "translateY(-3px) scale(1.01)" : "translateY(0)",
        boxShadow: hovered
          ? "0 8px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(201,135,58,0.08)"
          : "0 1px 4px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Image */}
      {hasImage && (
        <div
          style={{
            width: "100%",
            height: 110,
            overflow: "hidden",
            background: "var(--bg-base)",
          }}
        >
          <img
            src={item.image}
            alt={item.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.35s var(--ease-out)",
              transform: hovered ? "scale(1.08)" : "scale(1)",
            }}
          />
        </div>
      )}

      <div
        style={{
          padding: hasImage ? "12px 14px 12px" : "14px 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
        }}
      >
        {/* Top row: emoji + badges */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 30, lineHeight: 1 }}>{item.emoji}</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            {item.popular && (
              <span
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "var(--bg-sidebar)",
                  background: "var(--gold)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  boxShadow: "0 2px 6px rgba(201,135,58,0.25)",
                }}
              >
                Popular
              </span>
            )}
            {item.badge && (
              <span
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "var(--gold)",
                  border: "1px solid var(--gold-dim)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {item.badge}
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.3,
            flex: 1,
          }}
        >
          {item.name}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 10.5,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.description}
        </div>

        {/* Bottom: price + qty badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 4,
          }}
        >
          <span
            className="font-display"
            style={{ fontSize: 17, fontWeight: 700, color: "var(--gold)" }}
          >
            {formatCurrency(item.price)}
          </span>
          {cartItem && (
            <div
              style={{
                background: "var(--gold)",
                color: "var(--bg-sidebar)",
                borderRadius: "50%",
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(201,135,58,0.3)",
              }}
            >
              {cartItem.qty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};