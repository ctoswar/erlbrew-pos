import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { MenuItem, MenuItemSize } from "../types";
import { apiAdminGet, batchApplyIngredients, BatchApplyResult } from "../utils/api";
import { getIconByEmoji } from "./FoodIcons";
import { useLocation } from "../contexts/LocationContext";
import {
  getCompatibleUnits,
  getPackInfo,
  defaultRecipeUnit,
  toInventoryUnit,
  fromInventoryUnit,
} from "../utils/units";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  low_stock_threshold: number;
  /** Pack size: 1 pcs = pack_quantity pack_unit (e.g. 1000 ml) */
  pack_quantity?: number | string | null;
  pack_unit?: string | null;
}

interface Props {
  /** If provided, pre-fill with this item's ingredients */
  sourceItemId?: string;
  sourceItemName?: string;
  /** All menu items for selection */
  menuItems: MenuItem[];
  /** Current item to exclude from selection (optional) */
  excludeItemId?: string;
  /** Called when apply succeeds */
  onApplied: () => void;
  /** Close modal */
  onClose: () => void;
}

export const ApplyIngredientModal: React.FC<Props> = ({
  sourceItemId,
  sourceItemName,
  menuItems,
  excludeItemId,
  onApplied,
  onClose,
}) => {
  const { currentLocationId } = useLocation();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Record<string, string>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BatchApplyResult | null>(null);
  // Which recipe profile we're copying/applying: id is only used to fetch the
  // source recipe (size rows are per-item), label is what targets are matched
  // on. label === "" means the base (fallback) profile.
  const [profile, setProfile] = useState<{ id: number; label: string }>({ id: 0, label: "" });

  // Load inventory + source item's recipe for the selected profile
  useEffect(() => {
    const load = async () => {
      try {
        if (sourceItemId) setLoading(true);
        const inv = await apiAdminGet<InventoryItem[]>("/inventory");
        setInventory(inv);

        if (sourceItemId) {
          const recipe = await apiAdminGet<{ inventory_item_id: string; quantity: number }[]>(
            `/recipes/${sourceItemId}?size_id=${profile.id}`,
          );
          const init: Record<string, string> = {};
          const units: Record<string, string> = {};
          recipe.forEach((r) => {
            const invItem = inv.find((i) => i.id === r.inventory_item_id);
            const invUnit = invItem?.unit || "pcs";
            const pack = invItem ? getPackInfo(invItem) : null;
            const displayUnit = defaultRecipeUnit(invUnit, pack);
            const displayQty = fromInventoryUnit(r.quantity, invUnit, displayUnit, pack);
            init[r.inventory_item_id] = String(displayQty === r.quantity ? r.quantity : displayQty);
            units[r.inventory_item_id] = displayUnit;
          });
          setSelectedRecipe(init);
          setSelectedUnits(units);
        }
      } catch {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sourceItemId, currentLocationId, profile.id]);

  // Recipe profiles to offer: base + the size profiles available.
  // Copy mode → the source item's sizes (used to fetch its recipe).
  // Batch mode → the union of size labels across all menu items (applied by label).
  const profileOptions = useMemo(() => {
    const bySort = (a: MenuItemSize, b: MenuItemSize) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    const options: { id: number; label: string }[] = [{ id: 0, label: "" }]; // "" = base recipe
    if (sourceItemId) {
      const src = menuItems.find((i) => i.id === sourceItemId);
      (src?.sizes || [])
        .filter((s): s is MenuItemSize & { id: number } => Number.isInteger(s.id))
        .sort(bySort)
        .forEach((s) => options.push({ id: s.id, label: s.label }));
      return options;
    }
    const seen = new Set<string>();
    menuItems.forEach((i) =>
      [...(i.sizes || [])].sort(bySort).forEach((s) => {
        if (!seen.has(s.label)) {
          seen.add(s.label);
          options.push({ id: 0, label: s.label });
        }
      }),
    );
    return options;
  }, [menuItems, sourceItemId]);

  // Derive categories for menu items
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category).filter(Boolean))];
    cats.sort((a, b) => a.localeCompare(b));
    return ["All", ...cats];
  }, [menuItems]);

  // Filter menu items
  const filteredItems = useMemo(() => {
    let items = menuItems.filter(i => i.id !== excludeItemId);
    if (activeCategory !== "All") {
      items = items.filter(i => i.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, excludeItemId, activeCategory, searchQuery]);

  // Group inventory by category
  const inventoryGroups = useMemo(() => {
    const cats = [...new Set(inventory.map(i => i.category))].sort();
    return cats.map(cat => ({
      cat,
      items: inventory.filter(i => i.category === cat),
    }));
  }, [inventory]);

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleRecipeItem = (invId: string) => {
    setSelectedRecipe(prev => {
      if (prev[invId]) {
        const next = { ...prev };
        delete next[invId];
        return next;
      } else {
        return { ...prev, [invId]: "1" };
      }
    });
    setSelectedUnits(prev => {
      if (prev[invId]) return prev;
      const invItem = inventory.find((i) => i.id === invId);
      if (!invItem) return prev;
      return { ...prev, [invId]: defaultRecipeUnit(invItem.unit, getPackInfo(invItem)) };
    });
  };

  const handleQtyChange = (invId: string, val: string) => {
    setSelectedRecipe(prev => ({ ...prev, [invId]: val }));
  };

  const handleUnitChange = (invId: string, newUnit: string) => {
    const invItem = inventory.find((i) => i.id === invId);
    if (!invItem) return;
    const oldUnit = selectedUnits[invId] || invItem.unit;
    const oldQty = parseFloat(selectedRecipe[invId]) || 0;
    const pack = getPackInfo(invItem);
    const converted = oldUnit === newUnit
      ? oldQty
      : (() => {
          const inInvUnit = toInventoryUnit(oldQty, oldUnit, invItem.unit, pack);
          return oldUnit === invItem.unit
            ? oldQty
            : fromInventoryUnit(inInvUnit, invItem.unit, newUnit, pack);
        })();
    setSelectedRecipe(prev => ({ ...prev, [invId]: String(converted || oldQty) }));
    setSelectedUnits(prev => ({ ...prev, [invId]: newUnit }));
  };

  const recipeCount = useMemo(
    () => Object.values(selectedRecipe).filter((q) => q && parseFloat(q) > 0).length,
    [selectedRecipe]
  );

  const handleApply = async () => {
    if (recipeCount === 0) {
      setError("Select at least one ingredient");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Select at least one menu item to apply to");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const items = Object.entries(selectedRecipe)
        .filter(([, qty]) => qty && parseFloat(qty) > 0)
        .map(([inventory_item_id, displayQtyStr]) => {
          const displayQty = parseFloat(displayQtyStr);
          const displayUnit = selectedUnits[inventory_item_id];
          const invItem = inventory.find((i) => i.id === inventory_item_id);
          const invUnit = invItem?.unit || "pcs";
          const pack = invItem ? getPackInfo(invItem) : null;
          const dbQty = toInventoryUnit(displayQty, displayUnit || invUnit, invUnit, pack);
          return { inventory_item_id, quantity: dbQty };
        });

      const res = await batchApplyIngredients(
        items,
        Array.from(selectedIds),
        currentLocationId,
        profile.label || undefined,
      );
      setResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Failed to apply ingredients");
    } finally {
      setSaving(false);
    }
  };

  // Show result
  if (result) {
    return createPortal(
      (
      <>
        <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={onClose} />
        <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
          <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="text-center mb-4">
              <div className="text-[28px] mb-2">✅</div>
              <div className="font-display text-[15px] font-bold text-erl-text-primary">
                Ingredients Applied!
              </div>
            </div>
            <div className="bg-erl-surface rounded-xl p-4 mb-4">
              <div className="text-[11px] text-erl-text-muted mb-2">
                <span className="font-semibold text-erl-accent">{recipeCount} ingredient{recipeCount !== 1 ? "s" : ""}</span> applied to:
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-erl-accent">{result.applied}</div>
                <div className="text-[10px] text-erl-text-faint">menu item{result.applied !== 1 ? "s" : ""}</div>
                <div className="text-[10px] text-erl-text-muted mt-1.5">
                  profile:{" "}
                  <span className="font-semibold text-erl-text-secondary">
                    {result.sizeLabel === "base" || !result.sizeLabel ? "Base recipe" : result.sizeLabel}
                  </span>
                </div>
                {!!result.toSize && (
                  <div className="text-[10px] text-erl-text-faint">{result.toSize} in the {result.sizeLabel} size</div>
                )}
                {!!result.toBase && (
                  <div className="text-[10px] text-erl-text-faint">
                    {result.toBase} in base{result.sizeLabel !== "base" ? " (no matching size)" : ""}
                  </div>
                )}
                {!!result.skipped && (
                  <div className="text-[10px] text-erl-accent mt-1">
                    {result.skipped} skipped — no “{result.sizeLabel}” size:{" "}
                    {(result.skippedItems || [])
                      .slice(0, 3)
                      .map((id) => menuItems.find((m) => m.id === id)?.name || id)
                      .join(", ")}
                    {(result.skippedItems || []).length > 3 ? ` +${(result.skippedItems || []).length - 3} more` : ""}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => { onApplied(); onClose(); }} className="btn btn-accent w-full py-2.5">
              Done
            </button>
          </div>
        </div>
      </>
      ),
      document.body,
    );
  }

  return createPortal(
    (
    <>
      <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display text-[15px] font-bold text-erl-text-primary">
                🧪 {sourceItemName ? `Copy "${sourceItemName}" Ingredients` : "Batch Apply Ingredients"}
              </div>
              <div className="text-[10px] text-erl-muted mt-0.5">
                {sourceItemName
                  ? `Apply these ingredients to other menu items`
                  : "Pick ingredients and apply to multiple items at once"
                }
              </div>
            </div>
            <button onClick={onClose} className="bg-none border-none text-erl-muted text-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center">✕</button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-[11px] text-erl-danger">
              {error}
            </div>
          )}

          {/* ── Step 1: Pick Ingredients ────────────────────── */}
          <div className="mb-4">
            <div className="text-[11px] font-bold text-erl-secondary tracking-wide mb-2">
              STEP 1: PICK INGREDIENTS ({recipeCount} selected)
            </div>

            {/* Recipe profile (size) selector */}
            {profileOptions.length > 1 && (
              <div className="mb-2.5">
                <div className="text-[9px] font-bold text-erl-text-faint tracking-wider uppercase mb-1.5">
                  Recipe profile{sourceItemName ? ` · ${sourceItemName}` : ""}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {profileOptions.map((o) => {
                    const isActive = o.id === profile.id && o.label === profile.label;
                    return (
                      <button
                        key={`${o.id}:${o.label}`}
                        onClick={() => setProfile(o)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-all border
                          ${isActive
                            ? "bg-erl-accent text-erl-base border-erl-accent"
                            : "bg-erl-surface/60 text-erl-text-secondary border-erl-border-default hover:bg-erl-elevated"}`}
                      >
                        {o.label || "Base recipe"}
                        {!o.label && profileOptions.length > 1 && (
                          <span className="ml-1 text-[8px] opacity-60">fallback</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {profile.label && (
                  <div className="text-[9px] text-erl-text-faint mt-1">
                    Applies the ingredients to the “{profile.label}” size of each selected item — items without that
                    size are skipped.
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="animate-shimmer w-28 h-4 rounded-md" />
                <div className="animate-shimmer w-20 h-3 rounded-md" />
              </div>
            ) : (
              <div className="border-[1.5px] border-erl-border-medium rounded-[10px] bg-erl-surface max-h-[200px] overflow-y-auto">
                {inventoryGroups.map(({ cat, items }) => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-erl-text-faint tracking-wider uppercase bg-erl-elevated/50 sticky top-0">
                      {cat}
                    </div>
                    {items.map((inv) => {
                      const isChecked = !!selectedRecipe[inv.id];
                      const qty = selectedRecipe[inv.id] || "";
                      return (
                        <div
                          key={inv.id}
                          className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all border-b border-erl-border-subtle/30 last:border-b-0
                            ${isChecked ? "bg-erl-accent/8" : "hover:bg-erl-elevated/50"}`}
                          onClick={() => toggleRecipeItem(inv.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRecipeItem(inv.id)}
                            className="w-4 h-4 accent-erl-accent flex-shrink-0 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-semibold text-erl-text-primary truncate">{inv.name}</div>
                            <div className="text-[9px] text-erl-text-faint">{inv.stock} {inv.unit}</div>
                          </div>
                          {isChecked && (() => {
                            const pack = getPackInfo(inv);
                            const compatUnits = getCompatibleUnits(inv.unit, pack);
                            const currentUnit = selectedUnits[inv.id] || defaultRecipeUnit(inv.unit, pack);
                            const showDropdown = compatUnits.length > 1;
                            const packHint = pack
                              ? `1 ${inv.unit} = ${pack.quantity} ${pack.unit}`
                              : inv.unit === "pcs"
                                ? "No conversion set — add “1 pcs = …” on the item in Admin → Inventory"
                                : undefined;
                            return (
                              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  value={qty}
                                  onChange={(e) => handleQtyChange(inv.id, e.target.value)}
                                  min="0.01"
                                  step="0.1"
                                  className="w-[48px] !px-1.5 !py-1 !text-[11px] !text-center !rounded-md"
                                />
                                {showDropdown ? (
                                  <select
                                    value={currentUnit}
                                    onChange={(e) => handleUnitChange(inv.id, e.target.value)}
                                    className="!text-[9px] !py-1 !px-0.5 !rounded-md !bg-erl-surface border border-erl-border-subtle text-erl-text-secondary cursor-pointer min-w-[36px]"
                                    title={packHint}
                                  >
                                    {compatUnits.map((u) => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[9px] text-erl-text-faint" title={packHint}>{inv.unit}</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Step 2: Pick Menu Items ─────────────────────── */}
          <div className="mb-4">
            <div className="text-[11px] font-bold text-erl-secondary tracking-wide mb-2">
              STEP 2: APPLY TO ({selectedIds.size} selected)
            </div>

            {/* Search + Category */}
            <div className="mb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu items…"
                className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-[11px] mb-2"
              />
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                {categories.map((cat) => {
                  const count = cat === "All"
                    ? menuItems.filter(i => i.id !== excludeItemId).length
                    : menuItems.filter(i => i.category === cat && i.id !== excludeItemId).length;
                  if (count === 0 && cat !== "All") return null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-2.5 py-1 rounded-full flex-shrink-0 text-[10px] font-semibold tracking-wide cursor-pointer transition-all
                        ${activeCategory === cat
                          ? "bg-erl-accent text-erl-base"
                          : "bg-erl-surface/60 text-erl-text-secondary border border-erl-border-default"
                        }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Select all */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] text-erl-muted">
                {selectedIds.size} of {filteredItems.length} items
              </span>
              <button
                onClick={toggleAll}
                className="text-[10px] font-bold text-erl-accent cursor-pointer bg-transparent border-none hover:underline"
              >
                {selectedIds.size === filteredItems.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            {/* Menu item list */}
            <div className="border-[1.5px] border-erl-border-medium rounded-[10px] bg-erl-surface max-h-[180px] overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="text-center text-erl-muted py-6 text-[11px]">
                  No items found
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-left transition-all border-b border-erl-border-subtle/40 last:border-b-0
                        ${isSelected ? "bg-erl-accent/8" : "bg-transparent hover:bg-erl-elevated/50"}`}
                    >
                      <div className={`
                        w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] text-erl-sidebar
                        ${isSelected ? "bg-erl-accent border border-erl-accent" : "bg-transparent border-[1.5px] border-erl-border-medium"}
                      `}>
                        {isSelected ? "✓" : ""}
                      </div>
                      <span className="w-4 h-4 flex items-center justify-center text-erl-text-secondary">{getIconByEmoji(item.emoji)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-erl-text-primary truncate">{item.name}</div>
                        <div className="text-[9px] text-erl-text-faint">{item.category}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Apply button */}
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              disabled={saving || selectedIds.size === 0 || recipeCount === 0}
              className="btn btn-accent flex-1 py-2.5 text-[11px] min-h-[44px]"
            >
              {saving ? "Applying…" : `Apply to ${selectedIds.size} Item${selectedIds.size !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-erl-elevated text-erl-muted text-[11px] font-bold cursor-pointer border-[1.5px] border-erl-border-default min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
    ),
    document.body,
  );
};
