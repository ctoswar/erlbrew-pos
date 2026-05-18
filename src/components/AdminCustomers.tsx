import React, { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "../utils";
import { Customer, getCustomers, getTopCustomers, getCustomerOrders, updateCustomer } from "../utils/api";

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [topCustomers, setTopCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "detail" | "top">("list");
  const [editNotes, setEditNotes] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomers(search || undefined, 50);
      setCustomers(data);
    } catch (e) {
      console.error("Failed to fetch customers:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTop = async () => {
    try {
      const data = await getTopCustomers(10);
      setTopCustomers(data);
    } catch (e) {
      console.error("Failed to fetch top customers:", e);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchTop();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchCustomers(); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditName(customer.name || "");
    setEditEmail(customer.email || "");
    setEditNotes(customer.notes || "");
    setView("detail");
    try {
      const orders = await getCustomerOrders(customer.id);
      setCustomerOrders(orders);
    } catch (e) {
      console.error("Failed to fetch customer orders:", e);
    }
  };

  const handleSave = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      await updateCustomer(selectedCustomer.id, { name: editName || null, email: editEmail || null, notes: editNotes || null });
      const updated = { ...selectedCustomer, name: editName || null, email: editEmail || null, notes: editNotes || null };
      setSelectedCustomer(updated);
      fetchCustomers();
    } catch (e) {
      console.error("Failed to update customer:", e);
    } finally {
      setSaving(false);
    }
  };

  if (view === "detail" && selectedCustomer) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView("list")} className="btn-ghost text-[10px] py-2 px-3 text-erl-text-muted rounded-xl hover:bg-white/[0.03] transition-colors">
            ← Back
          </button>
          <h2 className="font-display text-lg font-bold text-erl-text-primary">Customer Detail</h2>
        </div>

        <div className="card-glass rounded-2xl p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">Phone</div>
              <div className="text-sm text-erl-text-primary font-bold">{selectedCustomer.phone}</div>
            </div>
            <div>
              <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">Total Orders</div>
              <div className="text-sm text-erl-text-primary font-bold">{selectedCustomer.total_orders}</div>
            </div>
            <div>
              <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">Total Spent</div>
              <div className="text-sm text-erl-accent font-bold">{formatCurrency(selectedCustomer.total_spent)}</div>
            </div>
            <div>
              <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">Member Since</div>
              <div className="text-sm text-erl-text-secondary">{formatDate(new Date(selectedCustomer.created_at))}</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            <div>
              <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">Name</div>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-erl-surface border border-erl-border-default rounded-lg px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent" />
            </div>
            <div>
              <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">Email</div>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                className="w-full bg-erl-surface border border-erl-border-default rounded-lg px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent" />
            </div>
            <div>
              <div className="text-[8px] text-erl-text-muted tracking-widest uppercase mb-1 font-bold">Notes</div>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3}
                className="w-full bg-erl-surface border border-erl-border-default rounded-lg px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent resize-none" />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg bg-erl-accent text-white text-xs font-bold tracking-wide cursor-pointer hover:bg-erl-accent-hover transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {/* Order History */}
        <h3 className="font-display text-sm font-bold text-erl-text-primary mb-3">Order History</h3>
        {customerOrders.length === 0 ? (
          <div className="text-[10px] text-erl-text-muted py-4">No orders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-erl-border-default">
                  <th className="py-2 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Date</th>
                  <th className="py-2 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Status</th>
                  <th className="py-2 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Total</th>
                  <th className="py-2 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Pay Method</th>
                </tr>
              </thead>
              <tbody>
                {customerOrders.map((o) => (
                  <tr key={o.id} className="border-b border-erl-border-subtle hover:bg-erl-surface/50 transition-colors">
                    <td className="py-2 px-3 text-[10px] text-erl-text-secondary">{formatDate(new Date(o.created_at))}</td>
                    <td className="py-2 px-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                        o.status === 'completed' ? 'bg-erl-success/10 text-erl-success' :
                        o.status === 'voided' ? 'bg-erl-danger/10 text-erl-danger' :
                        o.status === 'refunded' ? 'bg-erl-accent/10 text-erl-accent' :
                        'bg-erl-muted/10 text-erl-muted'
                      }`}>{o.status}</span>
                    </td>
                    <td className="py-2 px-3 text-[10px] text-erl-text-primary font-bold">{formatCurrency(o.total)}</td>
                    <td className="py-2 px-3 text-[10px] text-erl-text-secondary capitalize">{o.pay_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
        <h2 className="font-display text-lg font-bold text-erl-text-primary">Customers</h2>
        <div className="flex gap-2">
          <button onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${view === "list" ? 'bg-erl-accent text-white' : 'bg-erl-surface text-erl-text-secondary border border-erl-border-default'}`}>
            All Customers
          </button>
          <button onClick={() => setView("top")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${view === "top" ? 'bg-erl-accent text-white' : 'bg-erl-surface text-erl-text-secondary border border-erl-border-default'}`}>
            Top Customers
          </button>
        </div>
      </div>

      {view === "list" && (
        <>
          <div className="mb-4">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by phone or name…"
              className="w-full sm:max-w-sm bg-erl-surface border border-erl-border-default rounded-lg px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent" />
          </div>
          {loading ? (
            <div className="text-[10px] text-erl-text-muted py-4">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-erl-border-default">
                    <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Phone</th>
                    <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Name</th>
                    <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Orders</th>
                    <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Total Spent</th>
                    <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} onClick={() => openDetail(c)}
                      className="border-b border-erl-border-subtle hover:bg-erl-surface/50 transition-colors cursor-pointer">
                      <td className="py-2.5 px-3 text-[10px] text-erl-text-primary font-bold">{c.phone}</td>
                      <td className="py-2.5 px-3 text-[10px] text-erl-text-secondary">{c.name || <span className="text-erl-text-faint">—</span>}</td>
                      <td className="py-2.5 px-3 text-[10px] text-erl-text-secondary">{c.total_orders}</td>
                      <td className="py-2.5 px-3 text-[10px] text-erl-accent font-bold">{formatCurrency(c.total_spent)}</td>
                      <td className="py-2.5 px-3 text-[10px] text-erl-text-faint">{formatDate(new Date(c.created_at))}</td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[10px] text-erl-text-muted">No customers found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === "top" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-erl-border-default">
                <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">#</th>
                <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Phone</th>
                <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Name</th>
                <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Orders</th>
                <th className="py-2.5 px-3 text-[9px] text-erl-text-muted tracking-widest uppercase font-bold">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c, idx) => (
                <tr key={c.id} onClick={() => openDetail(c)}
                  className="border-b border-erl-border-subtle hover:bg-erl-surface/50 transition-colors cursor-pointer">
                  <td className="py-2.5 px-3 text-[10px] text-erl-text-faint font-bold">{idx + 1}</td>
                  <td className="py-2.5 px-3 text-[10px] text-erl-text-primary font-bold">{c.phone}</td>
                  <td className="py-2.5 px-3 text-[10px] text-erl-text-secondary">{c.name || <span className="text-erl-text-faint">—</span>}</td>
                  <td className="py-2.5 px-3 text-[10px] text-erl-text-secondary">{c.total_orders}</td>
                  <td className="py-2.5 px-3 text-[10px] text-erl-accent font-bold">{formatCurrency(c.total_spent)}</td>
                </tr>
              ))}
              {topCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[10px] text-erl-text-muted">No data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
