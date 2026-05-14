import React, { useState, useEffect } from "react";
import { MenuItem } from "../types";
import { apiAdminGet, apiAdminPut } from "../utils/api";

interface RecipeIngredient {
  id: number;
  inventory_item_id: string;
  inventory_name: string;
  category: string;
  unit: string;
  stock: number;
  low_stock_threshold: number;
  quantity: number;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
}

interface Props {
  menuItem: MenuItem;
  onClose: () => void;
}

export const IngredientEditor: React.FC<Props> = ({ menuItem, onClose }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Build a map of current recipe: inventory_id → quantity
  const [selected, setSelected] = useState<Record<string, string>>({}); // inv_id → quantity string

  useEffect(() => {
    Promise.all([
      apiAdminGet<RecipeIngredient[]>(`/recipes/${menuItem.id}`),
      apiAdminGet<InventoryItem[]>("/inventory"),
    ])
      .then(([r, inv]) => {
        setInventory(inv);
        const init: Record<string, string> = {};
        r.forEach((rec) => { init[rec.inventory_item_id] = String(rec.quantity); });
        setSelected(init);
      })
      .catch((err) => console.error("Failed to load recipe/inventory:", err))
      .finally(() => setLoading(false));
  }, [menuItem.id]);

  const handleToggle = (invId: string) => {
    setSelected((prev) => {
      if (prev[invId]) {
        // Remove
        const next = { ...prev };
        delete next[invId];
        return next;
      } else {
        // Add with default qty 1
        return { ...prev, [invId]: "1" };
      }
    });
  };

  const handleQtyChange = (invId: string, val: string) => {
    setSelected((prev) => ({ ...prev, [invId]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = Object.entries(selected)
        .filter(([, qty]) => qty && parseFloat(qty) > 0)
        .map(([inventory_item_id, quantity]) => ({ inventory_item_id, quantity: parseFloat(quantity) }));

      await apiAdminPut(`/recipes/${menuItem.id}`, { items });
      onClose();
    } catch (err) { console.error("Failed to save ingredients:", err); }
    finally { setSaving(false); }
  };

  // Group inventory by category
  const categories = [...new Set(inventory.map((i) => i.category))].sort();
  const grouped = categories.map((cat) => ({
    cat,
    items: inventory.filter((i) => i.category === cat),
  }));

  return (
    <div className="fixed inset-0 z-[1000] bg-black/75 flex items-center justify-center backdrop-blur-sm">
      <div className="card-glass animate-scale-in w-full max-w-[540px] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="glass-panel px-5 py-4 rounded-none flex justify-between items-center flex-shrink-0">
          <div>
            <div className="font-display text-sm font-bold text-erl-text-primary">
              Ingredients: {menuItem.name}
            </div>
            <div className="text-[10px] text-erl-accent mt-0.5 font-semibold">
              {menuItem.emoji} {menuItem.category} · ₱{menuItem.price}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost text-lg px-2 py-0.5 text-erl-muted">✕</button>
        </div>

        {/* Body */}
        <div className="scroll-area flex-1 px-5 py-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-shimmer w-[140px] h-3.5 rounded mx-auto mb-2" />
              <div className="animate-shimmer w-24 h-2.5 rounded mx-auto" />
            </div>
          ) : (
            <>
              <div className="text-[9px] text-erl-accent-muted tracking-widest uppercase font-bold mb-3">
                Check items used per serving
              </div>

              {grouped.map(({ cat, items }) => (
                <div key={cat} className="mb-4">
                  <div className="text-[9px] text-erl-text-faint tracking-wide uppercase mb-1.5">{cat}</div>
                  <div className="flex flex-col gap-[5px]">
                    {items.map((inv) => {
                      const isChecked = !!selected[inv.id];
                      const qty = selected[inv.id] || "";
                      const isLow = inv.stock <= 3;

                      return (
                        <div key={inv.id} className={`
                          flex items-center gap-2.5 px-3 py-2 rounded-lg
                          ${isChecked ? "bg-erl-accent/8 border border-erl-accent/30" : "bg-transparent border border-erl-border-subtle"}
                        `}>
                          <input type="checkbox" checked={isChecked}
                            onChange={() => handleToggle(inv.id)}
                            className="w-4 h-4 accent-erl-accent flex-shrink-0" />
                          <div className="flex-1">
                            <div className="text-[11px] font-bold text-erl-text-primary">{inv.name}</div>
                            <div className={`pill text-[8px] bg-transparent p-0 tracking-wide ${isLow ? "text-erl-danger" : "text-erl-text-faint"}`}>
                              Stock: {inv.stock} {inv.unit}
                              {isLow && " ⚠ LOW"}
                            </div>
                          </div>
                          {isChecked && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-[9px] text-erl-text-faint">per serving:</span>
                              <input type="number" value={qty}
                                onChange={(e) => handleQtyChange(inv.id, e.target.value)}
                                min="0.01" step="0.1"
                                className="w-[60px] px-1.5 py-1 rounded-md text-[11px] text-center" />
                              <span className="text-[9px] text-erl-text-faint">{inv.unit}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="glass-panel px-5 py-3.5 rounded-none flex gap-2.5 justify-end flex-shrink-0">
          <button onClick={onClose} className="btn btn-outline text-[10px] px-4.5 py-2">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent text-[10px] px-4.5 py-2">
            {saving ? "Saving..." : "Save Ingredients"}
          </button>
        </div>
      </div>
    </div>
  );
};
