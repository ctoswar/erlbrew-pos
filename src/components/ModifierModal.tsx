import React, { useState } from "react";
import { MenuItem, Modifier, CartItemModifier } from "../types";
import { formatCurrency } from "../utils";

interface Props {
  item: MenuItem;
  onAdd: (item: MenuItem, modifiers: CartItemModifier[]) => void;
  onClose: () => void;
}

export const ModifierModal: React.FC<Props> = ({ item, onAdd, onClose }) => {
  const [selected, setSelected] = useState<CartItemModifier[]>([]);

  const modifiers = item.modifiers || [];

  const toggleModifier = (mod: Modifier) => {
    const existing = selected.find(m => m.name === mod.name);
    if (existing) {
      setSelected(prev => prev.filter(m => m.name !== mod.name));
    } else {
      setSelected(prev => [...prev, { name: mod.name, price: mod.price }]);
    }
  };

  const isSelected = (mod: Modifier) =>
    selected.some(m => m.name === mod.name);

  const totalPrice = item.price + selected.reduce((s, m) => s + m.price, 0);

  const handleAdd = () => {
    onAdd(item, selected);
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
                {item.emoji} {item.name}
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
              {modifiers.map((mod) => (
                <button key={mod.id} onClick={() => toggleModifier(mod)}
                  className={`
                    flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-left transition-all duration-150
                    ${isSelected(mod) ? "bg-erl-accent/10 border-[1.5px] border-erl-accent" : "bg-erl-surface border-[1.5px] border-erl-border-default"}
                  `}>
                  <div className={`
                    w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] text-erl-sidebar
                    ${isSelected(mod) ? "bg-erl-accent border-[1.5px] border-erl-accent" : "bg-transparent border-[1.5px] border-erl-border-medium"}
                  `}>
                    {isSelected(mod) ? "✓" : ""}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-erl-text-primary">
                      {mod.name}
                      {mod.isDefault && (
                        <span className="pill pill-gold ml-1.5 text-[7px] px-1 py-px tracking-wide">DEFAULT</span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-erl-accent">
                    {mod.price > 0 ? `+${formatCurrency(mod.price)}` : "Free"}
                  </div>
                </button>
              ))}
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
