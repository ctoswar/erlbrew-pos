import React, { useState, useEffect, useCallback } from "react";
import { InventoryItem, InventoryMovement, MovementType } from "../types";
import { apiAdminGet, apiAdminPost, apiAdminPut, apiAdminDelete } from "../utils/api";

const CATEGORIES = ["Cups", "Lids", "Supplies", "Milk", "Coffee", "Syrups", "Powders", "Tea", "Other"];
const UNITS = ["pcs", "kg", "g", "L", "ml", "boxes", "packs"];

const MOVEMENT_LABELS: Record<MovementType, string> = {
  sale: 'Sold',
  restock: 'Restocked',
  adjustment: 'Adjusted',
  void: 'Void Restore',
};
const MOVEMENT_COLORS: Record<MovementType, string> = {
  sale: 'var(--danger)',
  restock: 'var(--success)',
  adjustment: 'var(--gold)',
  void: '#e8a020',
};

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

  // Movement history state
  const [movementItemId, setMovementItemId] = useState<string | null>(null);
  const [movementItemName, setMovementItemName] = useState("");
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [allMovements, setAllMovements] = useState<InventoryMovement[]>([]);
  const [allMovementsLoading, setAllMovementsLoading] = useState(false);

  // Restock/adjust modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustItemId, setAdjustItemId] = useState("");
  const [adjustItemName, setAdjustItemName] = useState("");
  const [adjustType, setAdjustType] = useState<MovementType>('restock');
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

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

  // Form

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

  // Movement History

  const loadMovements = useCallback(async (itemId: string) => {
    setMovementsLoading(true);
    try {
      const data = await apiAdminGet<InventoryMovement[]>(`/inventory/movements?itemId=${itemId}&limit=50`);
      setMovements(data);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }, []);

  const openMovements = (itemId: string, itemName: string) => {
    setMovementItemId(itemId);
    setMovementItemName(itemName);
    loadMovements(itemId);
  };

  const openAllMovements = async () => {
    setShowAllMovements(true);
    setAllMovementsLoading(true);
    try {
      const data = await apiAdminGet<InventoryMovement[]>('/inventory/movements?limit=200');
      setAllMovements(data);
    } catch {
      setAllMovements([]);
    } finally {
      setAllMovementsLoading(false);
    }
  };

  // Manual Restock/Adjust

  const openAdjustModal = (itemId: string, itemName: string) => {
    setAdjustItemId(itemId);
    setAdjustItemName(itemName);
    setAdjustType('restock');
    setAdjustQty("");
    setAdjustNotes("");
    setShowAdjustModal(true);
  };

  const handleManualAdjust = async () => {
    const qty = parseFloat(adjustQty);
    if (!qty || qty <= 0) return;
    setAdjustSaving(true);
    try {
      await apiAdminPost('/inventory/movements', {
        inventory_item_id: adjustItemId,
        movement_type: adjustType,
        quantity: qty,
        notes: adjustNotes || null,
      });
      setShowAdjustModal(false);
      loadItems();
      if (movementItemId === adjustItemId) loadMovements(adjustItemId);
    } catch (e: any) {
      setError(`Failed: ${e.message}`);
    } finally {
      setAdjustSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header */}
      <div className="glass-panel flex items-center justify-between px-4 py-3 border-b border-erl-accent/10 flex-shrink-0 rounded-none">
        <div className="font-display text-sm font-bold text-erl-text-primary tracking-wide">
          Inventory
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-erl-text-faint tracking-wide">{items.length} items</span>
          <button onClick={openAllMovements} className="btn btn-outline text-[9px] px-2.5 py-[7px] tracking-wide">
            📋 Movement Log
          </button>
          <button onClick={openAddForm} className="btn btn-accent text-[9px] px-3.5 py-[7px] tracking-wide">
            + Add Item
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1.5 px-4 py-3 overflow-x-auto flex-shrink-0 scrollbar-none">
        {categories.map((cat) => {
          const count = cat === "All" ? items.length : items.filter((i) => i.category === cat).length;
          const isActive = activeCategory === cat;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`
              px-3.5 py-[5px] rounded-full flex-shrink-0 text-[9px] font-bold tracking-wide cursor-pointer uppercase whitespace-nowrap
              ${isActive ? "bg-erl-accent text-erl-sidebar border-[1.5px] border-erl-accent" : "bg-transparent text-erl-secondary border-[1.5px] border-erl-border-default"}
            `}>
              {cat} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Items grid */}
      <div className="scroll-area flex-1 px-4 py-2 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-shimmer w-[120px] h-3.5 rounded mx-auto mb-2" />
            <div className="animate-shimmer w-20 h-2.5 rounded mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-erl-text-disabled py-12 text-[11px] tracking-wide">
            No inventory items in this category
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
            {filtered.map((item) => (
              <InventoryCard
                key={item.id}
                item={item}
                onEdit={() => openEditForm(item)}
                onDelete={() => setDeleteConfirm(item.id)}
                onAdjustStock={(delta) => handleAdjustStock(item.id, item.stock, delta)}
                onShowHistory={() => openMovements(item.id, item.name)}
                onManualAdjust={() => openAdjustModal(item.id, item.name)}
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

      {/* Movement History Modal */}
      {movementItemId && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setMovementItemId(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-6 w-full max-w-[600px] max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center mb-3.5">
                <div>
                  <div className="font-display text-sm font-bold text-erl-text-primary">
                    Movement History
                  </div>
                  <div className="text-[10px] text-erl-muted">{movementItemName}</div>
                </div>
                <button onClick={() => setMovementItemId(null)} className="bg-none border-none text-erl-muted text-base cursor-pointer p-1">✕</button>
              </div>
              <div className="scroll-area flex-1 overflow-y-auto min-h-0">
                {movementsLoading ? (
                  <div className="text-center py-8 text-erl-text-disabled text-[10px]">Loading...</div>
                ) : movements.length === 0 ? (
                  <div className="text-center py-8 text-erl-text-disabled text-[10px]">No movements recorded for this item.</div>
                ) : (
                  <table className="w-full border-collapse text-[9px]">
                    <thead>
                      <tr className="border-b border-erl-border-subtle">
                        <th className="px-2 py-1.5 text-left text-erl-text-faint tracking-wide font-semibold">Type</th>
                        <th className="px-2 py-1.5 text-right text-erl-text-faint tracking-wide font-semibold">Qty</th>
                        <th className="px-2 py-1.5 text-center text-erl-text-faint tracking-wide font-semibold">Before</th>
                        <th className="px-2 py-1.5 text-center text-erl-text-faint tracking-wide font-semibold">After</th>
                        <th className="px-2 py-1.5 text-right text-erl-text-faint tracking-wide font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-b border-erl-border-subtle">
                          <td className="px-2 py-1.5">
                            <span className="font-semibold" style={{ color: MOVEMENT_COLORS[m.movement_type] }}>{MOVEMENT_LABELS[m.movement_type]}</span>
                            {m.reference_id && <span className="text-erl-text-faint ml-1">#{m.reference_id.slice(0, 8).toUpperCase()}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold">{m.quantity} {m.unit}</td>
                          <td className="px-2 py-1.5 text-center text-erl-muted">{m.stock_before}</td>
                          <td className="px-2 py-1.5 text-center text-erl-muted">{m.stock_after}</td>
                          <td className="px-2 py-1.5 text-right text-erl-text-faint whitespace-nowrap">
                            {new Date(m.created_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* All Movements Modal */}
      {showAllMovements && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setShowAllMovements(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-6 w-full max-w-[700px] max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center mb-3.5">
                <div>
                  <div className="font-display text-sm font-bold text-erl-text-primary">
                    📋 Full Movement Log
                  </div>
                  <div className="text-[10px] text-erl-muted">All stock changes across inventory</div>
                </div>
                <button onClick={() => setShowAllMovements(false)} className="bg-none border-none text-erl-muted text-base cursor-pointer p-1">✕</button>
              </div>
              <div className="scroll-area flex-1 overflow-y-auto min-h-0">
                {allMovementsLoading ? (
                  <div className="text-center py-8 text-erl-text-disabled text-[10px]">Loading...</div>
                ) : allMovements.length === 0 ? (
                  <div className="text-center py-8 text-erl-text-disabled text-[10px]">No movements recorded yet.</div>
                ) : (
                  <table className="w-full border-collapse text-[9px]">
                    <thead>
                      <tr className="border-b border-erl-border-subtle">
                        <th className="px-2 py-1.5 text-left text-erl-text-faint tracking-wide font-semibold">Item</th>
                        <th className="px-2 py-1.5 text-left text-erl-text-faint tracking-wide font-semibold">Type</th>
                        <th className="px-2 py-1.5 text-right text-erl-text-faint tracking-wide font-semibold">Qty</th>
                        <th className="px-2 py-1.5 text-center text-erl-text-faint tracking-wide font-semibold">Before</th>
                        <th className="px-2 py-1.5 text-center text-erl-text-faint tracking-wide font-semibold">After</th>
                        <th className="px-2 py-1.5 text-left text-erl-text-faint tracking-wide font-semibold">Ref</th>
                        <th className="px-2 py-1.5 text-right text-erl-text-faint tracking-wide font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMovements.map((m) => (
                        <tr key={m.id} className="border-b border-erl-border-subtle">
                          <td className="px-2 py-1.5 font-semibold text-erl-text-primary">{m.inventory_name}</td>
                          <td className="px-2 py-1.5">
                            <span className="font-semibold" style={{ color: MOVEMENT_COLORS[m.movement_type] }}>{MOVEMENT_LABELS[m.movement_type]}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold">{m.quantity} {m.unit}</td>
                          <td className="px-2 py-1.5 text-center text-erl-muted">{m.stock_before}</td>
                          <td className="px-2 py-1.5 text-center text-erl-muted">{m.stock_after}</td>
                          <td className="px-2 py-1.5 text-left text-erl-text-faint">
                            {m.reference_id ? `#${m.reference_id.slice(0, 8)}` : m.notes ? m.notes.slice(0, 24) : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right text-erl-text-faint whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Manual Restock/Adjust Modal */}
      {showAdjustModal && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setShowAdjustModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-6 w-full max-w-[360px]">
              <div className="font-display text-sm font-bold text-erl-text-primary mb-1">
                {adjustType === 'restock' ? 'Restock' : 'Adjust'} Inventory
              </div>
              <div className="text-[10px] text-erl-muted mb-4">{adjustItemName}</div>

              <div className="flex gap-1.5 mb-3.5">
                <button onClick={() => setAdjustType('restock')} className={`
                  flex-1 py-[7px] rounded-lg text-[9px] font-bold cursor-pointer
                  ${adjustType === 'restock' ? "border-[1.5px] border-erl-success bg-erl-success/10 text-erl-success" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-secondary"}
                `}>+ Restock</button>
                <button onClick={() => setAdjustType('adjustment')} className={`
                  flex-1 py-[7px] rounded-lg text-[9px] font-bold cursor-pointer
                  ${adjustType === 'adjustment' ? "border-[1.5px] border-erl-accent bg-erl-accent/10 text-erl-accent" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-secondary"}
                `}>− Adjustment</button>
              </div>

              <div className="mb-3">
                <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] font-bold uppercase">
                  Quantity
                </div>
                <input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="0" min="0" step="1" autoFocus
                  className="w-full box-border" />
              </div>

              <div className="mb-3.5">
                <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] font-bold uppercase">
                  Notes (optional)
                </div>
                <input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Weekly delivery" className="w-full box-border" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowAdjustModal(false)} className="btn btn-outline flex-1 text-[10px] py-2.5">
                  Cancel
                </button>
                <button onClick={handleManualAdjust} disabled={adjustSaving || !adjustQty || parseFloat(adjustQty) <= 0}
                  className="btn btn-accent flex-1 text-[10px] py-2.5">
                  {adjustSaving ? "Saving..." : adjustType === 'restock' ? "Restock" : "Adjust"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={closeForm} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto">
              <div className="font-display text-base font-bold text-erl-text-primary mb-4">
                {editingId ? "Edit Inventory Item" : "Add Inventory Item"}
              </div>

              <div className="flex flex-col gap-3">
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
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Current Stock">
                    <input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                      placeholder="0" min="0" step="1" />
                  </FormField>
                  <FormField label="Low Stock Alert">
                    <input type="number" value={form.low_stock_threshold} onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                      placeholder="10" min="0" />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
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
                <div className="mt-3 px-3 py-2 bg-erl-danger-bg border border-erl-danger-border rounded-lg text-[11px] text-erl-danger">
                  {error}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={closeForm} className="btn btn-outline flex-1 text-[10px] py-2.5">
                  Cancel
                </button>
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

// Inventory Card

interface InventoryCardProps {
  item: InventoryItem;
  onEdit: () => void;
  onDelete: () => void;
  onAdjustStock: (delta: number) => void;
  onShowHistory: () => void;
  onManualAdjust: () => void;
  deleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  stockStatus: string;
  stockStatusColor: string;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  item, onEdit, onDelete, onAdjustStock, onShowHistory, onManualAdjust,
  deleteConfirm, onConfirmDelete, onCancelDelete,
  stockStatus, stockStatusColor,
}) => (
  <div className="card px-3 py-2.5 flex flex-col gap-1.5">
    <div className="flex justify-between items-start">
      <div className="text-[11px] font-bold text-erl-text-primary leading-tight flex-1 mr-2">{item.name}</div>
      <span className="pill text-[7px] px-1.5 py-[2px] tracking-wider uppercase flex-shrink-0"
        style={{ color: stockStatusColor, background: "rgba(0,0,0,0.3)" }}>
        {stockStatus === "out" ? "OUT" : stockStatus === "low" ? "LOW" : "OK"}
      </span>
    </div>

    <div className="text-[9px] text-erl-accent-muted tracking-wide">{item.category}</div>

    {/* Stock row with quick +/- buttons */}
    <div className="flex items-center gap-1.5 mt-0.5">
      <button onClick={() => onAdjustStock(-1)} className="btn-ghost w-[26px] h-[26px] text-base flex items-center justify-center border border-erl-border-default rounded-md p-0">−</button>
      <div className="flex-1 text-center">
        <span className="text-lg font-bold" style={{ color: stockStatusColor }}>{item.stock}</span>
        <span className="text-[10px] text-erl-muted ml-1">{item.unit}</span>
      </div>
      <button onClick={() => onAdjustStock(1)} className="btn-ghost w-[26px] h-[26px] text-base text-erl-accent flex items-center justify-center border border-erl-border-default rounded-md p-0">+</button>
    </div>

    <div className="text-[8.5px] text-erl-text-faint tracking-wide">
      Alert below: {item.low_stock_threshold} {item.unit}
    </div>

    {(item.purchase_cost != null || item.unit_cost != null) && (
      <div className="flex gap-2 mt-0.5">
        {item.purchase_cost != null && (
          <div className="text-[8.5px] text-erl-muted">
            Cost: <span className="text-erl-secondary font-semibold">₱{Number(item.purchase_cost).toFixed(2)}</span>
          </div>
        )}
        {item.unit_cost != null && (
          <div className="text-[8.5px] text-erl-muted">
            Unit: <span className="text-erl-secondary font-semibold">₱{Number(item.unit_cost).toFixed(2)}</span>
          </div>
        )}
      </div>
    )}

    {deleteConfirm ? (
      <div className="flex flex-col gap-[5px] mt-1">
        <div className="text-[9px] text-erl-danger text-center font-semibold">Delete this item?</div>
        <div className="flex gap-[5px]">
          <button onClick={onCancelDelete} className="btn btn-outline flex-1 text-[8px] py-1.5 rounded-md">No</button>
          <button onClick={onConfirmDelete} className="btn btn-danger flex-1 text-[8px] py-1.5 rounded-md bg-erl-danger border-none text-white">Yes, Delete</button>
        </div>
      </div>
    ) : (
      <div className="flex gap-1 mt-1">
        <button onClick={onManualAdjust} className="btn-ghost flex-1 text-[7px] py-[5px] rounded-lg border border-erl-border-medium tracking-wider uppercase text-erl-accent">
          + Restock
        </button>
        <button onClick={onShowHistory} className="btn-ghost flex-1 text-[7px] py-[5px] rounded-lg border border-erl-border-medium tracking-wider uppercase">
          History
        </button>
        <button onClick={onEdit} className="btn-ghost flex-[0.7] text-[7px] py-[5px] rounded-lg border border-erl-border-medium tracking-wider uppercase">
          Edit
        </button>
        <button onClick={onDelete} className="btn-ghost px-2 py-[5px] rounded-lg border border-erl-danger-border text-erl-danger text-[8px] tracking-wide">
          ✕
        </button>
      </div>
    )}
  </div>
);

// Form Field

const FormField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] uppercase font-bold">
      {label}
      {hint && <span className="font-normal text-erl-text-faint normal-case ml-1">{hint}</span>}
    </div>
    {children}
  </div>
);
