import React, { useState, useMemo } from "react";
import { MenuItem } from "../types";
import { formatCurrency } from "../utils";
import { batchApplyModifier } from "../utils/api";

interface Props {
  /** If provided, pre-fill modifier name/price (used from ModifierEditor) */
  modifier?: { name: string; price: number; isDefault: boolean };
  /** All menu items for selection */
  menuItems: MenuItem[];
  /** Current item to exclude from selection (optional) */
  excludeItemId?: string;
  /** Called when apply succeeds */
  onApplied: () => void;
  /** Close modal */
  onClose: () => void;
}

export const ApplyModifierModal: React.FC<Props> = ({
  modifier: presetModifier,
  menuItems,
  excludeItemId,
  onApplied,
  onClose,
}) => {
  const [modifierName, setModifierName] = useState(presetModifier?.name || "");
  const [modifierPrice, setModifierPrice] = useState(presetModifier?.price?.toString() || "0");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  // Derive categories
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category).filter(Boolean))];
    cats.sort((a, b) => a.localeCompare(b));
    return ["All", ...cats];
  }, [menuItems]);

  // Filter items
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

  const handleApply = async () => {
    if (!modifierName.trim()) {
      setError("Modifier name is required");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Select at least one menu item");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await batchApplyModifier(
        {
          name: modifierName.trim(),
          price: Number(modifierPrice) || 0,
          isDefault: false,
        },
        Array.from(selectedIds)
      );
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Failed to apply modifier");
    } finally {
      setSaving(false);
    }
  };

  // Show result
  if (result) {
    return (
      <>
        <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={onClose} />
        <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
          <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="text-center mb-4">
              <div className="text-[28px] mb-2">✅</div>
              <div className="font-display text-[15px] font-bold text-erl-text-primary">
                Modifier Applied!
              </div>
            </div>
            <div className="bg-erl-surface rounded-xl p-4 mb-4">
              <div className="text-[11px] text-erl-text-muted mb-2">
                <span className="font-semibold text-erl-accent">{modifierName}</span> was applied to:
              </div>
              <div className="flex gap-4">
                <div className="flex-1 text-center">
                  <div className="text-xl font-bold text-erl-accent">{result.created}</div>
                  <div className="text-[10px] text-erl-text-faint">Added</div>
                </div>
                {result.skipped > 0 && (
                  <div className="flex-1 text-center">
                    <div className="text-xl font-bold text-erl-secondary">{result.skipped}</div>
                    <div className="text-[10px] text-erl-text-faint">Skipped (already exists)</div>
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
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display text-[15px] font-bold text-erl-text-primary">
                📋 {presetModifier ? "Apply Modifier to Other Items" : "Batch Apply Modifier"}
              </div>
              <div className="text-[10px] text-erl-muted mt-0.5">
                {presetModifier
                  ? `Copy "${presetModifier.name}" to other menu items`
                  : "Create a modifier and apply to multiple items at once"
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

          {/* Modifier form (only if not preset) */}
          {!presetModifier && (
            <div className="border-[1.5px] border-erl-border-medium rounded-[10px] p-3 bg-erl-surface mb-3">
              <div className="mb-2 text-[11px] font-bold text-erl-secondary tracking-wide">
                MODIFIER DETAILS
              </div>
              <input
                value={modifierName}
                onChange={(e) => setModifierName(e.target.value)}
                placeholder="e.g., Extra shot, Oat milk"
                className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-xs mb-2"
              />
              <input
                type="number"
                value={modifierPrice}
                onChange={(e) => setModifierPrice(e.target.value)}
                placeholder="Price (0 = free)"
                className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-[11px]"
              />
            </div>
          )}

          {/* Preset modifier display */}
          {presetModifier && (
            <div className="border-[1.5px] border-erl-accent/30 rounded-[10px] p-3 bg-erl-accent/5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-erl-accent">{presetModifier.name}</span>
                <span className="text-[10px] text-erl-accent">
                  {presetModifier.price > 0 ? `+${formatCurrency(presetModifier.price)}` : "Free"}
                </span>
              </div>
            </div>
          )}

          {/* Search + Category */}
          <div className="mb-3">
            <div className="relative mb-2">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-erl-text-faint text-xs pointer-events-none">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items…"
                className="w-full box-border pl-8 !py-2 !text-[11px] !rounded-lg text-erl-text-primary"
              />
            </div>
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
              {selectedIds.size} of {filteredItems.length} selected
            </span>
            <button
              onClick={toggleAll}
              className="text-[10px] font-bold text-erl-accent cursor-pointer bg-transparent border-none hover:underline"
            >
              {selectedIds.size === filteredItems.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          {/* Item list */}
          <div className="border-[1.5px] border-erl-border-medium rounded-[10px] bg-erl-surface max-h-[280px] overflow-y-auto mb-4">
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
                    <span className="text-[14px]">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-erl-text-primary truncate">{item.name}</div>
                      <div className="text-[9px] text-erl-text-faint">{item.category}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-erl-accent">{formatCurrency(item.price)}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Apply button */}
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              disabled={saving || selectedIds.size === 0 || !modifierName.trim()}
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
  );
};
