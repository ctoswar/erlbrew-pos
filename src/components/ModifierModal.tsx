import React, { useState } from "react";
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

  const updateModifierQty = (mod: Modifier, delta: number) => {
    const existing = selected.find(m => m.name === mod.name);
    if (existing) {
      const newQty = (existing.qty || 1) + delta;
      if (newQty <= 0) {
        // Remove modifier if qty reaches 0
        setSelected(prev => prev.filter(m => m.name !== mod.name));
      } else {
        // Update quantity
        setSelected(prev =>
          prev.map(m => m.name === mod.name ? { ...m, qty: newQty } : m)
        );
      }
    } else if (delta > 0) {
      // Add new modifier with qty 1
      setSelected(prev => [...prev, { name: mod.name, price: mod.price, qty: 1 }]);
    }
  };

  const getModifierQty = (mod: Modifier): number => {
    const existing = selected.find(m => m.name === mod.name);
    return existing?.qty || 0;
  };

  const totalPrice = item.price + selected.reduce((s, m) => s + (m.price * (m.qty || 1)), 0);

  const handleAdd = () => {
    onAdd(item, selected, selectedSize);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="animate-scale-in card-glass p-6 w-full max-w-[360px] max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display text-base font-bold text-erl-text-primary">
                <span className="w-4 h-4 flex items-center justify-center">{getIconByEmoji(item.emoji)}</span> {item.name}
              </div>
              <div className="text-[11px] text-erl-accent mt-0.5 font-semibold">
                {formatCurrency(item.price)} base
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost text-base min-w-[44px] min-h-[44px] flex items-center justify-center text-erl-muted">✕</button>
          </div>

          {/* Modifier list */}
          {modifiers.length === 0 ? (
            <div className="text-center text-erl-muted text-xs py-4">
              No modifiers available for this item.
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {modifiers.map((mod) => {
                const qty = getModifierQty(mod);
                return (
                  <div key={mod.id}
                    className={`
                      flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-150
                      ${qty > 0 ? "bg-erl-accent/10 border-[1.5px] border-erl-accent" : "bg-erl-surface border-[1.5px] border-erl-border-default"}
                    `}>
                    {/* Modifier info */}
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-erl-text-primary">
                        {mod.name}
                        {mod.isDefault && (
                          <span className="pill pill-gold ml-1.5 text-[7px] px-1 py-px tracking-wide">DEFAULT</span>
                        )}
                      </div>
                      <div className="text-[11px] font-semibold text-erl-accent">
                        {mod.price > 0 ? `+${formatCurrency(mod.price)}` : "Free"}
                      </div>
                    </div>

                    {/* Quantity stepper */}
                    <div className="flex items-center gap-1">
                      {qty > 0 && (
                        <>
                          <button
                            onClick={() => updateModifierQty(mod, -1)}
                            className="w-7 h-7 rounded-lg bg-erl-surface border border-erl-border-default flex items-center justify-center text-erl-text-secondary hover:bg-erl-border-subtle transition-colors"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-erl-text-primary">
                            {qty}
                          </span>
                        </>
                      )}
                      <button
                        onClick={() => updateModifierQty(mod, 1)}
                        className="w-7 h-7 rounded-lg bg-erl-accent text-erl-base flex items-center justify-center font-bold hover:bg-erl-accent/90 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total + Add button */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline py-2 border-t border-erl-border-subtle">
              <span className="text-[10px] text-erl-secondary tracking-wider uppercase font-bold">
                Item Total
              </span>
              <span className="font-display text-lg font-bold text-erl-accent">
                {formatCurrency(totalPrice)}
              </span>
            </div>
            <button className="btn btn-accent w-full py-2.5" onClick={handleAdd}>
              Add to Cart
            </button>
            <button onClick={onClose} className="btn btn-outline w-full text-[10px] py-2.5">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
