import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { MenuItem, MenuItemSize } from "../types";
import { apiAdminGet, apiAdminPut } from "../utils/api";
import { getIconByEmoji } from "./FoodIcons";
import { useLocation } from "../contexts/LocationContext";
import {
  getCompatibleUnits,
  defaultRecipeUnit,
  toInventoryUnit,
  fromInventoryUnit,
} from "../utils/units";

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
  const { currentLocationId } = useLocation();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Build a map of current recipe: inventory_id → quantity string (in display unit)
  const [selected, setSelected] = useState<Record<string, string>>({});
  // Track the display unit per inventory item (what the user sees/edits in)
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSizeId, setActiveSizeId] = useState(0);

  const sizeOptions: { id: number; label: string }[] = [
    { id: 0, label: "Base recipe" },
    ...((menuItem.sizes || []) as MenuItemSize[])
      .filter((size): size is MenuItemSize & { id: number } => Number.isInteger(size.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((size) => ({ id: size.id, label: size.label })),
  ];

  useEffect(() => {
    setLoading(true);
    setSelected({});
    setSelectedUnits({});
    Promise.all([
      apiAdminGet<RecipeIngredient[]>(`/recipes/${menuItem.id}?size_id=${activeSizeId}`),
      apiAdminGet<InventoryItem[]>("/inventory"),
    ])
      .then(([r, inv]) => {
        setInventory(inv);
        const init: Record<string, string> = {};
        const units: Record<string, string> = {};
        r.forEach((rec) => {
          // Determine a human-friendly display unit for this ingredient
          const invItem = inv.find((i) => i.id === rec.inventory_item_id);
          const invUnit = invItem?.unit || "pcs";
          const displayUnit = defaultRecipeUnit(invUnit);
          // Convert stored DB quantity (in inventory unit) to the display unit
          const displayQty = fromInventoryUnit(rec.quantity, invUnit, displayUnit);
          init[rec.inventory_item_id] = String(
            displayQty === rec.quantity ? rec.quantity : displayQty,
          );
          units[rec.inventory_item_id] = displayUnit;
        });
        setSelected(init);
        setSelectedUnits(units);
      })
      .catch((err) => {
        console.error("Failed to load recipe/inventory:", err);
        setError("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, [menuItem.id, currentLocationId, activeSizeId]);

  const [defaultQty, setDefaultQty] = useState("1");

  const handleToggle = (invId: string) => {
    setSelected((prev) => {
      if (prev[invId]) {
        const next = { ...prev };
        delete next[invId];
        return next;
      } else {
        return { ...prev, [invId]: defaultQty || "1" };
      }
    });
    // When first selecting, set a sensible default display unit
    setSelectedUnits((prev) => {
      if (prev[invId]) return prev;
      const invItem = inventory.find((i) => i.id === invId);
      if (!invItem) return prev;
      return { ...prev, [invId]: defaultRecipeUnit(invItem.unit) };
    });
  };

  const handleUnitChange = (invId: string, newUnit: string) => {
    const invItem = inventory.find((i) => i.id === invId);
    if (!invItem) return;
    const oldUnit = selectedUnits[invId] || invItem.unit;
    const oldQty = parseFloat(selected[invId]) || 0;
    // Convert the current quantity from old display unit to new display unit
    const converted = oldUnit === newUnit
      ? oldQty
      : (() => {
          // Convert oldUnit → inventoryUnit → newUnit
          const inInvUnit = toInventoryUnit(oldQty, oldUnit, invItem.unit);
          return oldUnit === invItem.unit
            ? oldQty // already in inventory unit
            : fromInventoryUnit(inInvUnit, invItem.unit, newUnit);
        })();
    setSelected((prev) => ({ ...prev, [invId]: String(converted || oldQty) }));
    setSelectedUnits((prev) => ({ ...prev, [invId]: newUnit }));
  };

  const handleSelectCategory = (catItems: InventoryItem[]) => {
    setSelected((prev) => {
      const next = { ...prev };
      const allChecked = catItems.every((i) => next[i.id]);
      if (allChecked) {
        catItems.forEach((i) => delete next[i.id]);
      } else {
        catItems.forEach((i) => { if (!next[i.id]) next[i.id] = defaultQty || "1"; });
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allVisible = grouped.flatMap((g) => g.items);
    setSelected((prev) => {
      const next = { ...prev };
      const allChecked = allVisible.every((i) => next[i.id]);
      if (allChecked) {
        allVisible.forEach((i) => delete next[i.id]);
      } else {
        allVisible.forEach((i) => { if (!next[i.id]) next[i.id] = defaultQty || "1"; });
      }
      return next;
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
        .map(([inventory_item_id, displayQtyStr]) => {
          const displayQty = parseFloat(displayQtyStr);
          const displayUnit = selectedUnits[inventory_item_id];
          const invItem = inventory.find((i) => i.id === inventory_item_id);
          const invUnit = invItem?.unit || "pcs";
          // Convert from display unit → inventory native unit for DB storage
          const dbQty = toInventoryUnit(displayQty, displayUnit || invUnit, invUnit);
          return { inventory_item_id, quantity: dbQty };
        });

      await apiAdminPut(`/recipes/${menuItem.id}`, { items, size_id: activeSizeId, location_id: currentLocationId });
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
  const stockSummary = useMemo(() => ({
    low: inventory.filter((item) => item.stock > 0 && item.stock <= (item.low_stock_threshold || 10)).length,
    out: inventory.filter((item) => item.stock <= 0).length,
  }), [inventory]);

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

  const allVisibleSelected = useMemo(() => {
    const allVisible = grouped.flatMap((g) => g.items);
    return allVisible.length > 0 && allVisible.every((i) => selected[i.id]);
  }, [grouped, selected]);

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock <= 0) return "out";
    if (item.stock <= (item.low_stock_threshold || 10)) return "low";
    return "ok";
  };

  return createPortal(
    (
    <div className="ingredient-editor-backdrop fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5">
      <div className="ingredient-editor-modal relative z-[1001] animate-scale-in card-glass w-full max-w-[1000px] max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="ingredient-editor-header flex justify-between items-start px-6 py-4 border-b border-erl-border-subtle flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 flex items-center justify-center text-erl-text-secondary">{getIconByEmoji(menuItem.emoji)}</span>
              <div className="min-w-0">
                <div className="font-display text-base font-bold text-erl-text-primary truncate">
                  {menuItem.name}
                </div>
                <div className="text-[12px] text-erl-text-muted mt-0.5">
                  {menuItem.category} · {menuItem.price > 0 ? `₱${menuItem.price.toFixed(2)}` : ""} · {sizeOptions.find((size) => size.id === activeSizeId)?.label}
                </div>
              </div>
            </div>
            <div className="ingredient-editor-meta">
              <span className="ingredient-editor-count">{selectedCount}</span>
              <span>selected ingredient{selectedCount !== 1 ? "s" : ""}</span>
              <span className="ingredient-editor-meta-divider">·</span>
              <span>{inventory.length} available</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-text-primary hover:bg-erl-surface transition-colors cursor-pointer bg-transparent border-none text-base ml-4"
          >
            ✕
          </button>
        </div>

        {sizeOptions.length > 1 && (
          <div className="ingredient-profile-bar px-6 pt-3.5 flex-shrink-0">
            <div className="ingredient-section-label">Recipe profile</div>
            <div className="ingredient-size-tabs">
              {sizeOptions.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setActiveSizeId(size.id)}
                  className={`ingredient-size-tab ${activeSizeId === size.id ? "is-active" : ""}`}
                >
                  <span>{size.label}</span>
                  {size.id === 0 && <span className="text-[9px] opacity-60">fallback</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Search ──────────────────────────────────────────── */}
        <div className="ingredient-editor-toolbar px-6 pt-3 flex-shrink-0">
          <div className="relative flex-1">
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
          <div className="ingredient-toolbar-footer mt-2">
            <div className="ingredient-inventory-summary">
              <span>{searchQuery ? `${filteredTotal} result${filteredTotal !== 1 ? "s" : ""}` : `${inventory.length} inventory items`}</span>
              {stockSummary.low > 0 && <span className="ingredient-stock-warning">{stockSummary.low} low</span>}
              {stockSummary.out > 0 && <span className="ingredient-stock-danger">{stockSummary.out} out</span>}
            </div>
            {filteredTotal > 0 && (
              <div className="ingredient-bulk-controls">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-erl-text-muted">Default qty</span>
                  <input
                    type="number"
                    value={defaultQty}
                    onChange={(e) => setDefaultQty(e.target.value)}
                    min="0.01"
                    step="0.1"
                    className="w-[48px] !px-1.5 !py-0.5 !text-[11px] !text-center !rounded-md"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <button
                  onClick={handleSelectAll}
                  className="ingredient-select-all"
                >
                  {allVisibleSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div className="scroll-area ingredient-editor-body flex-1 px-6 py-3 overflow-y-auto min-h-0">
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
              <div key={cat} className="ingredient-category mb-4 last:mb-0">
                <div className="ingredient-category-header">
                  <div className="ingredient-category-title">
                    <span className="ingredient-category-dot" />
                    <span>{cat}</span>
                    <span className="ingredient-category-count">{items.length}</span>
                  </div>
                  <div className="flex-1 h-px bg-erl-border-subtle" />
                  <button
                    onClick={() => handleSelectCategory(items)}
                    className="ingredient-category-action"
                  >
                    {items.every((i) => selected[i.id]) ? "Deselect" : "Select"}
                  </button>
                </div>
                <div className="ingredient-items-grid">
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
                          ingredient-item-row flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer
                          ${isChecked
                            ? "is-selected"
                            : ""
                          }
                        `}
                        onClick={() => handleToggle(inv.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(inv.id)}
                          className="ingredient-checkbox w-4 h-4 accent-erl-accent flex-shrink-0 cursor-pointer"
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
                        {isChecked && (() => {
                          const compatUnits = getCompatibleUnits(inv.unit);
                          const currentUnit = selectedUnits[inv.id] || defaultRecipeUnit(inv.unit);
                          const showDropdown = compatUnits.length > 1;
                          return (
                            <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[11px] text-erl-text-faint">Qty</span>
                              <input
                                type="number"
                                value={qty}
                                onChange={(e) => handleQtyChange(inv.id, e.target.value)}
                                min="0.01"
                                step="0.1"
                                className="w-[56px] !px-2 !py-1.5 !text-[13px] !text-center !rounded-lg"
                              />
                              {showDropdown ? (
                                <select
                                  value={currentUnit}
                                  onChange={(e) => handleUnitChange(inv.id, e.target.value)}
                                  className="!text-[11px] !py-1.5 !px-1 !rounded-lg !bg-erl-surface border border-erl-border-subtle text-erl-text-secondary cursor-pointer min-w-[44px]"
                                >
                                  {compatUnits.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-[11px] text-erl-text-faint min-w-[28px]">{inv.unit}</span>
                              )}
                              {showDropdown && inv.unit !== currentUnit && (
                                <span className="text-[9px] text-erl-text-faint italic" title={`Stored in inventory as ${inv.unit}`}>
                                  ({inv.unit})
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
    ),
    document.body,
  );
};