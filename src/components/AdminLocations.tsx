import React, { useState, useEffect, useCallback } from "react";
import { Location } from "../types";
import { apiGet, apiAdminPost, apiAdminPut } from "../utils/api";
import { useLocation } from "../contexts/LocationContext";

export const AdminLocations: React.FC = () => {
  const { refresh: refreshLocations } = useLocation();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", timezone: "Asia/Manila" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<Location[]>("/locations");
      setLocations(data);
    } catch (e) {
      console.error("Failed to load locations:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setError(null);
    try {
      if (editingId) {
        await apiAdminPut(`/locations/${editingId}`, form);
      } else {
        await apiAdminPost("/locations", form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", address: "", phone: "", email: "", timezone: "Asia/Manila" });
      fetchLocations();
      refreshLocations();
    } catch (e: any) {
      setError(e.message || "Failed to save location");
    }
  };

  const handleEdit = (loc: Location) => {
    setEditingId(loc.id);
    setForm({ name: loc.name, address: loc.address || "", phone: loc.phone || "", email: loc.email || "", timezone: loc.timezone || "Asia/Manila" });
    setShowForm(true);
  };

  const handleSetDefault = async (id: number) => {
    try {
      await apiAdminPut(`/locations/${id}/set-default`, {});
      fetchLocations();
      refreshLocations();
    } catch (e: any) {
      setError(e.message || "Failed to set default");
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Deactivate this location?")) return;
    try {
      await apiAdminPut(`/locations/${id}`, { is_active: false });
      fetchLocations();
      refreshLocations();
    } catch (e: any) {
      setError(e.message || "Failed to deactivate");
    }
  };

  if (loading) return <div className="p-4 text-erl-text-faint text-[11px]">Loading locations...</div>;

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="px-4 py-3.5 border-b border-erl-border-default flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-[9px] text-erl-accent tracking-widest uppercase font-bold">Locations</div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", address: "", phone: "", email: "", timezone: "Asia/Manila" }); }}
            className="px-3 py-1 bg-erl-accent text-erl-base text-[9px] font-bold rounded-md"
          >
            {showForm ? "Cancel" : "+ Add Location"}
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-2 text-[10px] text-red-400 bg-red-900/20">{error}</div>}

      {showForm && (
        <div className="px-4 py-3 border-b border-erl-border-default bg-erl-base/50">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]" />
            <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2.5 py-1.5 text-[11px]" />
          </div>
          <div className="flex justify-end mt-2">
            <button onClick={handleSubmit} className="px-4 py-1.5 bg-erl-accent text-erl-base text-[10px] font-bold rounded-md">
              {editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[8px] text-erl-text-faint tracking-widest uppercase border-b border-erl-border-default">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Address</th>
              <th className="pb-2 pr-4">Phone</th>
              <th className="pb-2 pr-4">Timezone</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} className="border-b border-erl-border-default/50">
                <td className="py-2.5 pr-4 text-[11px] text-erl-text-primary font-medium">
                  {loc.name}
                  {loc.is_default && <span className="ml-1.5 text-[8px] text-erl-accent">DEFAULT</span>}
                </td>
                <td className="py-2.5 pr-4 text-[11px] text-erl-text-secondary">{loc.address || "—"}</td>
                <td className="py-2.5 pr-4 text-[11px] text-erl-text-secondary">{loc.phone || "—"}</td>
                <td className="py-2.5 pr-4 text-[11px] text-erl-text-secondary">{loc.timezone}</td>
                <td className="py-2.5 pr-4">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${loc.is_active ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                    {loc.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-2.5 flex gap-1.5">
                  <button onClick={() => handleEdit(loc)} className="text-[9px] text-erl-accent hover:underline">Edit</button>
                  {!loc.is_default && (
                    <>
                      <button onClick={() => handleSetDefault(loc.id)} className="text-[9px] text-erl-text-faint hover:text-erl-text-secondary">Set Default</button>
                      {loc.is_active && (
                        <button onClick={() => handleDeactivate(loc.id)} className="text-[9px] text-red-400/60 hover:text-red-400">Deactivate</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
