import React, { useState, useEffect, useCallback } from "react";
import { InventoryTransfer, Location, InventoryItem, TransferStatus } from "../types";
import { apiGet, apiPost, apiAdminPut } from "../utils/api";

const STATUS_COLORS: Record<TransferStatus, string> = {
  pending: "bg-yellow-900/30 text-yellow-400",
  approved: "bg-blue-900/30 text-blue-400",
  in_transit: "bg-purple-900/30 text-purple-400",
  received: "bg-green-900/30 text-green-400",
  cancelled: "bg-red-900/30 text-red-400",
};

export const AdminTransfers: React.FC = () => {
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ from_location_id: 0, to_location_id: 0, inventory_item_id: "", quantity: 0, notes: "" });
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tData, lData, iData] = await Promise.all([
        apiGet<{ transfers: InventoryTransfer[]; total: number }>("/transfers" + (filterStatus ? `?status=${filterStatus}` : "")),
        apiGet<Location[]>("/locations"),
        apiGet<InventoryItem[]>("/inventory"),
      ]);
      setTransfers(tData.transfers || []);
      setLocations(lData);
      setItems(iData);
    } catch (e) {
      console.error("Failed to load transfers:", e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.from_location_id || !form.to_location_id || !form.inventory_item_id || form.quantity <= 0) {
      setError("All fields are required and quantity must be positive");
      return;
    }
    if (form.from_location_id === form.to_location_id) {
      setError("Source and destination must be different");
      return;
    }
    setError(null);
    try {
      await apiPost("/transfers", form);
      setShowForm(false);
      setForm({ from_location_id: 0, to_location_id: 0, inventory_item_id: "", quantity: 0, notes: "" });
      fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to create transfer");
    }
  };

  const handleAction = async (id: number, action: string) => {
    try {
      await apiAdminPut(`/transfers/${id}/${action}`, {});
      fetchData();
    } catch (e: any) {
      setError(e.message || `Failed to ${action} transfer`);
    }
  };

  const sourceItems = form.from_location_id
    ? items.filter((i) => (i as any).location_id === form.from_location_id || !(i as any).location_id)
    : items;

  if (loading) return <div className="p-4 text-erl-text-faint text-[11px]">Loading transfers...</div>;

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="px-4 py-3.5 border-b border-erl-border-default flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-[9px] text-erl-accent tracking-widest uppercase font-bold">Inventory Transfers</div>
          <div className="flex gap-2 items-center">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2 py-1 text-[10px]">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="in_transit">In Transit</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={() => { setShowForm(!showForm); setError(null); }}
              className="px-3 py-1 bg-erl-accent text-erl-base text-[9px] font-bold rounded-md">
              {showForm ? "Cancel" : "+ New Transfer"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="px-4 py-2 text-[10px] text-red-400 bg-red-900/20">{error}</div>}

      {showForm && (
        <div className="px-4 py-3 border-b border-erl-border-default bg-erl-base/50">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.from_location_id || ""} onChange={(e) => setForm({ ...form, from_location_id: Number(e.target.value) })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]">
              <option value="">From Location *</option>
              {locations.filter((l) => l.is_active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={form.to_location_id || ""} onChange={(e) => setForm({ ...form, to_location_id: Number(e.target.value) })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]">
              <option value="">To Location *</option>
              {locations.filter((l) => l.is_active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={form.inventory_item_id} onChange={(e) => setForm({ ...form, inventory_item_id: e.target.value })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]">
              <option value="">Item *</option>
              {sourceItems.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.stock} {i.unit})</option>)}
            </select>
            <input type="number" placeholder="Quantity *" min="0.01" step="0.01" value={form.quantity || ""}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]" />
            <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px] col-span-2" />
          </div>
          <div className="flex justify-end mt-2">
            <button onClick={handleCreate} className="px-4 py-1.5 bg-erl-accent text-erl-base text-[10px] font-bold rounded-md">
              Create Transfer
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {!transfers.length ? (
          <div className="text-[11px] text-erl-text-faint text-center py-8">No transfers found</div>
        ) : (
          <div className="space-y-2">
            {transfers.map((t) => (
              <div key={t.id} className="bg-erl-surface border border-erl-border-default rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="text-[11px] text-erl-text-primary">
                    <span className="font-medium">#{t.id}</span>
                    <span className="mx-1.5 text-erl-text-faint">→</span>
                    <span>{t.from_location_name || `Location ${t.from_location_id}`}</span>
                    <span className="mx-1.5 text-erl-text-faint">→</span>
                    <span>{t.to_location_name || `Location ${t.to_location_id}`}</span>
                  </div>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${STATUS_COLORS[t.status]}`}>
                    {t.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-1.5 text-[10px] text-erl-text-secondary">
                  {t.item_name || t.inventory_item_id} — {t.quantity} {t.item_unit || ""}
                  {t.notes && <span className="ml-2 text-erl-text-faint">({t.notes})</span>}
                </div>
                <div className="mt-1 text-[9px] text-erl-text-faint">
                  Requested by {t.requested_by_name || "—"} · {new Date(t.created_at).toLocaleString()}
                </div>
                <div className="mt-2 flex gap-1.5">
                  {t.status === "pending" && (
                    <>
                      <button onClick={() => handleAction(t.id, "approve")} className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-[9px] rounded">Approve</button>
                      <button onClick={() => handleAction(t.id, "cancel")} className="px-2 py-0.5 bg-red-900/20 text-red-400/70 text-[9px] rounded">Cancel</button>
                    </>
                  )}
                  {t.status === "approved" && (
                    <button onClick={() => handleAction(t.id, "ship")} className="px-2 py-0.5 bg-purple-900/30 text-purple-400 text-[9px] rounded">Ship</button>
                  )}
                  {t.status === "in_transit" && (
                    <button onClick={() => handleAction(t.id, "receive")} className="px-2 py-0.5 bg-green-900/30 text-green-400 text-[9px] rounded">Receive</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
