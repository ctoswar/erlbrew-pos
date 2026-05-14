import React, { useState, useEffect, useMemo } from "react";
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
  low_stock_threshold: number;
}

interface Props {
  menuItem: MenuItem;
  onClose: () => void;
}

export const IngredientEditor: React.FC<Props> = ({ menuItem, onClose }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Build a map of current recipe: inventory_id → quantity string
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    Promise.all([
      apiAdminGet<RecipeIngredient[]>(`/recipes/${menuItem.id}`),
      apiAdminGet<InventoryItem[]>("/inventory"),
    ])
      .then(([r, inv]) => {
        // Enrich with low_stock_threshold if available
        setInventory(inv);
        const init: Record<string, string> = {};
        r.forEach((rec) => { init[rec.inventory_item_id] = String(rec.quantity); });
        setSelected(init);
      })
      .catch((err) => {
        console.error("Failed to load recipe/inventory:", err);
        setError("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, [menuItem.id]);

  const handleToggle = (invId: string) => {
    setSelected((prev) => {
      if (prev[invId]) {
        const next = { ...prev };
        delete next[invId];
        return next;
      } else {
        return { ...prev, [invId]: "1" };
      }
    });
  };

  const handleQtyChange = (invId: string, val: string) => {
    setSelected((prev) => ({ ...prev, [invId]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const items = Object.entries(selected)
        .filter(([, qty]) => qty && parseFloat(qty) > 0)
        .map(([inventory_item_id, quantity]) => ({ inventory_item_id, quantity: parseFloat(quantity) }));

      await apiAdminPut(`/recipes/${menuItem.id}`, { items });
      onClose();
    } catch (err) {
      setError("Failed to save ingredients");
      console.error("Failed to save ingredients:", err);
    } finally {
      setSaving(false);
    }
  };

  // Selected count
  const selectedCount = useMemo(
    () => Object.values(selected).filter((q) => q && parseFloat(q) > 0).length,
    [selected]
  );

  // Group and filter inventory
  const { grouped, filteredTotal } = useMemo(() => {
    let items = inventory;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    const cats = [...new Set(items.map((i) => i.category))].sort();
    const groups = cats.map((cat) => ({
      cat,
      items: items.filter((i) => i.category === cat),
    }));
    return { grouped: groups, filteredTotal: items.length };
  }, [inventory, searchQuery]);

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock <= 0) return "out";
    if (item.stock <= (item.low_stock_threshold || 10)) return "low";
    return "ok";
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="animate-scale-in card-glass w-full max-w-[580px] max-h-[88vh] flex flex-col overflow-hidden rounded-2xl">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex justify-between items-start px-6 py-5 border-b border-erl-border-subtle flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-[24px] leading-none">{menuItem.emoji}</span>
              <div className="min-w-0">
                <div className="font-display text-base font-bold text-erl-text-primary truncate">
                  {menuItem.name}
                </div>
                <div className="text-[12px] text-erl-text-muted mt-0.5">
                  {menuItem.category} · {menuItem.price > 0 ? `₱${menuItem.price.toFixed(2)}` : ""}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="pill text-[10px] px-2 py-0.5 bg-erl-accent/10 text-erl-accent border border-erl-accent/20">
                {selectedCount} ingredient{selectedCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-text-primary hover:bg-erl-surface transition-colors cursor-pointer bg-transparent border-none text-base ml-4"
          >
            ✕
          </button>
        </div>

        {/* ── Search ──────────────────────────────────────────── */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-erl-text-faint text-sm pointer-events-none">⌕</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inventory items…"
              className="w-full box-border pl-9 !py-2.5 !text-[13px] !rounded-xl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-erl-text-faint hover:text-erl-text-primary transition-colors text-sm cursor-pointer bg-transparent border-none"
              >
                ✕
              </button>
            )}
          </div>
          <div className="text-[11px] text-erl-text-faint mt-1.5">
            {searchQuery ? `${filteredTotal} result${filteredTotal !== 1 ? "s" : ""}` : `${inventory.length} inventory items`}
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div className="scroll-area flex-1 px-6 py-3 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="animate-shimmer w-28 h-4 rounded-md" />
              <div className="animate-shimmer w-20 h-3 rounded-md" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2">
              <span className="text-2xl">📭</span>
              <div className="text-[13px] text-erl-text-disabled">
                {searchQuery ? "No items match your search" : "No inventory items available"}
              </div>
            </div>
          ) : (
            grouped.map(({ cat, items }) => (
              <div key={cat} className="mb-5 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-[11px] text-erl-text-faint tracking-wider uppercase font-bold">{cat}</div>
                  <div className="flex-1 h-px bg-erl-border-subtle" />
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((inv) => {
                    const isChecked = !!selected[inv.id];
                    const qty = selected[inv.id] || "";
                    const status = getStockStatus(inv);
                    const isLow = status === "low";
                    const isOut = status === "out";

                    return (
                      <div
                        key={inv.id}
                        className={`
                          flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 cursor-pointer
                          ${isChecked
                            ? "bg-erl-accent/10 border border-erl-accent/25"
                            : "border border-transparent hover:bg-erl-surface/80 hover:border-erl-border-subtle"
                          }
                        `}
                        onClick={() => handleToggle(inv.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(inv.id)}
                          className="w-4 h-4 accent-erl-accent flex-shrink-0 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-erl-text-primary truncate">{inv.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[11px] ${isOut ? "text-erl-danger font-semibold" : isLow ? "text-erl-accent font-medium" : "text-erl-text-faint"}`}>
                              {inv.stock} {inv.unit}
                              {isOut && <span className="ml-1">· OUT</span>}
                              {isLow && !isOut && <span className="ml-1">· LOW</span>}
                            </span>
                          </div>
                        </div>
                        {isChecked && (
                          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[11px] text-erl-text-faint">Qty</span>
                            <input
                              type="number"
                              value={qty}
                              onChange={(e) => handleQtyChange(inv.id, e.target.value)}
                              min="0.01"
                              step="0.1"
                              className="w-[64px] !px-2 !py-1.5 !text-[13px] !text-center !rounded-lg"
                            />
                            <span className="text-[11px] text-erl-text-faint">{inv.unit}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Error ──────────────────────────────────────────── */}
        {error && (
          <div className="mx-6 px-4 py-2.5 bg-erl-danger-bg border border-erl-danger-border rounded-xl text-[12px] text-erl-danger">
            {error}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex gap-3 px-6 py-4 border-t border-erl-border-subtle flex-shrink-0">
          <button onClick={onClose} className="btn btn-outline flex-1 text-[12px] py-2.5">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent flex-1 text-[12px] py-2.5">
            {saving ? "Saving…" : `Save Ingredients${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
};