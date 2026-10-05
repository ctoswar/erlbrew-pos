import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MenuItem, Modifier, CartItemModifier, MenuItemSize } from "../types";
import { formatCurrency } from "../utils";
import { getIconByEmoji } from "./FoodIcons";

interface Props {
  item: MenuItem;
  selectedSize?: MenuItemSize;
  onAdd: (item: MenuItem, modifiers: CartItemModifier[], selectedSize?: MenuItemSize) => void;
  onClose: () => void;
}

export const ModifierModal: React.FC<Props> = ({ item, selectedSize, onAdd, onClose }) => {
  const [selected, setSelected] = useState<CartItemModifier[]>([]);
  const modifiers = item.modifiers || [];
  const addOnTotal = selected.reduce((sum, modifier) => sum + modifier.price * (modifier.qty || 1), 0);
  const totalPrice = item.price + addOnTotal;
  const selectedCount = selected.reduce((sum, modifier) => sum + (modifier.qty || 1), 0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const getModifierQty = (modifier: Modifier): number => selected.find((entry) => entry.name === modifier.name)?.qty || 0;

  const updateModifierQty = (modifier: Modifier, delta: number) => {
    const existing = selected.find((entry) => entry.name === modifier.name);
    if (existing) {
      const nextQty = (existing.qty || 1) + delta;
      setSelected((current) => nextQty <= 0
        ? current.filter((entry) => entry.name !== modifier.name)
        : current.map((entry) => entry.name === modifier.name ? { ...entry, qty: nextQty } : entry));
    } else if (delta > 0) {
      setSelected((current) => [...current, { name: modifier.name, price: modifier.price, qty: 1 }]);
    }
  };

  const handleAdd = () => {
    onAdd(item, selected, selectedSize);
    onClose();
  };

  return createPortal(
    <div className="pos-option-layer">
      <button className="pos-option-backdrop" onClick={onClose} aria-label="Close customization" />
      <section className="pos-option-modal" role="dialog" aria-modal="true" aria-labelledby="modifier-modal-title">
        <div className="pos-option-topline" />
        <header className="pos-option-header">
          <div className="pos-option-title-row">
            <span className="pos-option-item-icon">{getIconByEmoji(item.emoji)}</span>
            <div className="min-w-0">
              <span className="pos-option-kicker">Customize your drink</span>
              <h2 id="modifier-modal-title">{item.name}</h2>
              <div className="pos-option-subtitle">{selectedSize ? `${selectedSize.label} · ` : ""}{formatCurrency(item.price)} base</div>
            </div>
          </div>
          <button onClick={onClose} className="pos-option-close" aria-label="Close customization">×</button>
        </header>

        <div className="pos-option-body">
          <div className="pos-option-section-heading">
            <div><span>Extras</span><small>{modifiers.length ? "Add as many as you like" : "No extras available"}</small></div>
            {selectedCount > 0 && <b>{selectedCount} selected</b>}
          </div>

          {modifiers.length === 0 ? (
            <div className="pos-option-empty">This item has no additional options.</div>
          ) : (
            <div className="pos-option-list">
              {modifiers.map((modifier) => {
                const quantity = getModifierQty(modifier);
                return (
                  <div key={modifier.id ?? modifier.name} className={`pos-option-row ${quantity > 0 ? "is-selected" : ""}`}>
                    <div className="min-w-0">
                      <div className="pos-option-row-name">{modifier.name}{modifier.isDefault && <span>Recommended</span>}</div>
                      <div className="pos-option-row-price">{modifier.price > 0 ? `+${formatCurrency(modifier.price)}` : "Included"}</div>
                    </div>
                    <div className="pos-option-stepper">
                      {quantity > 0 && <button onClick={() => updateModifierQty(modifier, -1)} aria-label={`Remove ${modifier.name}`}>−</button>}
                      {quantity > 0 && <strong>{quantity}</strong>}
                      <button onClick={() => updateModifierQty(modifier, 1)} aria-label={`Add ${modifier.name}`}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="pos-option-footer">
          <div className="pos-option-total"><span>Item total</span><strong>{formatCurrency(totalPrice)}</strong></div>
          <button className="pos-option-primary" onClick={handleAdd}>Add to cart <span aria-hidden="true">→</span></button>
          <button className="pos-option-secondary" onClick={onClose}>Cancel</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
