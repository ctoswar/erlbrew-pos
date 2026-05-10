import React, { useState, useEffect } from "react";
import { InventoryItem } from "../types";
import { apiAdminGet, apiAdminPost, apiAdminPut, apiAdminDelete } from "../utils/api";

const CATEGORIES = ["Cups", "Lids", "Supplies", "Milk", "Coffee", "Syrups", "Powders", "Tea", "Other"];
const UNITS = ["pcs", "kg", "g", "L", "ml", "boxes", "packs"];

const EMPTY_FORM = {
  id: "",
  name: "",
  category: "Cups",
  unit: "pcs",
  stock: "",
  low_stock_threshold: "10",
  purchase_cost: "",
  unit_cost: "",
};

export const AdminInventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const loadItems = () => {
    setLoading(true);
    apiAdminGet<InventoryItem[]>("/inventory")
      .then(setItems)
      .catch(() => setError("Failed to load inventory"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadItems(); }, []);

  const categories = ["All", ...CATEGORIES];
  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock <= 0) return "out";
    if (item.stock <= (item.low_stock_threshold || 10)) return "low";
    return "ok";
  };

  const stockStatusColor = (status: string) => {
    if (status === "out") return "var(--danger)";
    if (status === "low") return "#e8a020";
    return "var(--success)";
  };

  // ── Form ─────────────────────────────────────────────────────────────────────

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const openEditForm = (item: InventoryItem) => {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      stock: String(item.stock),
      low_stock_threshold: String(item.low_stock_threshold),
      purchase_cost: item.purchase_cost != null ? String(item.purchase_cost) : "",
      unit_cost: item.unit_cost != null ? String(item.unit_cost) : "",
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

  const handleSave = async () => {
    if (!form.id.trim() || !form.name.trim()) {
      setError("ID and name are required");
      return;
    }
    const stock = parseFloat(form.stock);
    if (isNaN(stock) || stock < 0) {
      setError("Stock must be 0 or higher");
      return;
    }
    if (form.purchase_cost && isNaN(parseFloat(form.purchase_cost))) {
      setError("Purchase cost must be a number");
      return;
    }
    if (form.unit_cost && isNaN(parseFloat(form.unit_cost))) {
      setError("Unit cost must be a number");
      return;
    }

    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      id: form.id.trim(),
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      stock,
      low_stock_threshold: parseFloat(form.low_stock_threshold) || 10,
    };
    if (form.purchase_cost) payload.purchase_cost = parseFloat(form.purchase_cost);
    if (form.unit_cost) payload.unit_cost = parseFloat(form.unit_cost);

    try {
      if (editingId) {
        await apiAdminPut(`/inventory/${editingId}`, payload);
      } else {
        await apiAdminPost("/inventory", payload);
      }
      closeForm();
      loadItems();
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("401") || msg.includes("NO_TOKEN") || msg.includes("INVALID_TOKEN") || msg.includes("TOKEN_EXPIRED")) {
        setError("Session expired — please log out and log in again.");
      } else {
        setError(e.message || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiAdminDelete(`/inventory/${id}`);
      setDeleteConfirm(null);
      loadItems();
    } catch (e) {
      setError("Failed to delete");
    }
  };

  const handleAdjustStock = async (itemId: string, currentStock: number | string, delta: number) => {
    const stockNum = Number(currentStock);
    const newStock = Math.max(0, stockNum + delta);
    try {
      await apiAdminPut(`/inventory/${itemId}`, { stock: newStock });
      loadItems();
    } catch (e: any) {
      setError(`Failed to update stock: ${e.message}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Header */}
      <div className="glass-panel" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.8rem 1rem", borderBottom: "1px solid rgba(201,135,58,0.08)", flexShrink: 0,
        borderRadius: 0,
      }}>
        <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
          Inventory
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 1 }}>{items.length} items</span>
          <button onClick={openAddForm} className="btn btn-gold" style={{ fontSize: 9, padding: "7px 14px", letterSpacing: 1 }}>
            + Add Item
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div style={{ display: "flex", gap: 6, padding: "0.7rem 1rem", overflowX: "auto", flexShrink: 0, scrollbarWidth: "none" }}>
        {categories.map((cat) => {
          const count = cat === "All" ? items.length : items.filter((i) => i.category === cat).length;
          const isActive = activeCategory === cat;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: "5px 14px", borderRadius: 20, flexShrink: 0,
              border: `1.5px solid ${isActive ? "var(--gold)" : "var(--border-default)"}`,
              background: isActive ? "var(--gold)" : "transparent",
              color: isActive ? "var(--bg-sidebar)" : "var(--text-secondary)",
              fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
              textTransform: "uppercase" as const, whiteSpace: "nowrap",
            }}>
              {cat} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Items grid */}
      <div className="scroll-area" style={{ flex: 1, padding: "0.5rem 1rem", overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div className="animate-shimmer" style={{ width: 120, height: 14, borderRadius: 4, margin: "0 auto 8px" }} />
            <div className="animate-shimmer" style={{ width: 80, height: 10, borderRadius: 4, margin: "0 auto" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-disabled)", padding: "3rem", fontSize: 11, letterSpacing: 1 }}>
            No inventory items in this category
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {filtered.map((item) => (
              <InventoryCard
                key={item.id}
                item={item}
                onEdit={() => openEditForm(item)}
                onDelete={() => setDeleteConfirm(item.id)}
                onAdjustStock={(delta) => handleAdjustStock(item.id, item.stock, delta)}
                deleteConfirm={deleteConfirm === item.id}
                onConfirmDelete={() => handleDelete(item.id)}
                onCancelDelete={() => setDeleteConfirm(null)}
                stockStatus={getStockStatus(item)}
                stockStatusColor={stockStatusColor(getStockStatus(item))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 998, animation: "fadeInOverlay 0.2s ease" }} onClick={closeForm} />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
            <div className="animate-scaleIn card-glass" style={{
              padding: "1.5rem", width: "100%", maxWidth: 420,
              maxHeight: "90vh", overflowY: "auto",
            }}>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>
                {editingId ? "Edit Inventory Item" : "Add Inventory Item"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FormField label="Item ID" hint="Short code, e.g. cup-s">
                  <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                    placeholder="cup-s" disabled={!!editingId} />
                </FormField>
                <FormField label="Name">
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Medium Cup (12oz)" />
                </FormField>
                <FormField label="Category">
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="Unit">
                  <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </FormField>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <FormField label="Current Stock">
                    <input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                      placeholder="0" min="0" step="1" />
                  </FormField>
                  <FormField label="Low Stock Alert">
                    <input type="number" value={form.low_stock_threshold} onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                      placeholder="10" min="0" />
                  </FormField>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <FormField label="Purchase Cost" hint="₱ per unit">
                    <input type="number" value={form.purchase_cost} onChange={(e) => setForm((f) => ({ ...f, purchase_cost: e.target.value }))}
                      placeholder="0.00" min="0" step="0.01" />
                  </FormField>
                  <FormField label="Unit Cost" hint="₱ per serving">
                    <input type="number" value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
                      placeholder="0.00" min="0" step="0.01" />
                  </FormField>
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: "9px 12px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 8, fontSize: 11, color: "var(--danger)" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button onClick={closeForm} className="btn btn-outline" style={{ flex: 1, fontSize: 10, padding: "11px 0" }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="btn btn-gold" style={{ flex: 1, fontSize: 10, padding: "11px 0" }}>
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

// ── Inventory Card ─────────────────────────────────────────────────────────────

interface InventoryCardProps {
  item: InventoryItem;
  onEdit: () => void;
  onDelete: () => void;
  onAdjustStock: (delta: number) => void;
  deleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  stockStatus: string;
  stockStatusColor: string;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  item, onEdit, onDelete, onAdjustStock,
  deleteConfirm, onConfirmDelete, onCancelDelete,
  stockStatus, stockStatusColor,
}) => (
  <div className="card" style={{ padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, flex: 1, marginRight: 8 }}>{item.name}</div>
      <span className="pill" style={{
        fontSize: 7, color: stockStatusColor, background: "rgba(0,0,0,0.3)",
        padding: "2px 6px", letterSpacing: 1, textTransform: "uppercase", flexShrink: 0,
      }}>
        {stockStatus === "out" ? "OUT" : stockStatus === "low" ? "LOW" : "OK"}
      </span>
    </div>

    <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 0.5 }}>{item.category}</div>

    {/* Stock row with quick +/- buttons */}
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
      <button onClick={() => onAdjustStock(-1)} className="btn-ghost" style={{
        width: 26, height: 26, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--border-default)", borderRadius: 7, padding: 0,
      }}>−</button>
      <div style={{ flex: 1, textAlign: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: stockStatusColor }}>{item.stock}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 3 }}>{item.unit}</span>
      </div>
      <button onClick={() => onAdjustStock(1)} className="btn-ghost" style={{
        width: 26, height: 26, fontSize: 16, color: "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--border-default)", borderRadius: 7, padding: 0,
      }}>+</button>
    </div>

    <div style={{ fontSize: 8.5, color: "var(--text-faint)", letterSpacing: 0.5 }}>
      Alert below: {item.low_stock_threshold} {item.unit}
    </div>

    {(item.purchase_cost != null || item.unit_cost != null) && (
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        {item.purchase_cost != null && (
          <div style={{ fontSize: 8.5, color: "var(--text-muted)" }}>
            Cost: <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>₱{Number(item.purchase_cost).toFixed(2)}</span>
          </div>
        )}
        {item.unit_cost != null && (
          <div style={{ fontSize: 8.5, color: "var(--text-muted)" }}>
            Unit: <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>₱{Number(item.unit_cost).toFixed(2)}</span>
          </div>
        )}
      </div>
    )}

    {deleteConfirm ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
        <div style={{ fontSize: 9, color: "var(--danger)", textAlign: "center", fontWeight: 600 }}>Delete this item?</div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={onCancelDelete} className="btn btn-outline" style={{ flex: 1, fontSize: 8, padding: "6px 0", borderRadius: 7 }}>No</button>
          <button onClick={onConfirmDelete} className="btn btn-danger" style={{ flex: 1, fontSize: 8, padding: "6px 0", borderRadius: 7, background: "var(--danger)", border: "none", color: "#fff" }}>Yes, Delete</button>
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
        <button onClick={onEdit} className="btn-ghost" style={{
          flex: 1, fontSize: 8, padding: "6px 0", borderRadius: 8,
          border: "1px solid var(--border-medium)", letterSpacing: 1, textTransform: "uppercase",
        }}>
          Edit
        </button>
        <button onClick={onDelete} className="btn-ghost" style={{
          padding: "6px 10px", borderRadius: 8, border: "1px solid var(--danger-border)",
          color: "var(--danger)", fontSize: 8, letterSpacing: 1,
        }}>
          ✕
        </button>
      </div>
    )}
  </div>
);

// ── Form Field ─────────────────────────────────────────────────────────────────

const FormField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" as const, fontWeight: 700 }}>
      {label}
      {hint && <span style={{ fontWeight: 400, color: "var(--text-faint)", textTransform: "none" as const, marginLeft: 4 }}>{hint}</span>}
    </div>
    {children}
  </div>
);