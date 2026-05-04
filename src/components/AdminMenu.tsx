import React, { useState, useEffect } from "react";
import { MenuItem } from "../types";
import { formatCurrency } from "../utils";
import { apiAdminGet, apiAdminPost, apiAdminPut, apiAdminDelete } from "../utils/api";
import { IngredientEditor } from "./IngredientEditor";

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

  const loadItems = () => {
    setLoading(true);
    apiAdminGet<any[]>("/menu")
      .then((data) => {
        setItems(data.map((d: any) => ({
          ...d,
          price: Number(d.price) || 0,
          popular: !!d.popular,
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

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.9rem 1rem", borderBottom: "1px solid var(--border-default)", flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
          Menu Management
        </div>
        <button onClick={openAddForm} style={{
          background: "var(--gold)", color: "var(--bg-sidebar)", border: "none",
          borderRadius: 9, padding: "8px 16px", fontSize: 9, fontWeight: 700,
          letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" as const,
        }}>
          + Add Item
        </button>
      </div>

      {/* Grid */}
      <div className="scroll-area" style={{ flex: 1, padding: "0.8rem 1rem", overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>No menu items</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {items.map((item) => (
              <AdminItemCard
                key={item.id}
                item={item}
                onEdit={() => openEditForm(item)}
                onDelete={() => setDeleteConfirm(item.id)}
                onManageIngredients={() => setIngredientItem(item)}
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
            <div style={{
              background: "var(--bg-elevated)", border: "1.5px solid var(--border-medium)",
              borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 400,
              maxHeight: "90vh", overflowY: "auto", animation: "fadeInUp 0.2s ease",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, fontFamily: "'Playfair Display', serif" }}>
                {editingId ? "Edit Menu Item" : "Add Menu Item"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FormField label="Item ID" hint="e.g. m17 (must be unique)">
                  <input value={form.id} onChange={(e) => setField("id", e.target.value)} placeholder="m17"
                    style={{ opacity: editingId ? 0.5 : 1, cursor: editingId ? "not-allowed" : "text" }}
                    disabled={!!editingId} />
                </FormField>
                <FormField label="Name">
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Item name" />
                </FormField>
                <FormField label="Category">
                  <select value={form.category} onChange={(e) => setField("category", e.target.value)}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", padding: "9px 12px", fontSize: 13, width: "100%" }}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="Price (₱)">
                  <input type="number" value={form.price} onChange={(e) => setField("price", e.target.value)}
                    placeholder="0.00" min="0" step="0.01"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", padding: "9px 12px", fontSize: 13, width: "100%" }} />
                </FormField>
                <FormField label="Badge (optional)" hint="e.g. SIGNATURE, NEW">
                  <input value={form.badge} onChange={(e) => setField("badge", e.target.value)} placeholder="SIGNATURE" />
                </FormField>
                <FormField label="Description">
                  <textarea value={form.description} onChange={(e) => setField("description", e.target.value)}
                    placeholder="Short description..."
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", padding: "9px 12px", fontSize: 13, width: "100%", resize: "vertical", minHeight: 64 }} />
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
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
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
                <button onClick={closeForm} style={{
                  flex: 1, padding: "11px 0", borderRadius: 9, border: "1px solid var(--border-default)",
                  background: "transparent", color: "var(--text-secondary)", fontSize: 10, fontWeight: 700,
                  letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" as const,
                }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{
                  flex: 1, padding: "11px 0", borderRadius: 9, border: "none", background: "var(--gold)",
                  color: "var(--bg-sidebar)", fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  cursor: saving ? "not-allowed" : "pointer", textTransform: "uppercase" as const,
                  opacity: saving ? 0.6 : 1,
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
  deleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

const AdminItemCard: React.FC<AdminItemCardProps> = ({ item, onEdit, onDelete, onManageIngredients, deleteConfirm, onConfirmDelete, onCancelDelete }) => (
  <div style={{
    background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
    borderRadius: 12, padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 6,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{ fontSize: 22 }}>{item.emoji}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {item.popular && <span style={{ fontSize: 7, fontWeight: 700, background: "var(--gold)", color: "var(--bg-sidebar)", padding: "2px 5px", borderRadius: 4, letterSpacing: 1 }}>POP</span>}
        {item.badge && <span style={{ fontSize: 7, fontWeight: 700, color: "var(--gold)", border: "1px solid var(--gold-dim)", padding: "2px 5px", borderRadius: 4, letterSpacing: 1 }}>{item.badge}</span>}
      </div>
    </div>
    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{item.name}</div>
    <div style={{ fontSize: 10, color: "var(--gold-muted)", letterSpacing: 0.5 }}>{item.category}</div>
    <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(item.price)}</div>

    {deleteConfirm ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
        <div style={{ fontSize: 9, color: "var(--danger)", textAlign: "center" }}>Delete this item?</div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={onCancelDelete} style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>No</button>
          <button onClick={onConfirmDelete} style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "none", background: "var(--danger)", color: "#fff", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>Yes, Delete</button>
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
        <button onClick={onEdit} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--border-medium)", background: "transparent", color: "var(--text-secondary)", fontSize: 8, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" as const }}>
          Edit
        </button>
        <button onClick={onManageIngredients} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid rgba(201,135,58,0.4)", background: "rgba(201,135,58,0.08)", color: "var(--gold)", fontSize: 8, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" as const }}>
          🧾 Ingredients
        </button>
        <button onClick={onDelete} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--danger-border)", background: "transparent", color: "var(--danger)", fontSize: 8, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>
          ✕
        </button>
      </div>
    )}
  </div>
);

// ── Form Field ────────────────────────────────────────────────────────────────

const FormField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" as const, fontWeight: 700 }}>
      {label}{hint && <span style={{ fontWeight: 400, color: "var(--text-faint)", textTransform: "none" as const, marginLeft: 4 }}>{hint}</span>}
    </div>
    {children}
  </div>
);