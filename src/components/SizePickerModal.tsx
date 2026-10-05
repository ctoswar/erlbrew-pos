import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { MenuItem, MenuItemSize, CartItemModifier } from "../types";
import { formatCurrency } from "../utils";
import { getIconByEmoji } from "./FoodIcons";

interface Props {
  item: MenuItem;
  onSelect: (item: MenuItem, size: MenuItemSize, modifiers?: CartItemModifier[]) => void;
  onClose: () => void;
}

export const SizePickerModal: React.FC<Props> = ({ item, onSelect, onClose }) => {
  const sizes = [...(item.sizes || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  return createPortal(
    <div className="pos-option-layer">
      <button className="pos-option-backdrop" onClick={onClose} aria-label="Close size selection" />
      <section className="pos-option-modal pos-size-modal" role="dialog" aria-modal="true" aria-labelledby="size-modal-title">
        <div className="pos-option-topline" />
        <header className="pos-option-header">
          <div className="pos-option-title-row">
            <span className="pos-option-item-icon">{getIconByEmoji(item.emoji)}</span>
            <div className="min-w-0"><span className="pos-option-kicker">Choose your size</span><h2 id="size-modal-title">{item.name}</h2><div className="pos-option-subtitle">Select one to continue</div></div>
          </div>
          <button onClick={onClose} className="pos-option-close" aria-label="Close size selection">×</button>
        </header>
        <div className="pos-size-list">
          {sizes.map((size, index) => (
            <button key={size.label} onClick={() => onSelect({ ...item, price: size.price }, size)} className="pos-size-row" style={{ animationDelay: `${index * 35}ms` }}>
              <span><b>{size.label}</b><small>{index === 0 ? "Most popular" : "Available size"}</small></span>
              <strong>{formatCurrency(size.price)} <i aria-hidden="true">→</i></strong>
            </button>
          ))}
        </div>
        <footer className="pos-option-footer"><button className="pos-option-secondary" onClick={onClose}>Cancel</button></footer>
      </section>
    </div>,
    document.body,
  );
};
