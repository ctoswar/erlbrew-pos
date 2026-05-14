import React, { useState, useEffect } from "react";
import { MenuItem } from "../types";
import { formatCurrency } from "../utils";
import { apiAdminGet, apiAdminPost, apiAdminPut, apiAdminDelete, uploadMenuItemImage } from "../utils/api";
import { IngredientEditor } from "./IngredientEditor";
import { ModifierEditor } from "./ModifierEditor";

const CATEGORIES = ["ICED COFFEE", "NON-COFFEE", "BLENDED", "PASTRIES", "FRUIT SODA", "HOT COFFEE"];

const EMPTY_FORM = {
  id: "",
  name: "",
  category: "ICED COFFEE",
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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Ingredient editor modal */}
      {ingredientItem && (
        <IngredientEditor menuItem={ingredientItem} onClose={() => setIngredientItem(null)} />
      )}
      {modifierItem && (
        <ModifierEditor item={modifierItem} onClose={() => setModifierItem(null)} />
      )}

      {/* Header */}
      <div className="glass-panel" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.8rem 1rem", borderBottom: "1px solid rgba(201,135,58,0.08)", flexShrink: 0,
        borderRadius: 0,
      }}>
        <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
          Menu Management
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 1 }}>{items.length} items</span>
          <button onClick={openAddForm} className="btn btn-gold" style={{
            fontSize: 9, padding: "7px 14px", letterSpacing: 1,
          }}>
            + Add Item
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="scroll-area" style={{ flex: 1, padding: "1rem", overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div className="animate-shimmer" style={{ width: 120, height: 14, borderRadius: 4, margin: "0 auto 8px" }} />
            <div className="animate-shimmer" style={{ width: 80, height: 10, borderRadius: 4, margin: "0 auto" }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-disabled)", padding: "3rem", fontSize: 11, letterSpacing: 1 }}>
            No menu items yet
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
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
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 998,
            animation: "fadeInOverlay 0.2s ease",
          }} onClick={closeForm} />
          <div style={{
            position: "fixed", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 999, padding: "1rem",
          }}>
            <div className="animate-scaleIn card-glass" style={{
              padding: "1.5rem", width: "100%", maxWidth: 420,
              maxHeight: "90vh", overflowY: "auto",
            }}>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>
                {editingId ? "Edit Menu Item" : "Add Menu Item"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {EMOJIS.map((e) => (
                      <button key={e} onClick={() => setField("emoji", e)} style={{
                        width: 38, height: 38, borderRadius: 8, fontSize: 20,
                        background: form.emoji === e ? "rgba(201,135,58,0.2)" : "var(--bg-base)",
                        border: `1.5px solid ${form.emoji === e ? "var(--gold)" : "var(--border-default)"}`,
                        cursor: "pointer",
                      }}>{e}</button>
                    ))}
                    <input value={form.emoji} onChange={(e) => setField("emoji", e.target.value)} placeholder="🙂"
                      style={{ width: 38, height: 38, borderRadius: 8, background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: 18, textAlign: "center" }} />
                  </div>
                </FormField>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
                  <input type="checkbox" checked={form.popular} onChange={(e) => setField("popular", e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--gold)" }} />
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Mark as Popular</span>
                </label>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: "9px 12px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 8, fontSize: 11, color: "var(--danger)" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button onClick={closeForm} className="btn btn-outline" style={{
                  flex: 1, fontSize: 10, padding: "11px 0",
                }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-gold" style={{
                  flex: 1, fontSize: 10, padding: "11px 0",
                }}>
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
  <div className="card" style={{
    display: "flex", flexDirection: "column", cursor: "default",
    overflow: "hidden", transition: "var(--transition-normal)",
  }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "none"; }}
  >
    {/* Image area */}
    {item.image && (
      <div style={{ width: "100%", height: 120, overflow: "hidden", background: "var(--bg-base)", position: "relative" }}>
        <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    )}
    {/* Top accent bar */}
    <div style={{ height: 3, background: "linear-gradient(90deg, var(--gold), rgba(201,135,58,0.3))", flexShrink: 0 }} />

    <div style={{ padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Emoji + badges row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{item.emoji}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {item.popular && <span className="pill pill-gold" style={{ fontSize: 7, padding: "2px 6px", letterSpacing: 1 }}>POP</span>}
          {item.badge && <span className="pill pill-gold" style={{ fontSize: 7, padding: "2px 6px", letterSpacing: 1, background: "transparent", border: "1px solid rgba(201,135,58,0.35)" }}>{item.badge}</span>}
        </div>
      </div>

      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.25 }}>{item.name}</div>

      {/* Category + Price row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="pill pill-muted" style={{ fontSize: 8, padding: "2px 6px", letterSpacing: 1, background: "var(--bg-base)" }}>{item.category}</span>
        <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(item.price)}</span>
      </div>
    </div>

    {deleteConfirm ? (
      <div style={{ padding: "10px 14px 12px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 9, color: "var(--danger)", textAlign: "center", fontWeight: 600 }}>Delete “{item.name}”?</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onCancelDelete} className="btn btn-outline" style={{ flex: 1, fontSize: 8, padding: "7px 0", borderRadius: 8 }}>Cancel</button>
          <button onClick={onConfirmDelete} className="btn btn-danger" style={{ flex: 1, fontSize: 8, padding: "7px 0", borderRadius: 8, background: "var(--danger)", border: "none", color: "#fff", letterSpacing: 0.5 }}>Delete</button>
        </div>
      </div>
    ) : (
      <div style={{ padding: "8px 14px 12px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={onEdit} className="btn-ghost" style={{ flex: 1, fontSize: 8, padding: "6px 0", borderRadius: 8, border: "1px solid var(--border-medium)" }}>
            ✏️ Edit
          </button>
          <button onClick={onDelete} className="btn-ghost" style={{ width: 30, height: 30, fontSize: 10, borderRadius: 8, border: "1px solid var(--danger-border)", color: "var(--danger)" }}>
            🗑
          </button>
        </div>
        <button onClick={onManageIngredients} className="btn-glass" style={{ width: "100%", fontSize: 8, padding: "6px 0", letterSpacing: 0.5 }}>
          🧾 Ingredients
        </button>
        <button onClick={onManageModifiers} className="btn-glass" style={{ width: "100%", fontSize: 8, padding: "6px 0", letterSpacing: 0.5 }}>
          ⚡ Modifiers
        </button>
        {/* Image upload */}
        <label className="btn-glass" style={{ width: "100%", fontSize: 8, padding: "6px 0", letterSpacing: 0.5, cursor: uploading ? "wait" : "pointer", borderStyle: "dashed", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          {uploading ? "⟳ Uploading…" : item.image ? "🖼 Change Image" : "🖼 Add Image"}
          <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} disabled={uploading} />
        </label>
      </div>
    )}
  </div>
  );
};

// ── Form Field ────────────────────────────────────────────────────────────────

const FormField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" as const, fontWeight: 700 }}>
      {label}{hint && <span style={{ fontWeight: 400, color: "var(--text-faint)", textTransform: "none" as const, marginLeft: 4 }}>{hint}</span>}
    </div>
    {children}
  </div>
);