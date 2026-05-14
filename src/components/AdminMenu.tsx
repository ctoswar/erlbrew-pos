import React, { useState, useEffect } from "react";
import { MenuItem } from "../types";
import { formatCurrency } from "../utils";
import { apiAdminGet, apiAdminPost, apiAdminPut, apiAdminDelete, uploadMenuItemImage } from "../utils/api";
import { IngredientEditor } from "./IngredientEditor";
import { ModifierEditor } from "./ModifierEditor";

const CATEGORIES = ["Signature Brews", "Espresso", "Pastries", "Cold Drinks"];

const EMPTY_FORM = {
  id: "",
  name: "",
  category: "Signature Brews",
  price: "",
  badge: "",
  description: "",
  emoji: "☕",
  popular: false,
};

export const AdminMenu: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ingredientItem, setIngredientItem] = useState<MenuItem | null>(null);
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);

  const loadItems = () => {
    setLoading(true);
    apiAdminGet<any[]>("/menu")
      .then((data) => {
        setItems(data.map((d: any) => ({
          ...d,
          price: Number(d.price) || 0,
          popular: !!d.popular,
          modifiers: (d.modifiers || []).map((m: any) => ({
            ...m,
            price: Number(m.price) || 0,
          })),
        })));
      })
      .catch(() => setError("Failed to load menu items"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadItems(); }, []);

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const openEditForm = (item: MenuItem) => {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category,
      price: String(item.price),
      badge: item.badge || "",
      description: item.description,
      emoji: item.emoji,
      popular: item.popular || false,
    });
    setEditingId(item.id);
    setShowForm(true);
    setError("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError("");
  };

  const setField = (field: string, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.name.trim() || !form.price) {
      setError("ID, name, and price are required");
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) {
      setError("Price must be a valid number");
      return;
    }

    setSaving(true);
    setError("");
    const payload = {
      id: form.id.trim(),
      name: form.name.trim(),
      category: form.category,
      price,
      badge: form.badge.trim(),
      description: form.description.trim(),
      emoji: form.emoji.trim() || "☕",
      popular: form.popular,
    };

    try {
      if (editingId) {
        await apiAdminPut(`/menu/${editingId}`, payload);
      } else {
        await apiAdminPost("/menu", payload);
      }
      closeForm();
      loadItems();
    } catch (e: any) {
      setError(e.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiAdminDelete(`/menu/${id}`);
      setDeleteConfirm(null);
      loadItems();
    } catch {
      setError("Failed to delete item");
    }
  };

  const EMOJIS = ["☕", "🍵", "🌼", "🧊", "🫖", "🥐", "🍞", "🧁", "🥧", "🌺", "🍋", "🥤", "💧"];

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Ingredient editor modal */}
      {ingredientItem && (
        <IngredientEditor menuItem={ingredientItem} onClose={() => setIngredientItem(null)} />
      )}
      {modifierItem && (
        <ModifierEditor item={modifierItem} onClose={() => setModifierItem(null)} />
      )}

      {/* Header */}
      <div className="glass-panel flex items-center justify-between px-4 py-3 border-b border-erl-accent/10 flex-shrink-0 rounded-none">
        <div className="font-display text-sm font-bold text-erl-text-primary tracking-wide">
          Menu Management
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-erl-text-faint tracking-wide">{items.length} items</span>
          <button onClick={openAddForm} className="btn btn-accent text-[9px] px-3.5 py-[7px] tracking-wide">
            + Add Item
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="scroll-area flex-1 p-4 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-shimmer w-[120px] h-3.5 rounded mx-auto mb-2" />
            <div className="animate-shimmer w-20 h-2.5 rounded mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-erl-text-disabled py-12 text-[11px] tracking-wide">
            No menu items yet
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {items.map((item) => (
              <AdminItemCard
                key={item.id}
                item={item}
                onEdit={() => openEditForm(item)}
                onDelete={() => setDeleteConfirm(item.id)}
                onManageIngredients={() => setIngredientItem(item)}
                onManageModifiers={() => setModifierItem(item)}
                deleteConfirm={deleteConfirm === item.id}
                onConfirmDelete={() => handleDelete(item.id)}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={closeForm} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto">
              <div className="font-display text-base font-bold text-erl-text-primary mb-4">
                {editingId ? "Edit Menu Item" : "Add Menu Item"}
              </div>

              <div className="flex flex-col gap-3">
                <FormField label="Item ID" hint="e.g. m17 (must be unique)">
                  <input value={form.id} onChange={(e) => setField("id", e.target.value)} placeholder="m17"
                    disabled={!!editingId} />
                </FormField>
                <FormField label="Name">
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Item name" />
                </FormField>
                <FormField label="Category">
                  <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="Price (₱)">
                  <input type="number" value={form.price} onChange={(e) => setField("price", e.target.value)}
                    placeholder="0.00" min="0" step="0.01" />
                </FormField>
                <FormField label="Badge (optional)" hint="e.g. SIGNATURE, NEW">
                  <input value={form.badge} onChange={(e) => setField("badge", e.target.value)} placeholder="SIGNATURE" />
                </FormField>
                <FormField label="Description">
                  <textarea value={form.description} onChange={(e) => setField("description", e.target.value)}
                    placeholder="Short description..." />
                </FormField>
                <FormField label="Emoji">
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJIS.map((e) => (
                      <button key={e} onClick={() => setField("emoji", e)} className={`
                        w-[38px] h-[38px] rounded-lg text-xl cursor-pointer
                        ${form.emoji === e ? "bg-erl-accent/20 border-[1.5px] border-erl-accent" : "bg-erl-base border-[1.5px] border-erl-border-default"}
                      `}>{e}</button>
                    ))}
                    <input value={form.emoji} onChange={(e) => setField("emoji", e.target.value)} placeholder="🙂"
                      className="w-[38px] h-[38px] rounded-lg bg-erl-base border border-erl-border-default text-erl-text-primary text-lg text-center" />
                  </div>
                </FormField>
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input type="checkbox" checked={form.popular} onChange={(e) => setField("popular", e.target.checked)}
                    className="w-4 h-4 accent-erl-accent" />
                  <span className="text-[11px] text-erl-secondary">Mark as Popular</span>
                </label>
              </div>

              {error && (
                <div className="mt-3 px-3 py-2 bg-erl-danger-bg border border-erl-danger-border rounded-lg text-[11px] text-erl-danger">
                  {error}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={closeForm} className="btn btn-outline flex-1 text-[10px] py-2.5">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-accent flex-1 text-[10px] py-2.5">
                  {saving ? "Saving..." : editingId ? "Update Item" : "Add Item"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Admin Item Card ───────────────────────────────────────────────────────────

interface AdminItemCardProps {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onManageIngredients: () => void;
  onManageModifiers: () => void;
  deleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

const AdminItemCard: React.FC<AdminItemCardProps> = ({ item, onEdit, onDelete, onManageIngredients, onManageModifiers, deleteConfirm, onConfirmDelete, onCancelDelete }) => {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadMenuItemImage(item.id, file);
      // Trigger parent reload
      onEdit(); onEdit(); // quick hack: call twice to refresh via parent
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  return (
  <div className="card flex flex-col cursor-default overflow-hidden transition-[box-shadow,transform] duration-300 ease-out hover:shadow-md hover:-translate-y-0.5">
    {/* Image area */}
    {item.image && (
      <div className="w-full h-[120px] overflow-hidden bg-erl-base relative">
        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
      </div>
    )}
    {/* Top accent bar */}
    <div className="h-[3px] bg-gradient-to-r from-erl-accent to-erl-accent/30 flex-shrink-0" />

    <div className="px-3.5 pt-3.5 pb-3 flex flex-col gap-2">
      {/* Emoji + badges row */}
      <div className="flex justify-between items-center">
        <span className="text-[28px] leading-none">{item.emoji}</span>
        <div className="flex gap-1">
          {item.popular && <span className="pill pill-gold text-[7px] px-1.5 py-[2px] tracking-wider">POP</span>}
          {item.badge && <span className="pill pill-gold text-[7px] px-1.5 py-[2px] tracking-wider bg-transparent border border-erl-accent/35">{item.badge}</span>}
        </div>
      </div>

      {/* Name */}
      <div className="text-[13px] font-bold text-erl-text-primary leading-tight">{item.name}</div>

      {/* Category + Price row */}
      <div className="flex justify-between items-center">
        <span className="pill pill-muted text-[8px] px-1.5 py-[2px] tracking-wider bg-erl-base">{item.category}</span>
        <span className="font-display text-[15px] font-bold text-erl-accent">{formatCurrency(item.price)}</span>
      </div>
    </div>

    {deleteConfirm ? (
      <div className="px-3.5 pt-2.5 pb-3 border-t border-erl-border-subtle flex flex-col gap-1.5">
        <div className="text-[9px] text-erl-danger text-center font-semibold">Delete &ldquo;{item.name}&rdquo;?</div>
        <div className="flex gap-1.5">
          <button onClick={onCancelDelete} className="btn btn-outline flex-1 text-[8px] py-1.5 rounded-lg">Cancel</button>
          <button onClick={onConfirmDelete} className="btn btn-danger flex-1 text-[8px] py-1.5 rounded-lg bg-erl-danger border-none text-white tracking-wide">Delete</button>
        </div>
      </div>
    ) : (
      <div className="px-3.5 pt-2 pb-3 border-t border-erl-border-subtle flex flex-col gap-[5px]">
        <div className="flex gap-[5px]">
          <button onClick={onEdit} className="btn-ghost flex-1 text-[8px] py-1.5 rounded-lg border border-erl-border-medium">
            ✏️ Edit
          </button>
          <button onClick={onDelete} className="btn-ghost w-[30px] h-[30px] text-[10px] rounded-lg border border-erl-danger-border text-erl-danger">
            🗑
          </button>
        </div>
        <button onClick={onManageIngredients} className="btn-glass w-full text-[8px] py-1.5 tracking-wide">
          🧾 Ingredients
        </button>
        <button onClick={onManageModifiers} className="btn-glass w-full text-[8px] py-1.5 tracking-wide">
          ⚡ Modifiers
        </button>
        {/* Image upload */}
        <label className="btn-glass w-full text-[8px] py-1.5 tracking-wide cursor-pointer border-dashed flex items-center justify-center gap-1" style={{ cursor: uploading ? "wait" : "pointer" }}>
          {uploading ? "⟳ Uploading…" : item.image ? "🖼 Change Image" : "🖼 Add Image"}
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
    )}
  </div>
  );
};

// ── Form Field ────────────────────────────────────────────────────────────────

const FormField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] uppercase font-bold">
      {label}{hint && <span className="font-normal text-erl-text-faint normal-case ml-1">{hint}</span>}
    </div>
    {children}
  </div>
);
