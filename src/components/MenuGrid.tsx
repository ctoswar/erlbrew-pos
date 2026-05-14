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

  const handleItemTap = (item: MenuItem, mods?: CartItemModifier[]) => {
    onAddItem(item, mods);
  };

  const openModifierModal = (item: MenuItem) => {
    setModifierItem(item);
  };

  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);

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
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Category Tabs */}
      <div className="hide-scrollbar flex gap-2 px-6 pt-5 pb-3 flex-shrink-0 overflow-x-auto">
        {categories.map((cat: string) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`
              px-5 py-2.5 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase
              whitespace-nowrap flex-shrink-0 cursor-pointer transition-all duration-250 ease-out
              ${
                activeCategory === cat
                  ? "bg-erl-accent text-erl-base shadow-[0_4px_16px_rgba(196,149,106,0.3)]"
                  : "bg-transparent text-erl-text-muted border border-erl-border-default hover:border-erl-border-medium hover:text-erl-text-secondary hover:bg-erl-accent/[0.03]"
              }
            `}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="scroll-area flex-1 px-6 pb-6 pt-3 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-erl-accent/20 border-t-erl-accent rounded-full animate-spin" />
            <span className="text-sm text-erl-text-muted tracking-wide">Loading menu...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-erl-accent/[0.04] border border-erl-accent/[0.08] flex items-center justify-center">
              <span className="text-3xl opacity-30">☕</span>
            </div>
            <span className="text-sm text-erl-text-muted tracking-wide">No items in this category</span>
          </div>
        ) : (
          <div className="menu-grid-root grid grid-cols-2 gap-4">
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
  const [pressed, setPressed] = useState(false);
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
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={`
        group flex flex-col overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ease-out
        ${
          cartItem
            ? "border-2 border-erl-accent/30 shadow-[0_0_0_1px_rgba(196,149,106,0.08),0_4px_20px_rgba(196,149,106,0.12)]"
            : hovered
            ? "border-2 border-erl-border-medium -translate-y-1 shadow-[0_12px_36px_rgba(0,0,0,0.45)]"
            : "border-2 border-erl-border-subtle shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
        }
        ${pressed ? "scale-[0.97]" : ""}
        ${hovered ? "bg-erl-elevated" : "bg-erl-surface"}
      `}
    >
      {/* Image */}
      {hasImage && (
        <div className="w-full h-[120px] overflow-hidden bg-erl-base relative">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.1]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-erl-surface/90 via-erl-surface/30 to-transparent pointer-events-none" />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-erl-accent/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          {/* Popular badge on image */}
          {item.popular && (
            <div className="absolute top-2.5 right-2.5">
              <span className="pill pill-accent text-[7px]">
                <span className="w-1.5 h-1.5 rounded-full bg-erl-accent animate-pulse mr-1" />
                Popular
              </span>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3.5 flex flex-col gap-2 flex-1">
        {/* Top row: emoji + name */}
        {!hasImage && (
          <div className="flex items-start justify-between">
            <span className="text-[26px] leading-none filter drop-shadow-sm">{item.emoji}</span>
            {item.popular && (
              <span className="pill pill-accent text-[7px]">
                <span className="w-1.5 h-1.5 rounded-full bg-erl-accent animate-pulse mr-1" />
                Popular
              </span>
            )}
          </div>
        )}

        {/* Name */}
        <div className="text-[14px] font-bold text-erl-text-primary leading-snug flex-1 font-display">
          {item.name}
        </div>

        {/* Description */}
        {item.description && (
          <div className="text-[10px] text-erl-text-secondary leading-relaxed line-clamp-2">
            {item.description}
          </div>
        )}

        {/* Bottom: price + qty */}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          <span className="font-display text-[16px] font-bold text-erl-accent tracking-tight">
            {formatCurrency(item.price)}
          </span>
          {cartItem && cartItem.qty > 0 && (
            <div className="bg-erl-accent text-erl-base rounded-xl min-w-[26px] h-7 flex items-center justify-center text-[11px] font-bold px-2 shadow-[0_2px_10px_rgba(196,149,106,0.3)]">
              {cartItem.qty}
            </div>
          )}
        </div>

        {/* Modifier indicator */}
        {modifiers.length > 0 && !cartItem && (
          <div className="text-[9px] text-erl-accent-dim tracking-wide font-medium">
            {modifiers.length} option{modifiers.length > 1 ? 's' : ''} available
          </div>
        )}
      </div>
    </div>
  );
};