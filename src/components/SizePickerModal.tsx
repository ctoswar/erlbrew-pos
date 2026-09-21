import React from "react";
import { MenuItem, MenuItemSize, CartItemModifier } from "../types";
import { formatCurrency } from "../utils";

interface Props {
  item: MenuItem;
  onSelect: (item: MenuItem, size: MenuItemSize, modifiers?: CartItemModifier[]) => void;
  onClose: () => void;
}

/**
 * Shown when a menu item has sizes. User picks a size, then
 * the parent opens the modifier modal if needed.
 */
export const SizePickerModal: React.FC<Props> = ({ item, onSelect, onClose }) => {
  const sizes = (item.sizes || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const handlePick = (size: MenuItemSize) => {
    // Create a copy of the item with the size's price
    const sizedItem: MenuItem = { ...item, price: size.price };
    onSelect(sizedItem, size);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998] animate-fade-in-overlay" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="animate-scale-in w-full max-w-[320px] bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 text-center border-b border-erl-border-subtle">
            <div className="text-[13px] font-bold text-erl-text-primary mb-1">{item.name}</div>
            <div className="text-[11px] text-erl-text-muted">Choose a size</div>
          </div>

          {/* Size buttons */}
          <div className="px-5 py-4 flex flex-col gap-2.5">
            {sizes.map((size) => (
              <button
                key={size.label}
                onClick={() => handlePick(size)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-erl-border-subtle bg-erl-surface hover:bg-erl-accent/10 hover:border-erl-accent/30 transition-all cursor-pointer group"
              >
                <span className="text-[14px] font-bold text-erl-text-primary group-hover:text-erl-accent transition-colors">
                  {size.label}
                </span>
                <span className="font-display text-[15px] font-bold text-erl-accent">
                  {formatCurrency(size.price)}
                </span>
              </button>
            ))}
          </div>

          {/* Cancel */}
          <div className="px-5 pb-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-[12px] font-semibold text-erl-text-muted hover:text-erl-text-primary hover:bg-erl-surface transition-all cursor-pointer bg-transparent border-none"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
