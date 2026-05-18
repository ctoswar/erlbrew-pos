import React, { useState, useEffect } from "react";
import { MenuItem } from "../types";
import { formatCurrency } from "../utils";
import { getModifiers, createModifier, updateModifier, deleteModifier, Modifier } from "../utils/api";

interface Props {
  item: MenuItem;
  onClose: () => void;
}

export const ModifierEditor: React.FC<Props> = ({ item, onClose }) => {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", price: "", isDefault: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <>
      <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display text-[15px] font-bold text-erl-text-primary">
                {item.emoji} {item.name} — Modifiers
              </div>
              <div className="text-[10px] text-erl-muted mt-0.5">
                Add-ons & customizations for this item
              </div>
            </div>
            <button onClick={onClose} className="bg-none border-none text-erl-muted text-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center">✕</button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-[11px] text-erl-danger">
              {error}
            </div>
          )}

          {/* Modifier list */}
          {loading ? (
            <div className="text-center text-erl-muted py-8 text-xs">
              Loading...
            </div>
          ) : modifiers.length === 0 && !showAddForm ? (
            <div className="text-center text-erl-muted py-8 text-xs">
              No modifiers yet. Add some below.
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-3.5">
              {modifiers.map((mod) => (
                <div key={mod.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border-[1.5px] border-erl-border-default bg-erl-surface">
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
                      <button onClick={() => startEdit(mod)} className="bg-none border border-erl-border-default rounded-md px-2 py-1.5 text-[9px] font-bold text-erl-muted cursor-pointer tracking-wide min-h-[44px]">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(mod.id!)} className="bg-none border border-red-500/30 rounded-md px-2 py-1.5 text-[9px] font-bold text-erl-danger cursor-pointer tracking-wide min-h-[44px]">
                        Del
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add modifier form / button */}
          {showAddForm ? (
            <div className="border-[1.5px] border-erl-border-medium rounded-[10px] p-3 bg-erl-surface">
              <div className="mb-2 text-[11px] font-bold text-erl-secondary tracking-wide">
                ADD NEW MODIFIER
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
          ) : (
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); }}
              className="btn btn-accent w-full py-2.5 text-[11px] min-h-[44px]"
            >
              + Add Modifier
            </button>
          )}
        </div>
      </div>
    </>
  );
};
