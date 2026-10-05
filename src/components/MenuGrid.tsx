import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CartItem, CartItemModifier, MenuItem, MenuItemSize } from "../types";
import { formatCurrency } from "../utils";
import { apiGet } from "../utils/api";
import { cacheMenuItems, getCachedMenuItems } from "../utils/offlineDb";
import { ModifierModal } from "./ModifierModal";
import { SizePickerModal } from "./SizePickerModal";
import { getIconByEmoji } from "./FoodIcons";

interface Props {
  cart: CartItem[];
  onAddItem: (item: MenuItem, modifiers?: CartItemModifier[], selectedSize?: MenuItemSize) => void;
}

const normalizeMenuItems = (items: MenuItem[]): MenuItem[] => items.map((item) => ({
  ...item,
  price: Number(item.price) || 0,
  popular: Boolean(item.popular),
  modifiers: (item.modifiers || []).map((modifier) => ({
    ...modifier,
    price: Number(modifier.price) || 0,
  })),
}));

export const MenuGrid: React.FC<Props> = ({ cart, onAddItem }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [sizeItem, setSizeItem] = useState<MenuItem | null>(null);
  const [pendingSize, setPendingSize] = useState<MenuItemSize | null>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (activeCategory && tabRefs.current.has(activeCategory)) {
      tabRefs.current.get(activeCategory)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeCategory]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<MenuItem[]>("/menu")
      .then((data) => {
        if (cancelled) return;
        const items = normalizeMenuItems(data);
        setMenuItems(items);
        setActiveCategory((current) => current || items[0]?.category || "");
        cacheMenuItems(items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          badge: item.badge,
          description: item.description,
          emoji: item.emoji,
          available: true,
        }))).catch(() => undefined);
      })
      .catch(async () => {
        const cached = await getCachedMenuItems();
        if (cancelled) return;
        const items: MenuItem[] = cached.map((item) => ({ ...item, popular: false, modifiers: [] }));
        setMenuItems(items);
        setActiveCategory((current) => current || items[0]?.category || "");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => [...new Set(menuItems.map((item) => item.category))], [menuItems]);
  const visibleItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = Boolean(query) || !activeCategory || item.category === activeCategory;
      const matchesSearch = !query || [item.name, item.category, item.description].some((value) => value.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, deferredSearch, menuItems]);

  const cartById = useMemo(() => new Map(cart.map((item) => [item.item.id, item])), [cart]);
  const categoryCount = (category: string) => menuItems.filter((item) => item.category === category).length;

  const openItem = (item: MenuItem) => {
    if (item.sizes && item.sizes.length > 0) setSizeItem(item);
    else if (item.modifiers && item.modifiers.length > 0) setModifierItem(item);
    else onAddItem(item);
  };

  return (
    <div className="pos-menu-browser">
      <div className="pos-menu-toolbar">
        <div className="pos-menu-heading">
          <span className="pos-menu-eyebrow">Quick service</span>
          <div className="flex items-baseline gap-2.5">
            <h1>Build an order</h1>
            <span className="pos-menu-result-count">{visibleItems.length} items</span>
          </div>
        </div>
        <label className="pos-menu-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu…" aria-label="Search menu" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear menu search">×</button>}
        </label>
      </div>

      <div className="pos-category-rail hide-scrollbar" role="tablist" aria-label="Menu categories">
        {categories.map((category) => (
          <button
            key={category}
            ref={(element) => { if (element) tabRefs.current.set(category, element); else tabRefs.current.delete(category); }}
            onClick={() => { setActiveCategory(category); setSearch(""); }}
            className={`pos-category-pill ${activeCategory === category && !search ? "is-active" : ""}`}
            role="tab"
            aria-selected={activeCategory === category && !search}
          >
            {category}<span>{categoryCount(category)}</span>
          </button>
        ))}
      </div>

      <div className="pos-menu-scroll scroll-area">
        {loading ? (
          <div className="pos-menu-grid" aria-label="Loading menu" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="pos-menu-skeleton"><span /><span /><span /></div>)}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="pos-menu-empty">
            <div className="pos-menu-empty-icon">⌕</div>
            <h2>No menu items found</h2>
            <p>{search ? `Nothing matches “${search}”.` : "There are no items in this category yet."}</p>
            {search && <button onClick={() => setSearch("")} className="btn btn-ghost mt-2 px-4 py-2 text-[11px]">Clear search</button>}
          </div>
        ) : (
          <div className="pos-menu-grid" aria-live="polite">
            {visibleItems.map((item, index) => (
              <MenuCard
                key={item.id}
                item={item}
                cartItem={cartById.get(item.id)}
                index={index}
                onOpenModal={openItem}
              />
            ))}
          </div>
        )}
      </div>

      {modifierItem && (
        <ModifierModal
          item={modifierItem}
          selectedSize={pendingSize || undefined}
          onAdd={(item, modifiers, selectedSize) => { onAddItem(item, modifiers, selectedSize); setModifierItem(null); setPendingSize(null); }}
          onClose={() => { setModifierItem(null); setPendingSize(null); }}
        />
      )}
      {sizeItem && (
        <SizePickerModal
          item={sizeItem}
          onSelect={(sizedItem, size) => {
            setSizeItem(null);
            if (sizedItem.modifiers && sizedItem.modifiers.length > 0) { setPendingSize(size); setModifierItem(sizedItem); }
            else onAddItem(sizedItem, undefined, size);
          }}
          onClose={() => setSizeItem(null)}
        />
      )}
    </div>
  );
};

