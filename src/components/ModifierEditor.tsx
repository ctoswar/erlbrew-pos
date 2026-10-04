import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { MenuItem } from "../types";
import { formatCurrency } from "../utils";
import { getModifiers, createModifier, updateModifier, deleteModifier, Modifier } from "../utils/api";
import { ApplyModifierModal } from "./ApplyModifierModal";
import { getIconByEmoji } from "./FoodIcons";

interface Props {
  item: MenuItem;
  allMenuItems?: MenuItem[];
  onClose: () => void;
}

export const ModifierEditor: React.FC<Props> = ({ item, allMenuItems = [], onClose }) => {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", price: "", isDefault: false });
  const [batchText, setBatchText] = useState("");
  const [batchPrice, setBatchPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyModifier, setApplyModifier] = useState<{ name: string; price: number; isDefault: boolean } | null>(null);

  const loadModifiers = () => {
    setLoading(true);
    getModifiers(item.id)
      .then(setModifiers)
      .catch(() => setError("Failed to load modifiers"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadModifiers(); }, [item.id]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createModifier(item.id, {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        isDefault: form.isDefault,
      });
      setForm({ name: "", price: "", isDefault: false });
      setShowAddForm(false);
      loadModifiers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBatchAdd = async () => {
    const names = batchText.trim().split('\n').map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    setSaving(true);
    setError("");
    const price = Number(batchPrice) || 0;
    let created = 0;
    for (const name of names) {
      try {
        await createModifier(item.id, { name, price, isDefault: false });
        created++;
      } catch (e: any) {
        setError(e.message);
        break;
      }
    }
    if (created > 0) {
      setBatchText("");
      setBatchPrice("");
      setShowBatchAdd(false);
      loadModifiers();
    }
    setSaving(false);
  };

  const handleSaveEdit = async (id: number) => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateModifier(id, {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        isDefault: form.isDefault,
      });
      setEditingId(null);
      setForm({ name: "", price: "", isDefault: false });
      loadModifiers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this modifier?")) return;
    try {
      await deleteModifier(id);
      loadModifiers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startEdit = (mod: Modifier) => {
    setEditingId(mod.id!);
    setForm({ name: mod.name, price: String(mod.price), isDefault: mod.isDefault });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", price: "", isDefault: false });
  };

  return createPortal(
    (
      <>
      <div className="ingredient-editor-backdrop fixed inset-0 z-[998] animate-fade-in-overlay" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="modifier-editor-modal bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl w-full max-w-[680px] max-h-[88dvh] overflow-hidden animate-fade-in-up flex flex-col">
          {/* Header */}
          <div className="modifier-editor-header flex items-start justify-between gap-4 px-6 py-4 border-b border-erl-border-subtle flex-shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="modifier-editor-icon">{getIconByEmoji(item.emoji)}</span>
                <div className="min-w-0">
                  <div className="font-display text-[17px] font-bold text-erl-text-primary truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-erl-text-faint uppercase tracking-[0.16em] font-semibold mt-0.5">
                    Modifier editor
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-erl-text-muted mt-2 ml-11">
                Add-ons and customizations for this item
              </div>
            </div>
            <button onClick={onClose} aria-label="Close modifier editor" className="modifier-editor-close">✕</button>
          </div>

          <div className="modifier-editor-summary">
            <div>
              <span className="modifier-editor-summary-value">{modifiers.length}</span>
              <span className="modifier-editor-summary-label">modifier{modifiers.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="modifier-editor-summary-hint">
              {modifiers.length > 0 ? "Ready to customize at checkout" : "Start with a single add-on or use batch add"}
            </div>
          </div>

          <div className="modifier-editor-body scroll-area flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-[11px] text-erl-danger">
                {error}
              </div>
            )}

            {/* Modifier list */}
            {loading ? (
              <div className="modifier-editor-empty">
                <div className="animate-shimmer w-28 h-4 rounded-md" />
                <div className="animate-shimmer w-44 h-3 rounded-md" />
              </div>
            ) : modifiers.length === 0 && !showAddForm && !showBatchAdd ? (
              <div className="modifier-editor-empty modifier-editor-empty-state">
                <div className="modifier-editor-empty-icon">✦</div>
                <div className="font-display text-[16px] font-bold text-erl-text-primary">No modifiers yet</div>
                <div className="text-[12px] text-erl-text-muted max-w-[320px]">
                  Add options like extra shot, oat milk, or whipped cream so customers can personalize this drink.
                </div>
                <button
                  onClick={() => { setShowAddForm(true); setShowBatchAdd(false); }}
                  className="btn btn-accent mt-2 px-5 py-2.5 text-[11px]"
                >
                  + Add first modifier
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {modifiers.map((mod) => (
                  <div key={mod.id} className="modifier-card">
                  {editingId === mod.id ? (
                    <div className="flex-1 flex flex-col gap-1.5">
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Modifier name"
                        className="w-full px-2 py-1 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-xs"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          placeholder="Price"
                          className="flex-1 px-2 py-1 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-[11px]"
                        />
                        <label className="flex items-center gap-1 text-[10px] text-erl-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.isDefault}
                            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                          />
                          Default
                        </label>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleSaveEdit(mod.id!)} disabled={saving} className="flex-1 py-1 rounded-md bg-erl-accent text-erl-sidebar text-[10px] font-bold cursor-pointer border-none">
                          Save
                        </button>
                        <button onClick={cancelEdit} className="flex-1 py-1 rounded-md bg-erl-elevated text-erl-muted text-[10px] font-bold cursor-pointer border-[1.5px] border-erl-border-default">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-erl-text-primary">
                          {mod.name}
                          {mod.isDefault && (
                            <span className="ml-1.5 text-[8px] font-bold text-erl-accent tracking-wide uppercase">DEFAULT</span>
                          )}
                        </div>
                        <div className="text-[10px] text-erl-accent">
                          {mod.price > 0 ? `+${formatCurrency(mod.price)}` : "Free"}
                        </div>
                      </div>
                      <button onClick={() => startEdit(mod)} className="bg-none border border-erl-border-default rounded-lg px-3 py-2 text-[10px] font-bold text-erl-muted cursor-pointer tracking-wide">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(mod.id!)} className="bg-none border border-red-500/30 rounded-lg px-3 py-2 text-[10px] font-bold text-erl-danger cursor-pointer tracking-wide">
                        Del
                      </button>
                    </>
                  )}
                  </div>
                ))}
              </div>
            )}

            {/* Batch add — paste multiple lines */}
            {showBatchAdd ? (
              <div className="modifier-editor-form">
              <div className="modifier-editor-form-heading">
                <span className="modifier-editor-form-icon">▤</span>
                <div>
                BATCH ADD MODIFIERS
                  <div className="modifier-editor-form-subtitle">Paste one modifier per line.</div>
                </div>
              </div>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"Extra shot\nOat milk\nWhipped cream\nSoy milk\nCaramel drizzle"}
                rows={5}
                className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-xs mb-2 resize-none"
              />
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  value={batchPrice}
                  onChange={(e) => setBatchPrice(e.target.value)}
                  placeholder="Price for all (0 = free)"
                  className="flex-1 px-2.5 py-1.5 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-[11px]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBatchAdd}
                  disabled={saving || !batchText.trim()}
                  className="btn btn-accent flex-1 py-2 text-[11px] min-h-[44px]"
                >
                  {saving ? `Creating...` : `Add All (${batchText.trim() ? batchText.trim().split('\n').filter(Boolean).length : 0})`}
                </button>
                <button
                  onClick={() => { setShowBatchAdd(false); setBatchText(""); setBatchPrice(""); }}
                  className="flex-1 py-2 rounded-lg bg-erl-elevated text-erl-muted text-[11px] font-bold cursor-pointer border-[1.5px] border-erl-border-default min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
              </div>
            ) : null}

            {/* Add modifier form / button */}
            {showAddForm ? (
              <div className="modifier-editor-form">
              <div className="modifier-editor-form-heading">
                <span className="modifier-editor-form-icon">＋</span>
                <div>
                ADD NEW MODIFIER
                  <div className="modifier-editor-form-subtitle">Create one option for this menu item.</div>
                </div>
              </div>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Extra shot, Oat milk, Whipped cream"
                className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-xs mb-2"
              />
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="Additional price (0 = free)"
                  className="flex-1 px-2.5 py-1.5 rounded-md border-[1.5px] border-erl-border-default bg-erl-elevated text-erl-text-primary text-[11px]"
                />
                <label className="flex items-center gap-1 text-[11px] text-erl-secondary whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  />
                  Default
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.name.trim()}
                  className="btn btn-accent flex-1 py-2 text-[11px] min-h-[44px]"
                >
                  {saving ? "Saving..." : "Add Modifier"}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setForm({ name: "", price: "", isDefault: false }); }}
                  className="flex-1 py-2 rounded-lg bg-erl-elevated text-erl-muted text-[11px] font-bold cursor-pointer border-[1.5px] border-erl-border-default min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
              </div>
            ) : null}
          </div>

          {/* Action buttons row */}
          <div className="modifier-editor-actions flex gap-2 px-6 py-4 border-t border-erl-border-subtle flex-shrink-0">
            <button
              onClick={() => { setShowBatchAdd(true); setShowAddForm(false); setEditingId(null); }}
              className="btn btn-accent flex-1 py-2.5 text-[11px] min-h-[44px]"
            >
              ▤ Batch Add
            </button>
            <button
              onClick={() => { setShowAddForm(true); setShowBatchAdd(false); setEditingId(null); }}
              className="modifier-editor-secondary-action flex-1 py-2.5 min-h-[44px]"
            >
              + Single
            </button>
            {allMenuItems.length > 0 && (
              <button
                onClick={() => { setApplyModifier(null); setShowApplyModal(true); }}
                className="modifier-editor-secondary-action modifier-editor-apply-action flex-1 py-2.5 min-h-[44px]"
              >
                ⇢ Apply to Items
              </button>
            )}
          </div>
      </div>
      </div>

      {/* Apply to Other Items Modal */}
      {showApplyModal && (
        <ApplyModifierModal
          modifier={applyModifier || undefined}
          menuItems={allMenuItems}
          excludeItemId={item.id}
          onApplied={() => { loadModifiers(); }}
          onClose={() => { setShowApplyModal(false); setApplyModifier(null); }}
        />
      )}
      </>
    ),
    document.body,
  );
};
