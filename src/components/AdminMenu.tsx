import React, { useState, useEffect, useMemo } from "react";
import { MenuItem } from "../types";
import { formatCurrency } from "../utils";
import { apiAdminGet, apiAdminPost, apiAdminPut, apiAdminDelete, uploadMenuItemImage } from "../utils/api";
import { IngredientEditor } from "./IngredientEditor";
import { ModifierEditor } from "./ModifierEditor";

const EMPTY_FORM = {
  id: "",
  name: "",
  category: "",
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
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Derive categories dynamically from menu items
  const dbCategories = useMemo(() => {
    const unique = [...new Set(items.map((i) => i.category).filter(Boolean))];
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [items]);

  const allCategories = useMemo(() => ["All", ...dbCategories], [dbCategories]);

  // Stats
  const stats = useMemo(() => {
    const popular = items.filter(i => i.popular).length;
    const withBadge = items.filter(i => i.badge).length;
    return { total: items.length, popular, withBadge };
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    let result = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeCategory, searchQuery]);

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
    if (!form.id.trim() || !form.name.trim() || !form.price || !form.category.trim()) {
      setError("ID, name, category, and price are required");
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

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="glass-panel flex items-center justify-between px-5 py-3.5 border-b border-erl-accent/10 flex-shrink-0 rounded-none">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-base font-bold text-erl-text-primary tracking-wide">
            Menu Management
          </h2>
          <span className="text-[11px] text-erl-text-faint tracking-wide tabular-nums">{items.length} items</span>
        </div>
        <button onClick={openAddForm} className="btn btn-accent text-[11px] px-4 py-2 tracking-wide">
          + Add Item
        </button>
      </div>

      {/* ── Stats Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-5 pt-4 flex-shrink-0">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-accent/8 border-erl-accent/20">
          <span className="text-[18px]">📋</span>
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums leading-tight text-erl-accent">{stats.total}</span>
            <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">Total Items</span>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-surface border-erl-border-subtle">
          <span className="text-[18px]">⭐</span>
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums leading-tight text-erl-text-primary">{stats.popular}</span>
            <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">Popular</span>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-surface border-erl-border-subtle">
          <span className="text-[18px]">🏷️</span>
          <div className="flex flex-col">
            <span className="text-xl font-bold tabular-nums leading-tight text-erl-text-primary">{stats.withBadge}</span>
            <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">Badged</span>
          </div>
        </div>
      </div>

      {/* ── Search + Category Filter ──────────────────────── */}
      <div className="flex flex-col gap-2.5 px-5 pt-4 flex-shrink-0">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-erl-text-faint text-sm pointer-events-none">⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items…"
            className="w-full box-border pl-9 !py-2.5 !text-[13px] !rounded-xl text-erl-text-primary"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-erl-text-faint hover:text-erl-text-primary transition-colors text-sm cursor-pointer bg-transparent border-none">
              ✕
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {allCategories.map((cat) => {
            const count = cat === "All" ? items.length : items.filter((i) => i.category === cat).length;
            if (count === 0 && cat !== "All") return null;
            const isActive = activeCategory === cat;
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`
                px-3.5 py-1.5 rounded-full flex-shrink-0 text-[11px] font-semibold tracking-wide cursor-pointer transition-all duration-200
                ${isActive
                  ? "bg-erl-accent text-erl-base shadow-sm"
                  : "bg-erl-surface/60 text-erl-text-secondary border border-erl-border-default hover:border-erl-border-medium hover:text-erl-text-primary"
                }
              `}>
                {cat} <span className={`ml-0.5 ${isActive ? "opacity-70" : "opacity-50"}`}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Items Grid ─────────────────────────────────────── */}
      <div className="scroll-area flex-1 px-5 py-3 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="animate-shimmer w-28 h-4 rounded-md" />
            <div className="animate-shimmer w-20 h-3 rounded-md" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <span className="text-2xl">🍽️</span>
            <div className="text-[13px] text-erl-text-disabled tracking-wide">
              {searchQuery ? "No items match your search" : "No menu items yet"}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {filtered.map((item) => (
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

      {/* ── Add/Edit Form Modal ─────────────────────────────── */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998] animate-fade-in-overlay" onClick={closeForm} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-0 w-full max-w-[460px] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl">
              {/* Modal header */}
              <div className="px-6 pt-5 pb-4 border-b border-erl-border-subtle">
                <div className="font-display text-lg font-bold text-erl-text-primary">
                  {editingId ? "Edit Menu Item" : "New Menu Item"}
                </div>
                <div className="text-[12px] text-erl-text-muted mt-0.5">
                  {editingId ? "Update item details below" : "Fill in the details to add a new item"}
                </div>
              </div>

              {/* Form body */}
              <div className="scroll-area flex-1 overflow-y-auto min-h-0 px-6 py-5">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormSection label="Item ID" hint="e.g. m17">
                      <input value={form.id} onChange={(e) => setField("id", e.target.value)} placeholder="m17"
                        disabled={!!editingId}
                        className={`text-erl-text-primary ${editingId ? "opacity-50 cursor-not-allowed" : ""}`} />
                    </FormSection>
                    <FormSection label="Name">
                      <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Item name"
                        className="text-erl-text-primary" />
                    </FormSection>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormSection label="Category">
                      <input
                        list="category-options"
                        value={form.category}
                        onChange={(e) => setField("category", e.target.value)}
                        placeholder="Select or type new category"
                        className="text-erl-text-primary"
                      />
                      <datalist id="category-options">
                        {dbCategories.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </FormSection>
                    <FormSection label="Price (₱)">
                      <input type="number" value={form.price} onChange={(e) => setField("price", e.target.value)}
                        placeholder="0.00" min="0" step="0.01" className="text-erl-text-primary" />
                    </FormSection>
                  </div>

                  <div className="h-px bg-erl-border-subtle" />

                  <FormSection label="Badge" hint="optional, e.g. SIGNATURE, NEW">
                    <input value={form.badge} onChange={(e) => setField("badge", e.target.value)} placeholder="SIGNATURE"
                      className="text-erl-text-primary" />
                  </FormSection>

                  <FormSection label="Description">
                    <textarea value={form.description} onChange={(e) => setField("description", e.target.value)}
                      placeholder="Short description..." className="text-erl-text-primary" />
                  </FormSection>

                  <FormSection label="Emoji">
                    <div className="flex flex-wrap gap-2">
                      {EMOJIS.map((e) => (
                        <button key={e} onClick={() => setField("emoji", e)} className={`
                          w-[40px] h-[40px] rounded-xl text-xl cursor-pointer transition-all duration-150 flex items-center justify-center
                          ${form.emoji === e
                            ? "bg-erl-accent/20 border-2 border-erl-accent scale-110"
                            : "bg-erl-base border border-erl-border-default hover:border-erl-border-medium hover:scale-105"
                          }
                        `}>{e}</button>
                      ))}
                      <input value={form.emoji} onChange={(e) => setField("emoji", e.target.value)} placeholder="🙂"
                        className="w-[40px] h-[40px] rounded-xl bg-erl-base border border-erl-border-default text-erl-text-primary text-lg text-center box-border" />
                    </div>
                  </FormSection>

                  <label className="flex items-center gap-2.5 cursor-pointer py-1">
                    <input type="checkbox" checked={form.popular} onChange={(e) => setField("popular", e.target.checked)}
                      className="w-4 h-4 accent-erl-accent cursor-pointer" />
                    <span className="text-[13px] text-erl-text-secondary">Mark as Popular</span>
                  </label>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mx-6 px-4 py-2.5 bg-erl-danger-bg border border-erl-danger-border rounded-xl text-[12px] text-erl-danger">
                  {error}
                </div>
              )}

              {/* Modal footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-erl-border-subtle mt-2">
                <button onClick={closeForm} className="btn btn-outline flex-1 text-[12px] py-2.5">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-accent flex-1 text-[12px] py-2.5">
                  {saving ? "Saving…" : editingId ? "Update Item" : "Add Item"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Admin Item Card ──────────────────────────────────────────

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
      onEdit(); onEdit();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`
      group rounded-2xl border overflow-hidden transition-all duration-200
      bg-erl-surface/60 border-erl-border-subtle
      hover:border-erl-border-medium hover:shadow-md
    `}>
      {/* Image area */}
      {item.image && (
        <div className="w-full h-[100px] overflow-hidden bg-erl-base relative">
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-erl-base/60 to-transparent" />
        </div>
      )}

      {/* Top accent bar */}
      <div className="h-[3px] bg-gradient-to-r from-erl-accent to-erl-accent/20 flex-shrink-0" />

      {/* Card content */}
      <div className="px-4 pt-3.5 pb-3 flex flex-col gap-2">
        {/* Emoji + badges row */}
        <div className="flex justify-between items-start">
          <span className="text-[28px] leading-none">{item.emoji}</span>
          <div className="flex gap-1.5">
            {item.popular && (
              <span className="pill text-[10px] px-2 py-0.5 bg-erl-accent/10 text-erl-accent border border-erl-accent/25">POPULAR</span>
            )}
            {item.badge && (
              <span className="pill text-[10px] px-2 py-0.5 bg-transparent text-erl-accent/80 border border-erl-accent/30">{item.badge}</span>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="text-[14px] font-bold text-erl-text-primary leading-tight">{item.name}</div>

        {/* Category + Price row */}
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-erl-text-faint tracking-wider uppercase font-semibold px-2 py-0.5 rounded-md bg-erl-base/60">{item.category}</span>
          <span className="font-display text-[17px] font-bold text-erl-accent">{formatCurrency(item.price)}</span>
        </div>

        {/* Description */}
        {item.description && (
          <div className="text-[11px] text-erl-text-muted leading-relaxed line-clamp-2 mt-0.5">
            {item.description}
          </div>
        )}
      </div>

      {/* Action footer */}
      {deleteConfirm ? (
        <div className="border-t border-erl-danger/20 bg-erl-danger/5 px-4 py-3">
          <div className="text-[12px] text-erl-danger text-center font-semibold mb-2">Delete "{item.name}"?</div>
          <div className="flex gap-2">
            <button onClick={onCancelDelete} className="btn btn-outline flex-1 text-[11px] py-2 rounded-lg">
              Cancel
            </button>
            <button onClick={onConfirmDelete} className="btn btn-danger flex-1 text-[11px] py-2 rounded-lg !bg-erl-danger !text-white !border-erl-danger">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-erl-border-subtle/60 px-3 py-2.5">
          {/* Primary actions row */}
          <div className="flex gap-1.5 mb-1.5">
            <button onClick={onEdit} className="flex-1 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-erl-border-default text-erl-text-secondary bg-transparent hover:bg-erl-surface hover:border-erl-border-medium hover:text-erl-text-primary">
              ✏️ Edit
            </button>
            <button onClick={onManageIngredients} className="flex-1 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-erl-border-default text-erl-text-secondary bg-transparent hover:bg-erl-surface hover:border-erl-border-medium hover:text-erl-text-primary">
              🧾 Ingredients
            </button>
            <button onClick={onDelete} className="py-[7px] px-2.5 rounded-lg text-[11px] cursor-pointer transition-all border border-erl-danger-border text-erl-danger bg-transparent hover:bg-erl-danger/10">
              🗑
            </button>
          </div>

          {/* Secondary actions row */}
          <div className="flex gap-1.5">
            <button onClick={onManageModifiers} className="flex-1 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-erl-border-default text-erl-accent bg-transparent hover:bg-erl-accent/10 hover:border-erl-accent/40">
              ⚡ Modifiers
            </button>
            <label className="flex-1 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-dashed border-erl-border-default text-erl-text-faint bg-transparent hover:border-erl-border-medium hover:text-erl-text-secondary text-center" style={{ cursor: uploading ? "wait" : "pointer" }}>
              {uploading ? "⟳ Uploading…" : item.image ? "🖼 Change Image" : "🖼 Add Image"}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Form Section ──────────────────────────────────────────────

const FormSection: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold">
      {label}
      {hint && <span className="font-normal text-erl-text-faint normal-case not-italic ml-1.5">{hint}</span>}
    </div>
    {children}
  </div>
);