interface MenuCardProps {
  item: MenuItem;
  cartItem?: CartItem;
  index: number;
  onOpenModal: (item: MenuItem) => void;
}

const MenuCard: React.FC<MenuCardProps> = React.memo(({ item, cartItem, index, onOpenModal }) => {
  const hasImage = Boolean(item.image);
  const modifiers = item.modifiers || [];
  const sizes = item.sizes || [];
  const hasOptions = modifiers.length > 0 || sizes.length > 0;
  const priceLabel = sizes.length > 1
    ? `${formatCurrency(Math.min(...sizes.map((size) => size.price)))} – ${formatCurrency(Math.max(...sizes.map((size) => size.price)))}`
    : formatCurrency(sizes[0]?.price ?? item.price);

  return (
    <article className={`pos-menu-card ${cartItem ? "is-in-cart" : ""}`} style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }} onClick={() => onOpenModal(item)}>
      {hasImage && <div className="pos-menu-image"><img src={item.image} alt="" loading="lazy" decoding="async" /><div className="pos-menu-image-shade" /></div>}
      <div className="pos-menu-card-body">
        <div className="pos-menu-card-topline">
          <span className="pos-menu-item-icon">{getIconByEmoji(item.emoji)}</span>
          {item.popular && <span className="pos-menu-popular"><i /> Popular</span>}
        </div>
        <div className="pos-menu-card-name">{item.name}</div>
        <div className="pos-menu-card-meta">
          {item.description ? item.description : sizes.length > 0 ? `${sizes.length} size option${sizes.length > 1 ? "s" : ""}` : "Ready to serve"}
        </div>
        <div className="pos-menu-card-bottom">
          <div><span className="pos-menu-price">{priceLabel}</span>{sizes.length > 1 && <span className="pos-menu-size-note">sizes</span>}</div>
          <button className="pos-menu-add" onClick={(event) => { event.stopPropagation(); onOpenModal(item); }} aria-label={`${hasOptions ? "Customize" : "Add"} ${item.name}`}>
            {cartItem && <b>{cartItem.qty}</b>}
            <span>{hasOptions ? "Customize" : "Add"}</span><span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </article>
  );
});

MenuCard.displayName = "MenuCard";
