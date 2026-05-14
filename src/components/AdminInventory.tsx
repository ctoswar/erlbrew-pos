import React, { useState, useEffect, useCallback, useMemo } from "react";
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

const MOVEMENT_ICONS: Record<MovementType, string> = {
  sale: '↓',
  restock: '↑',
  adjustment: '↔',
  void: '↩',
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
  const [searchQuery, setSearchQuery] = useState("");

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

  // Computed stats
  const stats = useMemo(() => {
    const total = items.length;
    const lowStock = items.filter(i => i.stock > 0 && i.stock <= (i.low_stock_threshold || 10)).length;
    const outOfStock = items.filter(i => i.stock <= 0).length;
    return { total, lowStock, outOfStock };
  }, [items]);

  // Filtered items (category + search)
  const filtered = useMemo(() => {
    let result = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeCategory, searchQuery]);

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
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="glass-panel flex items-center justify-between px-5 py-3.5 border-b border-erl-accent/10 flex-shrink-0 rounded-none">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-base font-bold text-erl-text-primary tracking-wide">
            Inventory
          </h2>
          <span className="text-[11px] text-erl-text-faint tracking-wide tabular-nums">{items.length} items</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={openAllMovements} className="btn btn-outline text-[11px] px-4 py-2 tracking-wide">
            Movement Log
          </button>
          <button onClick={openAddForm} className="btn btn-accent text-[11px] px-4 py-2 tracking-wide">
            + Add Item
          </button>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-5 pt-4 flex-shrink-0">
        <StatCard label="Total Items" value={stats.total} icon="📦" accent />
        <StatCard label="Low Stock" value={stats.lowStock} icon="⚠️" warn={stats.lowStock > 0} />
        <StatCard label="Out of Stock" value={stats.outOfStock} icon="🚫" danger={stats.outOfStock > 0} />
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
            placeholder="Search items by name or ID…"
            className="w-full box-border pl-9 !py-2.5 !text-[13px] !rounded-xl"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-erl-text-faint hover:text-erl-text-primary transition-colors text-sm cursor-pointer bg-transparent border-none">
              ✕
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {categories.map((cat) => {
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
            <span className="text-2xl">📭</span>
            <div className="text-[13px] text-erl-text-disabled tracking-wide">
              {searchQuery ? "No items match your search" : "No inventory items in this category"}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
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

      {/* ── Movement History Modal ──────────────────────────── */}
      {movementItemId && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998] animate-fade-in-overlay" onClick={() => setMovementItemId(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-0 w-full max-w-[640px] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl">
              {/* Modal header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-erl-border-subtle">
                <div>
                  <div className="font-display text-[15px] font-bold text-erl-text-primary">
                    Movement History
                  </div>
                  <div className="text-[12px] text-erl-text-muted mt-0.5">{movementItemName}</div>
                </div>
                <button onClick={() => setMovementItemId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-text-primary hover:bg-erl-surface transition-colors cursor-pointer bg-transparent border-none text-base">
                  ✕
                </button>
              </div>

              {/* Modal body */}
              <div className="scroll-area flex-1 overflow-y-auto min-h-0 px-6 py-3">
                {movementsLoading ? (
                  <div className="text-center py-10">
                    <div className="animate-shimmer w-24 h-4 rounded-md mx-auto mb-2" />
                    <div className="animate-shimmer w-16 h-3 rounded-md mx-auto" />
                  </div>
                ) : movements.length === 0 ? (
                  <div className="text-center py-10 text-erl-text-disabled">
                    <p className="text-[13px]">No movements recorded for this item.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {movements.map((m) => (
                      <MovementRow key={m.id} movement={m} showItemName={false} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── All Movements Modal ─────────────────────────────── */}
      {showAllMovements && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998] animate-fade-in-overlay" onClick={() => setShowAllMovements(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-0 w-full max-w-[740px] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl">
              {/* Modal header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-erl-border-subtle">
                <div>
                  <div className="font-display text-[15px] font-bold text-erl-text-primary">
                    Full Movement Log
                  </div>
                  <div className="text-[12px] text-erl-text-muted mt-0.5">All stock changes across inventory</div>
                </div>
                <button onClick={() => setShowAllMovements(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-text-primary hover:bg-erl-surface transition-colors cursor-pointer bg-transparent border-none text-base">
                  ✕
                </button>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_90px_70px_60px_60px_100px] gap-2 px-6 py-2 text-[11px] font-bold text-erl-text-faint uppercase tracking-wider border-b border-erl-border-subtle">
                <div>Item</div>
                <div>Type</div>
                <div className="text-right">Qty</div>
                <div className="text-center">Before</div>
                <div className="text-center">After</div>
                <div className="text-right">Time</div>
              </div>

              {/* Modal body */}
              <div className="scroll-area flex-1 overflow-y-auto min-h-0">
                {allMovementsLoading ? (
                  <div className="text-center py-10">
                    <div className="animate-shimmer w-24 h-4 rounded-md mx-auto mb-2" />
                    <div className="animate-shimmer w-16 h-3 rounded-md mx-auto" />
                  </div>
                ) : allMovements.length === 0 ? (
                  <div className="text-center py-10 text-erl-text-disabled">
                    <p className="text-[13px]">No movements recorded yet.</p>
                  </div>
                ) : (
                  <div className="px-6 py-2">
                    {allMovements.map((m) => (
                      <div key={m.id} className="grid grid-cols-[1fr_90px_70px_60px_60px_100px] gap-2 py-2.5 border-b border-erl-border-subtle/50 text-[12px] items-center">
                        <div className="font-medium text-erl-text-primary truncate">{m.inventory_name}</div>
                        <div>
                          <span className="font-semibold text-[11px]" style={{ color: MOVEMENT_COLORS[m.movement_type] }}>
                            {MOVEMENT_ICONS[m.movement_type]} {MOVEMENT_LABELS[m.movement_type]}
                          </span>
                        </div>
                        <div className="text-right font-bold tabular-nums">{m.quantity} {m.unit}</div>
                        <div className="text-center text-erl-text-muted tabular-nums">{m.stock_before}</div>
                        <div className="text-center text-erl-text-muted tabular-nums">{m.stock_after}</div>
                        <div className="text-right text-erl-text-faint text-[11px] whitespace-nowrap tabular-nums">
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Manual Restock/Adjust Modal ─────────────────────── */}
      {showAdjustModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998] animate-fade-in-overlay" onClick={() => setShowAdjustModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-0 w-full max-w-[400px] overflow-hidden rounded-2xl">
              {/* Modal header */}
              <div className="px-6 pt-5 pb-4 border-b border-erl-border-subtle">
                <div className="font-display text-base font-bold text-erl-text-primary">
                  {adjustType === 'restock' ? 'Resupply Stock' : 'Adjust Stock'}
                </div>
                <div className="text-[12px] text-erl-text-muted mt-1">{adjustItemName}</div>
              </div>

              <div className="px-6 py-5 flex flex-col gap-4">
                {/* Type toggle */}
                <div className="flex gap-2">
                  <button onClick={() => setAdjustType('restock')} className={`
                    flex-1 py-2.5 rounded-xl text-[12px] font-bold cursor-pointer transition-all duration-200
                    ${adjustType === 'restock'
                      ? "bg-erl-success/15 border-[1.5px] border-erl-success text-erl-success"
                      : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
                    }
                  `}>↑ Restock</button>
                  <button onClick={() => setAdjustType('adjustment')} className={`
                    flex-1 py-2.5 rounded-xl text-[12px] font-bold cursor-pointer transition-all duration-200
                    ${adjustType === 'adjustment'
                      ? "bg-erl-accent/15 border-[1.5px] border-erl-accent text-erl-accent"
                      : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
                    }
                  `}>↔ Adjust</button>
                </div>

                <FormSection label="Quantity">
                  <input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder="0" min="0" step="1" autoFocus
                    className="w-full box-border text-center text-[18px] font-bold !py-3" />
                </FormSection>

                <FormSection label="Notes" hint="optional">
                  <input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="e.g. Weekly delivery" className="w-full box-border" />
                </FormSection>
              </div>

              {/* Modal footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-erl-border-subtle">
                <button onClick={() => setShowAdjustModal(false)} className="btn btn-outline flex-1 text-[12px] py-2.5">
                  Cancel
                </button>
                <button onClick={handleManualAdjust} disabled={adjustSaving || !adjustQty || parseFloat(adjustQty) <= 0}
                  className="btn btn-accent flex-1 text-[12px] py-2.5">
                  {adjustSaving ? "Saving…" : adjustType === 'restock' ? "Confirm Restock" : "Confirm Adjustment"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Add/Edit Modal ──────────────────────────────────── */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998] animate-fade-in-overlay" onClick={closeForm} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-0 w-full max-w-[460px] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl">
              {/* Modal header */}
              <div className="px-6 pt-5 pb-4 border-b border-erl-border-subtle">
                <div className="font-display text-lg font-bold text-erl-text-primary">
                  {editingId ? "Edit Item" : "New Inventory Item"}
                </div>
                <div className="text-[12px] text-erl-text-muted mt-0.5">
                  {editingId ? "Update item details below" : "Fill in the details to add a new item"}
                </div>
              </div>

              {/* Form body */}
              <div className="scroll-area flex-1 overflow-y-auto min-h-0 px-6 py-5">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormSection label="Item ID" hint="e.g. cup-s">
                      <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                        placeholder="cup-s" disabled={!!editingId}
                        className={editingId ? "opacity-50 cursor-not-allowed" : ""} />
                    </FormSection>
                    <FormSection label="Name">
                      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Medium Cup (12oz)" />
                    </FormSection>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormSection label="Category">
                      <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </FormSection>
                    <FormSection label="Unit">
                      <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </FormSection>
                  </div>

                  <div className="h-px bg-erl-border-subtle" />

                  <div className="grid grid-cols-2 gap-3">
                    <FormSection label="Current Stock">
                      <input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                        placeholder="0" min="0" step="1" />
                    </FormSection>
                    <FormSection label="Low Stock Threshold">
                      <input type="number" value={form.low_stock_threshold} onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                        placeholder="10" min="0" />
                    </FormSection>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormSection label="Purchase Cost" hint="₱/unit">
                      <input type="number" value={form.purchase_cost} onChange={(e) => setForm((f) => ({ ...f, purchase_cost: e.target.value }))}
                        placeholder="0.00" min="0" step="0.01" />
                    </FormSection>
                    <FormSection label="Unit Cost" hint="₱/serving">
                      <input type="number" value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
                        placeholder="0.00" min="0" step="0.01" />
                    </FormSection>
                  </div>
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
                <button onClick={closeForm} className="btn btn-outline flex-1 text-[12px] py-2.5">
                  Cancel
                </button>
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

// ── Sub-components ──────────────────────────────────────────

/** Summary stat card */
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: string;
  accent?: boolean;
  warn?: boolean;
  danger?: boolean;
}> = ({ label, value, icon, accent, warn, danger }) => (
  <div className={`
    rounded-xl px-4 py-3 flex items-center gap-3 border transition-all duration-200
    ${accent
      ? "bg-erl-accent/8 border-erl-accent/20"
      : danger
        ? "bg-erl-danger/8 border-erl-danger-border/50"
        : warn
          ? "bg-erl-accent/6 border-erl-border-default"
          : "bg-erl-surface border-erl-border-subtle"
    }
  `}>
    <span className="text-[18px]">{icon}</span>
    <div className="flex flex-col">
      <span className={`
        text-xl font-bold tabular-nums leading-tight
        ${accent ? "text-erl-accent" : danger ? "text-erl-danger" : warn ? "text-erl-accent" : "text-erl-text-primary"}
      `}>
        {value}
      </span>
      <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">{label}</span>
    </div>
  </div>
);

/** Movement row for modal list view */
const MovementRow: React.FC<{ movement: InventoryMovement; showItemName?: boolean }> = ({ movement: m, showItemName }) => {
  const isPositive = m.movement_type === 'restock' || m.movement_type === 'void';
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-erl-surface/80 transition-colors">
      {/* Icon */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold flex-shrink-0
        ${isPositive
          ? "bg-erl-success/10 text-erl-success"
          : "bg-erl-danger/10 text-erl-danger"
        }
      `}>
        {MOVEMENT_ICONS[m.movement_type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {showItemName && (
            <span className="text-[12px] font-medium text-erl-text-primary truncate">{m.inventory_name}</span>
          )}
          <span className="text-[12px] font-semibold" style={{ color: MOVEMENT_COLORS[m.movement_type] }}>
            {MOVEMENT_LABELS[m.movement_type]}
          </span>
          {m.reference_id && (
            <span className="text-[11px] text-erl-text-faint">#{m.reference_id.slice(0, 8).toUpperCase()}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-erl-text-faint">
          <span>{m.stock_before} → {m.stock_after}</span>
          <span className={isPositive ? "text-erl-success" : "text-erl-danger"}>
            {isPositive ? "+" : ""}{m.quantity} {m.unit}
          </span>
          {m.notes && <span className="truncate">· {m.notes}</span>}
        </div>
      </div>

      {/* Time */}
      <div className="text-[11px] text-erl-text-faint whitespace-nowrap tabular-nums flex-shrink-0">
        {new Date(m.created_at).toLocaleTimeString()}
      </div>
    </div>
  );
};

/** Inventory Card */
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
}) => {
  // Progress bar: how full is stock relative to 2x threshold (capped)
  const maxStock = Math.max(item.low_stock_threshold * 2, 1);
  const fillPct = Math.min(100, Math.max(0, (item.stock / maxStock) * 100));

  return (
    <div className={`
      group rounded-2xl border transition-all duration-200 overflow-hidden
      ${stockStatus === "out"
        ? "border-erl-danger/30 bg-erl-danger/5"
        : stockStatus === "low"
          ? "border-erl-accent/25 bg-erl-surface"
          : "border-erl-border-subtle bg-erl-surface/60"
      }
      hover:border-erl-border-medium hover:shadow-md
    `}>
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex-1 min-w-0 mr-3">
          <div className="text-[13px] font-bold text-erl-text-primary leading-tight truncate">{item.name}</div>
          <div className="text-[11px] text-erl-accent-muted tracking-wide mt-0.5">{item.category} · {item.id}</div>
        </div>
        <span className={`
          pill text-[10px] px-2.5 py-1 flex-shrink-0 tracking-wider
          ${stockStatus === "out"
            ? "bg-erl-danger/15 text-erl-danger border-erl-danger/30"
            : stockStatus === "low"
              ? "bg-erl-accent/15 text-erl-accent border-erl-accent/30"
              : "bg-erl-success/10 text-erl-success border-erl-success/20"
          }
        `}>
          {stockStatus === "out" ? "OUT" : stockStatus === "low" ? "LOW" : "IN STOCK"}
        </span>
      </div>

      {/* Stock display */}
      <div className="px-4 pb-2">
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: stockStatusColor }}>
            {item.stock}
          </span>
          <span className="text-[12px] text-erl-text-muted">{item.unit}</span>
          <span className="text-[11px] text-erl-text-faint ml-auto">
            Alert at {item.low_stock_threshold}
          </span>
        </div>

        {/* Stock progress bar */}
        <div className="h-1.5 rounded-full bg-erl-border-subtle/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${fillPct}%`,
              background: stockStatus === "out"
                ? "var(--danger)"
                : stockStatus === "low"
                  ? "linear-gradient(90deg, var(--accent), var(--accent-light))"
                  : "var(--success)",
            }}
          />
        </div>
      </div>

      {/* Quick +/- controls */}
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          onClick={() => onAdjustStock(-1)}
          className="w-8 h-8 rounded-lg border border-erl-border-default bg-erl-surface text-erl-text-secondary flex items-center justify-center text-base cursor-pointer transition-all hover:border-erl-border-medium hover:bg-erl-elevated hover:text-erl-text-primary active:scale-95"
        >−</button>
        <button
          onClick={() => onAdjustStock(1)}
          className="w-8 h-8 rounded-lg border border-erl-border-default bg-erl-surface text-erl-accent flex items-center justify-center text-base cursor-pointer transition-all hover:border-erl-accent/40 hover:bg-erl-accent/10 active:scale-95"
        >+</button>

        {/* Cost info */}
        {(item.purchase_cost != null || item.unit_cost != null) && (
          <div className="flex gap-3 ml-auto text-[11px] text-erl-text-faint">
            {item.purchase_cost != null && (
              <span>Purchase <span className="text-erl-text-secondary font-semibold">₱{Number(item.purchase_cost).toFixed(2)}</span></span>
            )}
            {item.unit_cost != null && (
              <span>Unit <span className="text-erl-text-secondary font-semibold">₱{Number(item.unit_cost).toFixed(2)}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Divider + Actions */}
      {deleteConfirm ? (
        <div className="border-t border-erl-danger/20 bg-erl-danger/5 px-4 py-3">
          <div className="text-[12px] text-erl-danger text-center font-semibold mb-2">Delete this item?</div>
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
        <div className="border-t border-erl-border-subtle/60 px-3 py-2.5 flex gap-1.5">
          <button onClick={onManualAdjust} className="flex-1 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-erl-border-medium text-erl-accent bg-transparent hover:bg-erl-accent/10 hover:border-erl-accent/40">
            + Restock
          </button>
          <button onClick={onShowHistory} className="flex-1 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-erl-border-default text-erl-text-secondary bg-transparent hover:bg-erl-surface hover:border-erl-border-medium hover:text-erl-text-primary">
            History
          </button>
          <button onClick={onEdit} className="py-[7px] px-3 rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-erl-border-default text-erl-text-secondary bg-transparent hover:bg-erl-surface hover:border-erl-border-medium hover:text-erl-text-primary">
            Edit
          </button>
          <button onClick={onDelete} className="py-[7px] px-2.5 rounded-lg text-[11px] cursor-pointer transition-all border border-erl-danger-border text-erl-danger bg-transparent hover:bg-erl-danger/10">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

/** Form section wrapper with label */
const FormSection: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold">
      {label}
      {hint && <span className="font-normal text-erl-text-faint normal-case ml-1.5 not-italic">{hint}</span>}
    </div>
    {children}
  </div>
);