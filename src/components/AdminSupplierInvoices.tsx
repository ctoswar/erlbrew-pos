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
  const [emailInvoice, setEmailInvoice] = useState<SupplierInvoice | null>(null);
  const [emailBody, setEmailBody] = useState("");

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

  const generateEmailContent = (inv: SupplierInvoice) => {
    const itemsList = inv.items?.map(item =>
      `• ${item.item_description}: ${item.quantity} x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.total_price)}`
    ).join('\n') || 'No items';

    return `Dear ${inv.contact_person || inv.supplier_name},

Please find below the details for Invoice ${inv.invoice_number}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVOICE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Invoice Number: ${inv.invoice_number}
Invoice Date: ${inv.invoice_date}
Due Date: ${inv.due_date || 'N/A'}
Status: ${inv.status.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${itemsList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYMENT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal: ${formatCurrency(inv.subtotal || 0)}
Tax (12%): ${formatCurrency(inv.tax_amount || 0)}
TOTAL DUE: ${formatCurrency(inv.total_amount || 0)}

Thank you for your business!
Erlbrew Café`;
  };

  const handleEmailInvoice = (inv: SupplierInvoice) => {
    if (!inv.contact_email) {
      setError("No email address for this supplier");
      return;
    }
    setEmailInvoice(inv);
    setEmailBody(generateEmailContent(inv));
  };

  const handleSendViaGmail = () => {
    if (!emailInvoice?.contact_email) return;
    const subject = encodeURIComponent(`Invoice ${emailInvoice.invoice_number} from Erlbrew Café`);
    const body = encodeURIComponent(emailBody);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${emailInvoice.contact_email}&su=${subject}&body=${body}`, '_blank');
  };

  const inputClass = "w-full px-3 py-2 text-[11px] rounded-lg border border-erl-border-medium bg-erl-base text-erl-text-primary";
  const labelClass = "text-[9px] text-erl-accent-muted tracking-widest uppercase font-bold";

  const totalStats = {
    pending: invoices.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.total_amount || 0), 0),
    paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount || 0), 0),
    overdue: invoices.filter(i => i.status === "overdue").reduce((s, i) => s + Number(i.total_amount || 0), 0),
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-erl-border-default flex-shrink-0">
        <div className="text-[9px] text-erl-accent tracking-widest uppercase font-bold">
          Supplier Invoices ({invoices.length})
        </div>
        <button onClick={openAddForm} className="bg-erl-accent text-erl-sidebar border-none rounded-lg px-4 py-2 text-[9px] font-bold tracking-wide cursor-pointer uppercase">
          + New Invoice
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2.5 px-4 py-3 border-b border-erl-border-subtle flex-shrink-0">
        <div className="bg-erl-surface rounded-lg px-3 py-2.5 text-center">
          <div className="text-[8px] text-erl-muted uppercase tracking-wide">Pending</div>
          <div className="text-sm font-bold text-erl-accent">{formatCurrency(totalStats.pending)}</div>
        </div>
        <div className="bg-erl-surface rounded-lg px-3 py-2.5 text-center">
          <div className="text-[8px] text-erl-muted uppercase tracking-wide">Paid</div>
          <div className="text-sm font-bold text-erl-success">{formatCurrency(totalStats.paid)}</div>
        </div>
        <div className="bg-erl-surface rounded-lg px-3 py-2.5 text-center">
          <div className="text-[8px] text-erl-muted uppercase tracking-wide">Overdue</div>
          <div className="text-sm font-bold text-erl-danger">{formatCurrency(totalStats.overdue)}</div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-1.5 px-4 py-3 overflow-x-auto flex-shrink-0">
        {["all", "pending", "partial", "paid", "overdue", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`
            px-3.5 py-[5px] rounded-full flex-shrink-0 text-[9px] font-bold tracking-wide cursor-pointer uppercase
            ${filterStatus === s ? "bg-erl-accent text-erl-sidebar border-[1.5px] border-erl-accent" : "bg-transparent text-erl-secondary border-[1.5px] border-erl-border-default"}
          `}>
            {s}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="scroll-area flex-1 px-4 py-2 overflow-y-auto">
        {loading ? (
          <div className="text-center text-erl-muted py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-erl-muted py-12 text-[11px]">
            No supplier invoices found
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(inv => (
              <div key={inv.id} className="bg-erl-surface border border-erl-border-subtle rounded-xl px-3.5 py-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[11px] font-bold text-erl-text-primary">{inv.invoice_number}</div>
                    <div className="text-[9px] text-erl-muted mt-0.5">{inv.supplier_name}</div>
                  </div>
                  <span className="text-[8px] font-bold px-2 py-[3px] rounded tracking-wide uppercase"
                    style={{ color: STATUS_COLORS[inv.status] || "var(--text-muted)", background: `${STATUS_COLORS[inv.status] || "var(--text-muted)"}22` }}>
                    {inv.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-[9px] text-erl-muted">
                    {inv.invoice_date} {inv.due_date && `→ ${inv.due_date}`}
                  </div>
                  <div className="text-[13px] font-bold text-erl-accent">
                    {formatCurrency(inv.total_amount)}
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2.5">
                  <button onClick={() => setViewingInvoice(inv)} className="flex-1 py-1.5 rounded-lg border border-erl-border-medium bg-transparent text-erl-secondary text-[8px] font-bold cursor-pointer uppercase">
                    View
                  </button>
                  <button onClick={() => openEditForm(inv)} className="flex-1 py-1.5 rounded-lg border border-erl-border-medium bg-transparent text-erl-secondary text-[8px] font-bold cursor-pointer uppercase">
                    Edit
                  </button>
                  <button
                    onClick={() => handleEmailInvoice(inv)}
                    disabled={!inv.contact_email}
                    title={inv.contact_email ? `Email ${inv.contact_email}` : "No email address"}
                    className={`
                      flex-1 py-1.5 rounded-lg border border-erl-border-medium text-[8px] font-bold uppercase cursor-pointer
                      ${inv.contact_email ? "bg-erl-accent/10 text-erl-accent" : "bg-transparent text-erl-muted cursor-not-allowed"}
                    `}>
                    ✉ Email
                  </button>
                  {deleteConfirm === inv.id ? (
                    <>
                      <button onClick={() => handleDelete(inv.id!)} className="px-2.5 py-1.5 rounded-lg border-none bg-erl-danger text-white text-[8px] font-bold cursor-pointer">
                        Confirm
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1.5 rounded-lg border border-erl-border-default bg-transparent text-erl-muted text-[8px] font-bold cursor-pointer">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirm(inv.id!)} className="px-2.5 py-1.5 rounded-lg border border-erl-danger-border bg-transparent text-erl-danger text-[8px] font-bold cursor-pointer">
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
          <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={closeForm} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[600px] max-h-[90vh] overflow-y-auto animate-fade-in-up">
              <div className="font-display text-sm font-bold text-erl-text-primary mb-4">
                {editingId ? "Edit Invoice" : "New Supplier Invoice"}
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className={labelClass}>Invoice Number *</div>
                    <input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className={inputClass} placeholder="SI-001" />
                  </div>
                  <div>
                    <div className={labelClass}>Status</div>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} className={inputClass}>
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className={labelClass}>Supplier Name *</div>
                  <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className={inputClass} placeholder="ABC Supply Co." />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <div className={labelClass}>Contact Person</div>
                    <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} className={inputClass} placeholder="Juan Dela Cruz" />
                  </div>
                  <div>
                    <div className={labelClass}>Phone</div>
                    <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className={inputClass} placeholder="0917..." />
                  </div>
                  <div>
                    <div className={labelClass}>Email</div>
                    <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className={inputClass} placeholder="juan@email.com" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className={labelClass}>Invoice Date *</div>
                    <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <div className={labelClass}>Due Date</div>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputClass} />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className={labelClass}>Line Items</div>
                    <button onClick={addLineItem} className="px-3 py-1 text-[9px] rounded-md border border-erl-accent bg-transparent text-erl-accent cursor-pointer font-bold">
                      + Add Item
                    </button>
                  </div>
                  {form.items.length === 0 ? (
                    <div className="text-center text-erl-muted text-[10px] py-4 border border-dashed border-erl-border-medium rounded-lg">
                      No items yet. Click "Add Item" to add line items.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {form.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-[2fr_60px_80px_80px_30px] gap-1.5 items-center">
                          <input value={item.item_description} onChange={e => updateLineItem(idx, "item_description", e.target.value)} className={inputClass} placeholder="Description" />
                          <input type="number" value={item.quantity} onChange={e => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)} className={inputClass} placeholder="Qty" />
                          <input type="number" value={item.unit_price} onChange={e => updateLineItem(idx, "unit_price", parseFloat(e.target.value) || 0)} className={inputClass} placeholder="Unit Price" />
                          <div className="text-[10px] text-erl-secondary text-right font-semibold">
                            {formatCurrency(item.total_price)}
                          </div>
                          <button onClick={() => removeLineItem(idx)} className="w-[26px] h-[26px] rounded-md border border-erl-danger-border bg-transparent text-erl-danger cursor-pointer text-xs">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <div className={labelClass}>Subtotal</div>
                    <input type="number" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} className={inputClass} placeholder="0.00" />
                  </div>
                  <div>
                    <div className={labelClass}>Tax (12%)</div>
                    <input type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} className={inputClass} placeholder="0.00" />
                  </div>
                  <div>
                    <div className={labelClass}>Total *</div>
                    <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} className={`${inputClass} font-bold text-erl-accent`} placeholder="0.00" />
                  </div>
                </div>

                <div>
                  <div className={labelClass}>Notes</div>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputClass} min-h-[60px] resize-y`} placeholder="Payment terms, delivery notes, etc." />
                </div>
              </div>

              {error && (
                <div className="mt-3 px-3 py-2 bg-erl-danger-bg border border-erl-danger-border rounded-lg text-[11px] text-erl-danger">
                  {error}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={closeForm} className="flex-1 py-2.5 rounded-lg border border-erl-border-default bg-transparent text-erl-secondary text-[10px] font-bold tracking-wide cursor-pointer uppercase">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg border-none bg-erl-accent text-erl-sidebar text-[10px] font-bold tracking-wide cursor-pointer uppercase disabled:cursor-not-allowed disabled:opacity-60">
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
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setViewingInvoice(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-display text-base font-bold text-erl-text-primary">{viewingInvoice.invoice_number}</div>
                  <div className="text-[10px] text-erl-muted mt-1">{viewingInvoice.supplier_name}</div>
                </div>
                <span className="text-[8px] font-bold px-2.5 py-1 rounded tracking-wide uppercase"
                  style={{ color: STATUS_COLORS[viewingInvoice.status] || "var(--text-muted)", background: `${STATUS_COLORS[viewingInvoice.status] || "var(--text-muted)"}22` }}>
                  {viewingInvoice.status}
                </span>
              </div>

              <div className="grid gap-2 text-[10px] mb-4">
                <div className="flex justify-between">
                  <span className="text-erl-muted">Invoice Date:</span>
                  <span className="text-erl-text-primary">{viewingInvoice.invoice_date}</span>
                </div>
                {viewingInvoice.due_date && (
                  <div className="flex justify-between">
                    <span className="text-erl-muted">Due Date:</span>
                    <span className="text-erl-text-primary">{viewingInvoice.due_date}</span>
                  </div>
                )}
                {viewingInvoice.contact_person && (
                  <div className="flex justify-between">
                    <span className="text-erl-muted">Contact:</span>
                    <span className="text-erl-text-primary">{viewingInvoice.contact_person}</span>
                  </div>
                )}
                {viewingInvoice.contact_phone && (
                  <div className="flex justify-between">
                    <span className="text-erl-muted">Phone:</span>
                    <span className="text-erl-text-primary">{viewingInvoice.contact_phone}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-erl-border-subtle pt-3 mb-3">
                <div className="text-[10px] font-bold text-erl-muted mb-2 uppercase tracking-wide">Amount Due</div>
                <div className="text-2xl font-bold text-erl-accent">{formatCurrency(viewingInvoice.total_amount)}</div>
              </div>

              {viewingInvoice.notes && (
                <div className="text-[10px] text-erl-muted p-2.5 bg-erl-base rounded-lg">
                  <strong>Notes:</strong> {viewingInvoice.notes}
                </div>
              )}

              <button
                onClick={() => { setViewingInvoice(null); openEditForm(viewingInvoice); }}
                className="w-full mt-4 py-2.5 rounded-lg border border-erl-accent bg-erl-accent text-erl-sidebar text-[10px] font-bold tracking-wide cursor-pointer uppercase"
              >
                Edit Invoice
              </button>
            </div>
          </div>
        </>
      )}

      {/* Email Invoice Modal */}
      {emailInvoice && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setEmailInvoice(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-5">
                <div className="font-display text-sm font-bold text-erl-text-primary">
                  Send Invoice via Email
                </div>
                <button onClick={() => setEmailInvoice(null)} className="bg-transparent border-none text-erl-muted cursor-pointer text-lg p-1">
                  ✕
                </button>
              </div>

              {/* To Field */}
              <div className="mb-3">
                <div className="text-[9px] text-erl-accent-muted tracking-wide uppercase font-bold mb-1">To</div>
                <div className="px-3 py-2.5 bg-erl-base rounded-lg text-xs text-erl-text-primary border border-erl-border-medium">
                  {emailInvoice.contact_email}
                </div>
              </div>

              {/* Subject Field */}
              <div className="mb-3">
                <div className="text-[9px] text-erl-accent-muted tracking-wide uppercase font-bold mb-1">Subject</div>
                <div className="px-3 py-2.5 bg-erl-base rounded-lg text-xs text-erl-text-primary border border-erl-border-medium">
                  Invoice {emailInvoice.invoice_number} from Erlbrew Café
                </div>
              </div>

              {/* Message Body */}
              <div className="mb-4">
                <div className="text-[9px] text-erl-accent-muted tracking-wide uppercase font-bold mb-1">Message</div>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  className="w-full min-h-[350px] p-3 text-[11px] font-mono leading-relaxed rounded-lg border border-erl-border-medium bg-erl-base text-erl-text-primary resize-y"
                />
              </div>

              {/* Invoice Summary Preview */}
              <div className="p-3 bg-erl-surface rounded-[10px] mb-4 text-[10px]">
                <div className="font-bold text-erl-text-primary mb-2">Invoice Summary</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div><span className="text-erl-muted">Amount:</span> <span className="text-erl-accent font-bold">{formatCurrency(emailInvoice.total_amount)}</span></div>
                  <div><span className="text-erl-muted">Due:</span> {emailInvoice.due_date || "N/A"}</div>
                  <div><span className="text-erl-muted">Status:</span> <span className="font-bold capitalize">{emailInvoice.status}</span></div>
                  <div><span className="text-erl-muted">Items:</span> {emailInvoice.items?.length || 0}</div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-3 px-3 py-2 bg-erl-danger-bg border border-erl-danger-border rounded-lg text-[11px] text-erl-danger">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5">
                <button onClick={() => setEmailInvoice(null)} className="flex-1 py-2.5 rounded-lg border border-erl-border-default bg-transparent text-erl-secondary text-[10px] font-bold tracking-wide cursor-pointer uppercase">
                  Cancel
                </button>
                <button onClick={handleSendViaGmail} className="flex-[2] py-2.5 rounded-lg border-none bg-erl-accent text-erl-sidebar text-[10px] font-bold tracking-wide cursor-pointer uppercase flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  Open in Gmail
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
