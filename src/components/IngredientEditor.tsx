import React, { useState, useEffect } from "react";
import { MenuItem } from "../types";
import { apiAdminGet, apiAdminPut } from "../utils/api";

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
}

interface Props {
  menuItem: MenuItem;
  onClose: () => void;
}

export const IngredientEditor: React.FC<Props> = ({ menuItem, onClose }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Build a map of current recipe: inventory_id → quantity
  const [selected, setSelected] = useState<Record<string, string>>({}); // inv_id → quantity string

  useEffect(() => {
    Promise.all([
      apiAdminGet<RecipeIngredient[]>(`/recipes/${menuItem.id}`),
      apiAdminGet<InventoryItem[]>("/inventory"),
    ])
      .then(([r, inv]) => {
        setInventory(inv);
        const init: Record<string, string> = {};
        r.forEach((rec) => { init[rec.inventory_item_id] = String(rec.quantity); });
        setSelected(init);
      })
      .catch((err) => console.error("Failed to load recipe/inventory:", err))
      .finally(() => setLoading(false));
  }, [menuItem.id]);

  const handleToggle = (invId: string) => {
    setSelected((prev) => {
      if (prev[invId]) {
        // Remove
        const next = { ...prev };
        delete next[invId];
        return next;
      } else {
        // Add with default qty 1
        return { ...prev, [invId]: "1" };
      }
    });
  };

  const handleQtyChange = (invId: string, val: string) => {
    setSelected((prev) => ({ ...prev, [invId]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = Object.entries(selected)
        .filter(([, qty]) => qty && parseFloat(qty) > 0)
        .map(([inventory_item_id, quantity]) => ({ inventory_item_id, quantity: parseFloat(quantity) }));

      await apiAdminPut(`/recipes/${menuItem.id}`, { items });
      onClose();
    } catch (err) { console.error("Failed to save ingredients:", err); }
    finally { setSaving(false); }
  };

  // Group inventory by category
  const categories = [...new Set(inventory.map((i) => i.category))].sort();
  const grouped = categories.map((cat) => ({
    cat,
    items: inventory.filter((i) => i.category === cat),
  }));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "var(--bg-elevated)",
        borderRadius: 16,
        width: "100%", maxWidth: 540,
        maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeInUp 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-default)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              Ingredients: {menuItem.name}
            </div>
            <div style={{ fontSize: 10, color: "var(--gold)", marginTop: 2 }}>
              {menuItem.emoji} {menuItem.category} · {menuItem.price ? `₱${menuItem.price}` : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>Loading...</div>
          ) : (
            <>
              <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase", fontWeight: 700 }}>
                Inventory Items — check items used per serving
              </div>

              {grouped.map(({ cat, items }) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" as const }}>{cat}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {items.map((inv) => {
                      const isChecked = !!selected[inv.id];
                      const qty = selected[inv.id] || "";
                      const isLow = inv.stock <= 3;

                      return (
                        <div key={inv.id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          background: isChecked ? "rgba(201,135,58,0.08)" : "transparent",
                          border: `1px solid ${isChecked ? "rgba(201,135,58,0.3)" : "var(--border-subtle)"}`,
                          borderRadius: 9, padding: "8px 12px",
                        }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(inv.id)}
                            style={{ width: 16, height: 16, accentColor: "var(--gold)", flexShrink: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{inv.name}</div>
                            <div style={{ fontSize: 9, color: isLow ? "var(--danger)" : "var(--text-faint)", marginTop: 1 }}>
                              Stock: {inv.stock} {inv.unit}
                              {isLow && " ⚠ LOW"}
                            </div>
                          </div>
                          {isChecked && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              <span style={{ fontSize: 9, color: "var(--text-faint)" }}>per serving:</span>
                              <input
                                type="number"
                                value={qty}
                                onChange={(e) => handleQtyChange(inv.id, e.target.value)}
                                min="0.01" step="0.1"
                                style={{
                                  width: 60, padding: "4px 6px", borderRadius: 6,
                                  border: "1px solid var(--border-medium)",
                                  background: "var(--bg-base)", color: "var(--text-primary)",
                                  fontSize: 11, textAlign: "center",
                                }}
                              />
                              <span style={{ fontSize: 9, color: "var(--text-faint)" }}>{inv.unit}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--border-default)",
          display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0,
        }}>
          <button onClick={onClose} className="btn btn-outline" style={{ fontSize: 10, padding: "8px 18px" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-gold" style={{ fontSize: 10, padding: "8px 18px", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save Ingredients"}
          </button>
        </div>
      </div>
    </div>
  );
};