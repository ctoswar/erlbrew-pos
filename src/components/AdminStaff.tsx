import React, { useState, useEffect } from "react";
import { apiAdminGet, apiAdminPut, createStaff, CreateStaffData } from "../utils/api";
import { formatCurrency } from "../utils";

interface StaffMember {
  id: number;
  rfid: string | null;
  rfid_alt: string | null;
  name: string;
  role: string;
  initials: string;
  color: string;
  pay_basis?: string | null;
  daily_rate?: number | null;
  monthly_salary?: number | null;
}

export const AdminStaff: React.FC = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Edit name state
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // Edit RFID state
  const [editingRfidId, setEditingRfidId] = useState<number | null>(null);
  const [editRfid, setEditRfid] = useState("");

  // Edit RFID Alt state (tablet reader)
  const [editingRfidAltId, setEditingRfidAltId] = useState<number | null>(null);
  const [editRfidAlt, setEditRfidAlt] = useState("");

  // Change password state
  const [changingPwId, setChangingPwId] = useState<number | null>(null);
  const [editPw, setEditPw] = useState("");

  const [saving, setSaving] = useState(false);

  // Add staff form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    rfid: '',
    name: '',
    role: 'Barista',
    initials: '',
    color: '#c4956a',
    pin: '',
  });

  const loadStaff = () => {
    setLoading(true);
    apiAdminGet<StaffMember[]>("/staff")
      .then(setStaff)
      .catch(() => setMsg({ text: "Failed to load staff", ok: false }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStaff(); }, []);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 2500);
  };

  // Save name
  const saveName = async (id: number) => {
    if (!editName.trim()) { showMsg("Name cannot be empty", false); return; }
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { name: editName.trim() });
      setEditingNameId(null);
      showMsg("Name updated", true);
      loadStaff();
    } catch (e: any) {
      showMsg(e.message || "Failed to save", false);
    } finally { setSaving(false); }
  };

  // Save RFID
  const saveRfid = async (id: number) => {
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { rfid: editRfid.trim() || null });
      setEditingRfidId(null);
      showMsg("RFID saved", true);
      loadStaff();
    } catch (e: any) {
      showMsg(e.message || "Failed to save", false);
    } finally { setSaving(false); }
  };

  // Save RFID Alt (tablet reader)
  const saveRfidAlt = async (id: number) => {
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { rfid_alt: editRfidAlt.trim() || null });
      setEditingRfidAltId(null);
      showMsg("Tablet RFID saved", true);
      loadStaff();
    } catch (e: any) {
      showMsg(e.message || "Failed to save", false);
    } finally { setSaving(false); }
  };

  // Save password
  const savePassword = async (id: number) => {
    if (editPw.length < 4) { showMsg("PIN must be at least 4 digits", false); return; }
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { password: editPw });
      setChangingPwId(null);
      setEditPw("");
      showMsg("PIN updated", true);
    } catch (e: any) {
      showMsg(e.message || "Failed to save", false);
    } finally { setSaving(false); }
  };

  // Add new staff
  const saveNewStaff = async () => {
    if (!addForm.rfid.trim()) { showMsg("RFID is required", false); return; }
    if (!addForm.name.trim()) { showMsg("Name is required", false); return; }
    setSaving(true);
    try {
      const data: CreateStaffData = {
        rfid: addForm.rfid.trim().toUpperCase(),
        name: addForm.name.trim(),
        role: addForm.role,
        initials: addForm.initials.trim() || addForm.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2),
        color: addForm.color,
      };
      if (addForm.pin.length === 4) data.pin = addForm.pin;
      await createStaff(data);
      setShowAddForm(false);
      setAddForm({ rfid: '', name: '', role: 'Barista', initials: '', color: '#c4956a', pin: '' });
      showMsg("Staff added", true);
      loadStaff();
    } catch (e: any) {
      showMsg(e.message || "Failed to add staff", false);
    } finally { setSaving(false); }
  };

  const startEditName = (s: StaffMember) => {
    setEditingNameId(s.id);
    setEditName(s.name);
    setChangingPwId(null);
    setEditPw("");
    setMsg(null);
  };

  const startEditRfid = (s: StaffMember) => {
    setEditingRfidId(s.id);
    setEditRfid(s.rfid || "");
    setMsg(null);
  };

  const startEditRfidAlt = (s: StaffMember) => {
    setEditingRfidAltId(s.id);
    setEditRfidAlt(s.rfid_alt || "");
    setMsg(null);
  };

  const startChangePw = (s: StaffMember) => {
    setChangingPwId(s.id);
    setEditPw("");
    setEditingNameId(null);
    setEditingRfidId(null);
    setEditingRfidAltId(null);
    setMsg(null);
  };

  const cancelAll = () => {
    setEditingNameId(null);
    setEditingRfidId(null);
    setEditingRfidAltId(null);
    setChangingPwId(null);
    setEditName("");
    setEditRfid("");
    setEditRfidAlt("");
    setEditPw("");
  };

  const roleColors: Record<string, string> = {
    Manager: 'rgba(196,149,106,0.15)',
    'Shift Supervisor': 'rgba(176,125,74,0.12)',
    'Senior Barista': 'rgba(138,112,88,0.10)',
    Barista: 'rgba(90,69,53,0.08)',
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header */}
      <div className="glass-panel flex items-center justify-between px-6 py-4 border-b border-erl-accent/[0.08] flex-shrink-0 rounded-none">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-erl-accent/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div className="font-display text-lg font-bold text-erl-text-primary tracking-wide">
              Staff
            </div>
            <div className="text-xs text-erl-text-muted tracking-wide mt-0.5">
              {staff.length} {staff.length === 1 ? 'member' : 'members'}
            </div>
          </div>
        </div>
        {!showAddForm && (
          <button onClick={() => { setShowAddForm(true); cancelAll(); }}
            className="btn btn-accent text-xs px-5 py-2.5 tracking-wider">
            + Add Staff
          </button>
        )}
      </div>

      {/* Body */}
      <div className="scroll-area flex-1 p-5 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
            <span className="text-sm text-erl-text-muted">Loading staff...</span>
          </div>
        ) : staff.length === 0 && !showAddForm ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-erl-accent/5 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent/40">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <div className="text-sm text-erl-text-muted">No staff members yet</div>
            <button onClick={() => setShowAddForm(true)} className="btn btn-accent text-xs px-5 py-2.5">
              Add your first staff member
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* Add Staff Form */}
            {showAddForm && (
              <div className="card-glass p-6 border border-erl-accent/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-erl-accent/40 to-transparent" />
                
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-erl-accent shadow-[0_0_8px_rgba(196,149,106,0.4)]" />
                  <span className="text-xs text-erl-accent font-bold tracking-[0.2em] uppercase">New Member</span>
                </div>

                {/* Name + Role row */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="text-xs text-erl-text-muted mb-1.5 block tracking-wide font-medium">RFID *</label>
                    <input
                      value={addForm.rfid}
                      onChange={(e) => setAddForm(f => ({ ...f, rfid: e.target.value.toUpperCase() }))}
                      placeholder="e.g. RF005"
                      className="w-full bg-erl-base border border-erl-border-medium rounded-xl text-erl-text-primary px-4 py-3 text-sm font-mono outline-none transition-all duration-200 focus:border-erl-accent focus:shadow-[0_0_0_3px_rgba(196,149,106,0.12)]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-erl-text-muted mb-1.5 block tracking-wide font-medium">Full Name *</label>
                    <input
                      value={addForm.name}
                      onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Jane Dela Cruz"
                      className="w-full bg-erl-base border border-erl-border-medium rounded-xl text-erl-text-primary px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-erl-accent focus:shadow-[0_0_0_3px_rgba(196,149,106,0.12)]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-erl-text-muted mb-1.5 block tracking-wide font-medium">Role</label>
                    <select
                      value={addForm.role}
                      onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full bg-erl-base border border-erl-border-medium rounded-xl text-erl-text-primary px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-erl-accent"
                    >
                      <option>Barista</option>
                      <option>Senior Barista</option>
                      <option>Shift Supervisor</option>
                      <option>Manager</option>
                    </select>
                  </div>
                </div>

                {/* Initials + Color + PIN row */}
                <div className="flex gap-3 mb-5">
                  <div className="flex-1">
                    <label className="text-xs text-erl-text-muted mb-1.5 block tracking-wide font-medium">Initials (auto)</label>
                    <input
                      value={addForm.initials}
                      onChange={(e) => setAddForm(f => ({ ...f, initials: e.target.value.toUpperCase() }))}
                      placeholder="JD"
                      maxLength={2}
                      className="w-full bg-erl-base border border-erl-border-medium rounded-xl text-erl-text-primary px-4 py-3 text-sm font-mono outline-none uppercase transition-all duration-200 focus:border-erl-accent focus:shadow-[0_0_0_3px_rgba(196,149,106,0.12)]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-erl-text-muted mb-1.5 block tracking-wide font-medium">Color</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={addForm.color}
                        onChange={(e) => setAddForm(f => ({ ...f, color: e.target.value }))}
                        className="w-11 h-11 rounded-xl border border-erl-border-default cursor-pointer bg-transparent p-0.5"
                      />
                      <span className="text-xs text-erl-text-muted font-mono">{addForm.color}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-erl-text-muted mb-1.5 block tracking-wide font-medium">PIN (4 digits)</label>
                    <input
                      type="password"
                      value={addForm.pin}
                      onChange={(e) => setAddForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').substring(0, 4) }))}
                      placeholder="••••"
                      maxLength={4}
                      className="w-full bg-erl-base border border-erl-border-medium rounded-xl text-erl-text-primary px-4 py-3 text-sm font-mono outline-none tracking-[0.4em] transition-all duration-200 focus:border-erl-accent focus:shadow-[0_0_0_3px_rgba(196,149,106,0.12)]"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={saveNewStaff}
                    disabled={saving}
                    className="btn btn-accent text-xs px-6 py-2.5 tracking-wider"
                  >
                    {saving ? "Adding..." : "Add Staff"}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setAddForm({ rfid: '', name: '', role: 'Barista', initials: '', color: '#c4956a', pin: '' }); }}
                    className="btn btn-ghost text-xs px-4 py-2.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Staff Cards */}
            {staff.map((s) => (
              <div key={s.id} className="card-glass overflow-hidden transition-all duration-300 hover:border-erl-accent/20">
                {/* Card top accent bar */}
                <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${s.color || '#c4956a'}, transparent)` }} />
                
                <div className="p-5">
                  {/* Row 1: Avatar + Name + Role pill */}
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${s.color || '#c4956a'}, ${s.color || '#c4956a'}aa)`,
                        boxShadow: `0 4px 14px ${s.color || '#c4956a'}30, inset 0 1px 0 rgba(255,255,255,0.15)`,
                      }}
                    >
                      {s.initials}
                    </div>

                    {editingNameId === s.id ? (
                      <div className="flex gap-2 items-center flex-1">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveName(s.id)} autoFocus
                          className="flex-1 text-sm font-bold bg-erl-base border border-erl-accent rounded-xl px-3 py-2 outline-none text-erl-text-primary" />
                        <button onClick={() => saveName(s.id)} disabled={saving} className="btn btn-accent text-xs px-3 py-2 rounded-xl">Save</button>
                        <button onClick={cancelAll} className="btn-ghost text-xs px-3 py-2 rounded-xl text-erl-text-muted">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="min-w-0">
                          <div className="text-base font-bold text-erl-text-primary cursor-pointer hover:text-erl-accent transition-colors truncate"
                            onClick={() => startEditName(s)} title="Click to edit name">
                            {s.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-0.5 rounded-full"
                              style={{
                                background: roleColors[s.role] || 'rgba(90,69,53,0.08)',
                                color: s.role === 'Manager' ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-muted))',
                              }}
                            >
                              {s.role}
                            </span>
                          </div>
                        </div>
                        <span className="text-erl-accent/40 hover:text-erl-accent transition-colors text-xs ml-auto flex-shrink-0 cursor-pointer" onClick={() => startEditName(s)} title="Edit name">✎</span>
                      </div>
                    )}
                  </div>

                  {/* Row 2: RFID Badge */}
                  <div className="flex items-center gap-3 mb-3 pl-1">
                    <span className="text-[10px] text-erl-text-faint tracking-[0.15em] uppercase font-semibold w-[52px] flex-shrink-0">RFID</span>
                    {editingRfidId === s.id ? (
                      <div className="flex gap-2 items-center flex-1">
                        <input value={editRfid} onChange={(e) => setEditRfid(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === "Enter" && saveRfid(s.id)}
                          placeholder="Tap card or type…" autoFocus
                          className="flex-1 text-sm font-mono bg-erl-base border border-erl-accent rounded-xl px-3 py-2 outline-none text-erl-text-primary" />
                        <button onClick={() => saveRfid(s.id)} disabled={saving} className="btn btn-accent text-xs px-3 py-2 rounded-xl">Save</button>
                        <button onClick={() => setEditingRfidId(null)} className="btn-ghost text-xs px-3 py-2 text-erl-text-muted">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`
                          rounded-lg px-3 py-1.5 font-mono text-xs tracking-wider min-w-[100px] text-center font-semibold
                          ${s.rfid
                            ? "bg-erl-accent/8 border border-erl-accent/20 text-erl-accent"
                            : "bg-erl-base border border-erl-border-default text-erl-text-faint"}
                        `}>
                          {s.rfid || "Not set"}
                        </div>
                        <button onClick={() => startEditRfid(s)} className="text-[10px] text-erl-text-faint hover:text-erl-accent transition-colors tracking-wide font-semibold uppercase">
                          {s.rfid ? "Change" : "Assign"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 3: Alt RFID */}
                  <div className="flex items-center gap-3 mb-3 pl-1">
                    <span className="text-[10px] text-erl-text-faint tracking-[0.15em] uppercase font-semibold w-[52px] flex-shrink-0">Alt</span>
                    {editingRfidAltId === s.id ? (
                      <div className="flex gap-2 items-center flex-1">
                        <input value={editRfidAlt} onChange={(e) => setEditRfidAlt(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === "Enter" && saveRfidAlt(s.id)}
                          placeholder="Tablet reader code…" autoFocus
                          className="flex-1 text-sm font-mono bg-erl-base border border-erl-accent rounded-xl px-3 py-2 outline-none text-erl-text-primary" />
                        <button onClick={() => saveRfidAlt(s.id)} disabled={saving} className="btn btn-accent text-xs px-3 py-2 rounded-xl">Save</button>
                        <button onClick={() => setEditingRfidAltId(null)} className="btn-ghost text-xs px-3 py-2 text-erl-text-muted">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`
                          rounded-lg px-3 py-1.5 font-mono text-xs tracking-wider min-w-[100px] text-center font-semibold
                          ${s.rfid_alt
                            ? "bg-erl-accent/8 border border-erl-accent/20 text-erl-accent"
                            : "bg-erl-base border border-erl-border-default text-erl-text-faint"}
                        `}>
                          {s.rfid_alt || "Not set"}
                        </div>
                        <button onClick={() => startEditRfidAlt(s)} className="text-[10px] text-erl-text-faint hover:text-erl-accent transition-colors tracking-wide font-semibold uppercase">
                          {s.rfid_alt ? "Change" : "Set"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 4: PIN */}
                  <div className="flex items-center gap-3 mb-3 pl-1">
                    <span className="text-[10px] text-erl-text-faint tracking-[0.15em] uppercase font-semibold w-[52px] flex-shrink-0">PIN</span>
                    {changingPwId === s.id ? (
                      <div className="flex-1">
                        <div className="flex gap-2.5 mb-3 justify-start">
                          {[0,1,2,3].map((i) => (
                            <div key={i} className={`
                              w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-200
                              ${i < editPw.length
                                ? "bg-erl-accent/15 border-2 border-erl-accent text-erl-accent shadow-[0_0_12px_rgba(196,149,106,0.2)]"
                                : "bg-erl-base border-2 border-erl-border-default text-transparent"}
                            `}>
                              ●
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 max-w-[220px]">
                          {(["1","2","3","4","5","6","7","8","9","CLR","0","⌫"] as string[]).map((k) => (
                            <button key={k}
                              onClick={() => {
                                if (k === "CLR") { setEditPw(""); return; }
                                if (k === "⌫") { setEditPw((p) => p.slice(0,-1)); return; }
                                if (editPw.length < 4) setEditPw((p) => p + k);
                              }}
                              className={`
                                rounded-xl text-sm py-2.5 cursor-pointer transition-all duration-150 font-semibold
                                ${k === "CLR" || k === "⌫"
                                  ? "bg-erl-base border border-erl-border-default text-erl-text-muted hover:bg-erl-elevated hover:text-erl-text-secondary"
                                  : "bg-erl-surface border border-erl-border-subtle text-erl-text-primary hover:bg-erl-accent/8 hover:text-erl-accent"}
                              `}
                            >{k}</button>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => savePassword(s.id)} disabled={saving || editPw.length !== 4}
                            className="btn btn-accent text-xs px-4 py-2.5 rounded-xl tracking-wider">Save PIN</button>
                          <button onClick={cancelAll} className="btn-ghost text-xs px-4 py-2.5 rounded-xl text-erl-text-muted">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => startChangePw(s)}
                        className="text-[10px] text-erl-text-faint hover:text-erl-accent transition-colors tracking-[0.12em] uppercase font-semibold px-3 py-1.5 rounded-lg border border-erl-border-default hover:border-erl-accent/30">
                        Change PIN
                      </button>
                    )}
                  </div>

                  {/* Row 5: Pay info */}
                  <div className="flex items-center gap-3 pl-1 mt-1">
                    <span className="text-[10px] text-erl-text-faint tracking-[0.15em] uppercase font-semibold w-[52px] flex-shrink-0">Pay</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {s.daily_rate || s.monthly_salary ? (
                        <span className="text-[11px] text-erl-text-secondary">
                          {s.pay_basis === 'monthly'
                            ? <>{formatCurrency(s.monthly_salary || 0)}/mo</>
                            : <>{formatCurrency(s.daily_rate || 0)}/day</>
                          }
                        </span>
                      ) : (
                        <span className="text-[10px] text-erl-text-faint italic">No rate set</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {msg && (
        <div className={`
          fixed bottom-6 left-1/2 -translate-x-1/2 text-white px-6 py-3 rounded-2xl text-sm font-bold z-[9999]
          shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300
          ${msg.ok ? "bg-erl-success" : "bg-erl-danger"}
        `}>
          {msg.text}
        </div>
      )}
    </div>
  );
};