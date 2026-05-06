import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "../utils";
import { SupplierInvoice, SupplierInvoiceItem, getSupplierInvoices, getSupplierInvoice, createSupplierInvoice, updateSupplierInvoice, deleteSupplierInvoice } from "../utils/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--gold)",
  partial: "#e8a020",
  paid: "var(--success)",
  overdue: "var(--danger)",
  cancelled: "var(--text-muted)",
};

const EMPTY_FORM = {
  invoice_number: "",
  supplier_name: "",
  contact_person: "",
  contact_phone: "",
  contact_email: "",
  invoice_date: new Date().toISOString().split("T")[0],
  due_date: "",
  subtotal: "",
  tax_amount: "",
  total_amount: "",
  status: "pending" as "pending" | "partial" | "paid" | "overdue" | "cancelled",
  notes: "",
  items: [] as SupplierInvoiceItem[],
};

export const AdminSupplierInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<SupplierInvoice | null>(null);

  const loadInvoices = useCallback(() => {
    setLoading(true);
    getSupplierInvoices()
      .then(setInvoices)
      .catch(() => setError("Failed to load supplier invoices"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const filtered = filterStatus === "all" ? invoices : invoices.filter(i => i.status === filterStatus);

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM, invoice_number: `SI-${Date.now()}` });
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const openEditForm = async (invoice: SupplierInvoice) => {
    try {
      const full = await getSupplierInvoice(invoice.id!);
      setForm({
        invoice_number: full.invoice_number,
        supplier_name: full.supplier_name,
        contact_person: full.contact_person || "",
        contact_phone: full.contact_phone || "",
        contact_email: full.contact_email || "",
        invoice_date: full.invoice_date,
        due_date: full.due_date || "",
        subtotal: String(full.subtotal || ""),
        tax_amount: String(full.tax_amount || ""),
        total_amount: String(full.total_amount || ""),
        status: full.status,
        notes: full.notes || "",
        items: full.items || [],
      });
      setEditingId(full.id!);
      setShowForm(true);
      setError("");
    } catch {
      setError("Failed to load invoice details");
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  const addLineItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { item_description: "", quantity: 1, unit_price: 0, total_price: 0 }],
    }));
  };

  const updateLineItem = (index: number, field: keyof SupplierInvoiceItem, value: string | number) => {
    setForm(f => {
      const items = [...f.items];
      const item = { ...items[index], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        item.total_price = Number(item.quantity) * Number(item.unit_price);
      }
      items[index] = item;
      // Auto-update totals
      const subtotal = items.reduce((s, i) => s + (i.total_price || 0), 0);
      const tax = subtotal * 0.12;
      const total = subtotal + tax;
      return {
        ...f,
        items,
        subtotal: subtotal.toFixed(2),
        tax_amount: tax.toFixed(2),
        total_amount: total.toFixed(2),
      };
    });
  };

  const removeLineItem = (index: number) => {
    setForm(f => {
      const items = f.items.filter((_, i) => i !== index);
      const subtotal = items.reduce((s, i) => s + (i.total_price || 0), 0);
      const tax = subtotal * 0.12;
      const total = subtotal + tax;
      return {
        ...f,
        items,
        subtotal: subtotal.toFixed(2),
        tax_amount: tax.toFixed(2),
        total_amount: total.toFixed(2),
      };
    });
  };

  const handleSave = async () => {
    if (!form.invoice_number.trim() || !form.supplier_name.trim()) {
      setError("Invoice number and supplier name are required");
      return;
    }
    const total = parseFloat(form.total_amount);
    if (isNaN(total) || total <= 0) {
      setError("Total amount must be greater than 0");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        invoice_number: form.invoice_number,
        supplier_name: form.supplier_name,
        contact_person: form.contact_person || undefined,
        contact_phone: form.contact_phone || undefined,
        contact_email: form.contact_email || undefined,
        invoice_date: form.invoice_date,
        due_date: form.due_date || undefined,
        subtotal: parseFloat(form.subtotal) || 0,
        tax_amount: parseFloat(form.tax_amount) || 0,
        total_amount: parseFloat(form.total_amount),
        status: form.status,
        notes: form.notes || undefined,
        items: form.items.map(i => ({
          ...i,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          total_price: Number(i.total_price),
        })),
      };

      if (editingId) {
        await updateSupplierInvoice(editingId, payload);
      } else {
        await createSupplierInvoice(payload as any);
      }
      closeForm();
      loadInvoices();
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSupplierInvoice(id);
      setDeleteConfirm(null);
      loadInvoices();
    } catch {
      setError("Failed to delete");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 11,
    borderRadius: 8,
    border: "1px solid var(--border-medium)",
    background: "var(--bg-base)",
    color: "var(--text-primary)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: "var(--gold-muted)",
    letterSpacing: 1.5,
    marginBottom: 5,
    textTransform: "uppercase" as const,
    fontWeight: 700,
  };

  const totalStats = {
    pending: invoices.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.total_amount || 0), 0),
    paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount || 0), 0),
    overdue: invoices.filter(i => i.status === "overdue").reduce((s, i) => s + Number(i.total_amount || 0), 0),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.9rem 1rem",
        borderBottom: "1px solid var(--border-default)",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
          Supplier Invoices ({invoices.length})
        </div>
        <button onClick={openAddForm} style={{
          background: "var(--gold)",
          color: "var(--bg-sidebar)",
          border: "none",
          borderRadius: 9,
          padding: "8px 16px",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1,
          cursor: "pointer",
          textTransform: "uppercase" as const,
        }}>
          + New Invoice
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "0.8rem 1rem", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <div style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Pending</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(totalStats.pending)}</div>
        </div>
        <div style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Paid</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>{formatCurrency(totalStats.paid)}</div>
        </div>
        <div style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Overdue</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)" }}>{formatCurrency(totalStats.overdue)}</div>
        </div>
      </div>

      {/* Status Filter */}
      <div style={{ display: "flex", gap: 6, padding: "0.7rem 1rem", overflowX: "auto", flexShrink: 0 }}>
        {["all", "pending", "partial", "paid", "overdue", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: "5px 14px",
            borderRadius: 20,
            flexShrink: 0,
            border: `1.5px solid ${filterStatus === s ? "var(--gold)" : "var(--border-default)"}`,
            background: filterStatus === s ? "var(--gold)" : "transparent",
            color: filterStatus === s ? "var(--bg-sidebar)" : "var(--text-secondary)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            cursor: "pointer",
            textTransform: "uppercase" as const,
          }}>
            {s}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="scroll-area" style={{ flex: 1, padding: "0.5rem 1rem", overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem", fontSize: 11 }}>
            No supplier invoices found
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(inv => (
              <div key={inv.id} style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: "12px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{inv.supplier_name}</div>
                  </div>
                  <span style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: STATUS_COLORS[inv.status] || "var(--text-muted)",
                    background: `${STATUS_COLORS[inv.status] || "var(--text-muted)"}22`,
                    padding: "3px 8px",
                    borderRadius: 4,
                    letterSpacing: 1,
                    textTransform: "uppercase" as const,
                  }}>
                    {inv.status}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
                    {inv.invoice_date} {inv.due_date && `→ ${inv.due_date}`}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>
                    {formatCurrency(inv.total_amount)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button onClick={() => setViewingInvoice(inv)} style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: 8,
                    border: "1px solid var(--border-medium)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase" as const,
                  }}>
                    View
                  </button>
                  <button onClick={() => openEditForm(inv)} style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: 8,
                    border: "1px solid var(--border-medium)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase" as const,
                  }}>
                    Edit
                  </button>
                  {deleteConfirm === inv.id ? (
                    <>
                      <button onClick={() => handleDelete(inv.id!)} style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--danger)",
                        color: "#fff",
                        fontSize: 8,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}>
                        Confirm
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--border-default)",
                        background: "transparent",
                        color: "var(--text-muted)",
                        fontSize: 8,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirm(inv.id!)} style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--danger-border)",
                      background: "transparent",
                      color: "var(--danger)",
                      fontSize: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 998, animation: "fadeInOverlay 0.2s ease" }} onClick={closeForm} />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
            <div style={{
              background: "var(--bg-elevated)",
              border: "1.5px solid var(--border-medium)",
              borderRadius: 16,
              padding: "1.5rem",
              width: "100%",
              maxWidth: 600,
              maxHeight: "90vh",
              overflowY: "auto",
              animation: "fadeInUp 0.2s ease",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, fontFamily: "'Playfair Display', serif" }}>
                {editingId ? "Edit Invoice" : "New Supplier Invoice"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={labelStyle}>Invoice Number *</div>
                    <input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} style={inputStyle} placeholder="SI-001" />
                  </div>
                  <div>
                    <div style={labelStyle}>Status</div>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} style={inputStyle}>
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Supplier Name *</div>
                  <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} style={inputStyle} placeholder="ABC Supply Co." />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={labelStyle}>Contact Person</div>
                    <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} style={inputStyle} placeholder="Juan Dela Cruz" />
                  </div>
                  <div>
                    <div style={labelStyle}>Phone</div>
                    <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} style={inputStyle} placeholder="0917..." />
                  </div>
                  <div>
                    <div style={labelStyle}>Email</div>
                    <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} style={inputStyle} placeholder="juan@email.com" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={labelStyle}>Invoice Date *</div>
                    <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Due Date</div>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={labelStyle}>Line Items</div>
                    <button onClick={addLineItem} style={{
                      padding: "4px 12px",
                      fontSize: 9,
                      borderRadius: 6,
                      border: "1px solid var(--gold)",
                      background: "transparent",
                      color: "var(--gold)",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}>
                      + Add Item
                    </button>
                  </div>
                  {form.items.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 10, padding: "1rem", border: "1px dashed var(--border-medium)", borderRadius: 8 }}>
                      No items yet. Click "Add Item" to add line items.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {form.items.map((item, idx) => (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 80px 30px", gap: 6, alignItems: "center" }}>
                          <input value={item.item_description} onChange={e => updateLineItem(idx, "item_description", e.target.value)} style={inputStyle} placeholder="Description" />
                          <input type="number" value={item.quantity} onChange={e => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="Qty" />
                          <input type="number" value={item.unit_price} onChange={e => updateLineItem(idx, "unit_price", parseFloat(e.target.value) || 0)} style={inputStyle} placeholder="Unit Price" />
                          <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: "right", fontWeight: 600 }}>
                            {formatCurrency(item.total_price)}
                          </div>
                          <button onClick={() => removeLineItem(idx)} style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            border: "1px solid var(--danger-border)",
                            background: "transparent",
                            color: "var(--danger)",
                            cursor: "pointer",
                            fontSize: 12,
                          }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={labelStyle}>Subtotal</div>
                    <input type="number" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} style={inputStyle} placeholder="0.00" />
                  </div>
                  <div>
                    <div style={labelStyle}>Tax (12%)</div>
                    <input type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} style={inputStyle} placeholder="0.00" />
                  </div>
                  <div>
                    <div style={labelStyle}>Total *</div>
                    <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} style={{ ...inputStyle, fontWeight: 700, color: "var(--gold)" }} placeholder="0.00" />
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Notes</div>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Payment terms, delivery notes, etc." />
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: "9px 12px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 8, fontSize: 11, color: "var(--danger)" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button onClick={closeForm} style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" as const }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--bg-sidebar)", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: saving ? "not-allowed" : "pointer", textTransform: "uppercase" as const, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving..." : editingId ? "Update Invoice" : "Create Invoice"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* View Invoice Modal */}
      {viewingInvoice && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 998 }} onClick={() => setViewingInvoice(null)} />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
            <div style={{
              background: "var(--bg-elevated)",
              border: "1.5px solid var(--border-medium)",
              borderRadius: 16,
              padding: "1.5rem",
              width: "100%",
              maxWidth: 500,
              maxHeight: "90vh",
              overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Playfair Display', serif" }}>{viewingInvoice.invoice_number}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{viewingInvoice.supplier_name}</div>
                </div>
                <span style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: STATUS_COLORS[viewingInvoice.status] || "var(--text-muted)",
                  background: `${STATUS_COLORS[viewingInvoice.status] || "var(--text-muted)"}22`,
                  padding: "4px 10px",
                  borderRadius: 4,
                  letterSpacing: 1,
                  textTransform: "uppercase" as const,
                }}>
                  {viewingInvoice.status}
                </span>
              </div>

              <div style={{ display: "grid", gap: 8, fontSize: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Invoice Date:</span>
                  <span style={{ color: "var(--text-primary)" }}>{viewingInvoice.invoice_date}</span>
                </div>
                {viewingInvoice.due_date && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Due Date:</span>
                    <span style={{ color: "var(--text-primary)" }}>{viewingInvoice.due_date}</span>
                  </div>
                )}
                {viewingInvoice.contact_person && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Contact:</span>
                    <span style={{ color: "var(--text-primary)" }}>{viewingInvoice.contact_person}</span>
                  </div>
                )}
                {viewingInvoice.contact_phone && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Phone:</span>
                    <span style={{ color: "var(--text-primary)" }}>{viewingInvoice.contact_phone}</span>
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Amount Due</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(viewingInvoice.total_amount)}</div>
              </div>

              {viewingInvoice.notes && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "10px", background: "var(--bg-base)", borderRadius: 8 }}>
                  <strong>Notes:</strong> {viewingInvoice.notes}
                </div>
              )}

              <button
                onClick={() => { setViewingInvoice(null); openEditForm(viewingInvoice); }}
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: "11px 0",
                  borderRadius: 9,
                  border: "1px solid var(--gold)",
                  background: "var(--gold)",
                  color: "var(--bg-sidebar)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: "pointer",
                  textTransform: "uppercase" as const,
                }}
              >
                Edit Invoice
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};