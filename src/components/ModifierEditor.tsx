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
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        zIndex: 998, animation: "fadeInOverlay 0.2s ease",
      }} onClick={onClose} />
      <div style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 999, padding: "1rem",
      }}>
        <div style={{
          background: "var(--bg-elevated)",
          border: "1.5px solid var(--border-medium)",
          borderRadius: 16, padding: "1.5rem",
          width: "100%", maxWidth: 420,
          maxHeight: "90vh", overflowY: "auto",
          animation: "fadeInUp 0.2s ease",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
                fontFamily: "'Playfair Display', serif",
              }}>
                {item.emoji} {item.name} — Modifiers
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                Add-ons & customizations for this item
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "var(--text-muted)",
              fontSize: 18, cursor: "pointer",
            }}>✕</button>
          </div>

          {error && (
            <div style={{
              background: "rgba(220,50,50,0.12)", border: "1px solid rgba(220,50,50,0.3)",
              borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "var(--error)"
            }}>
              {error}
            </div>
          )}

          {/* Modifier list */}
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem", fontSize: 12 }}>
              Loading...
            </div>
          ) : modifiers.length === 0 && !showAddForm ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem", fontSize: 12 }}>
              No modifiers yet. Add some below.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {modifiers.map((mod) => (
                <div key={mod.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1.5px solid var(--border-default)",
                  background: "var(--bg-surface)",
                }}>
                  {editingId === mod.id ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Modifier name"
                        style={{
                          width: "100%", padding: "5px 8px", borderRadius: 6,
                          border: "1.5px solid var(--border-default)",
                          background: "var(--bg-elevated)", color: "var(--text-primary)",
                          fontSize: 12,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          placeholder="Price"
                          style={{
                            flex: 1, padding: "5px 8px", borderRadius: 6,
                            border: "1.5px solid var(--border-default)",
                            background: "var(--bg-elevated)", color: "var(--text-primary)",
                            fontSize: 11,
                          }}
                        />
                        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-secondary)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={form.isDefault}
                            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                          />
                          Default
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => handleSaveEdit(mod.id!)} disabled={saving} style={{
                          flex: 1, padding: "5px 0", borderRadius: 6,
                          background: "var(--gold)", color: "var(--bg-sidebar)",
                          border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer",
                        }}>Save</button>
                        <button onClick={cancelEdit} style={{
                          flex: 1, padding: "5px 0", borderRadius: 6,
                          background: "var(--bg-elevated)", color: "var(--text-muted)",
                          border: "1.5px solid var(--border-default)", fontSize: 10, fontWeight: 700, cursor: "pointer",
                        }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                          {mod.name}
                          {mod.isDefault && (
                            <span style={{
                              marginLeft: 6, fontSize: 8, fontWeight: 700,
                              color: "var(--gold)", letterSpacing: 1,
                              textTransform: "uppercase" as const,
                            }}>DEFAULT</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--gold)" }}>
                          {mod.price > 0 ? `+${formatCurrency(mod.price)}` : "Free"}
                        </div>
                      </div>
                      <button onClick={() => startEdit(mod)} style={{
                        background: "none", border: "1px solid var(--border-default)",
                        borderRadius: 6, padding: "3px 8px", fontSize: 9, fontWeight: 700,
                        color: "var(--text-muted)", cursor: "pointer", letterSpacing: 0.5,
                      }}>Edit</button>
                      <button onClick={() => handleDelete(mod.id!)} style={{
                        background: "none", border: "1px solid rgba(220,50,50,0.3)",
                        borderRadius: 6, padding: "3px 8px", fontSize: 9, fontWeight: 700,
                        color: "var(--error)", cursor: "pointer", letterSpacing: 0.5,
                      }}>Del</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add modifier form / button */}
          {showAddForm ? (
            <div style={{
              border: "1.5px solid var(--border-medium)",
              borderRadius: 10, padding: "12px",
              background: "var(--bg-surface)",
            }}>
              <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: 1 }}>
                ADD NEW MODIFIER
              </div>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Extra shot, Oat milk, Whipped cream"
                style={{
                  width: "100%", padding: "7px 10px", borderRadius: 7,
                  border: "1.5px solid var(--border-default)",
                  background: "var(--bg-elevated)", color: "var(--text-primary)",
                  fontSize: 12, marginBottom: 8,
                }}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="Additional price (0 = free)"
                  style={{
                    flex: 1, padding: "7px 10px", borderRadius: 7,
                    border: "1.5px solid var(--border-default)",
                    background: "var(--bg-elevated)", color: "var(--text-primary)",
                    fontSize: 11,
                  }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  />
                  Default
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.name.trim()}
                  className="btn btn-gold"
                  style={{ flex: 1, padding: "7px 0", fontSize: 11 }}
                >
                  {saving ? "Saving..." : "Add Modifier"}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setForm({ name: "", price: "", isDefault: false }); }}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8,
                    background: "var(--bg-elevated)", color: "var(--text-muted)",
                    border: "1.5px solid var(--border-default)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); }}
              className="btn btn-gold"
              style={{ width: "100%", padding: "9px 0", fontSize: 11 }}
            >
              + Add Modifier
            </button>
          )}
        </div>
      </div>
    </>
  );
};