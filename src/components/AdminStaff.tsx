import React, { useState, useEffect } from "react";
import { apiAdminGet, apiAdminPut, createStaff, CreateStaffData } from "../utils/api";

interface StaffMember {
  id: number;
  rfid: string | null;
  name: string;
  role: string;
  initials: string;
  color: string;
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
    color: '#C9873A',
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

  // ── Save name ──────────────────────────────────────────────────────────────
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

  // ── Save RFID ──────────────────────────────────────────────────────────────
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

  // ── Save password ──────────────────────────────────────────────────────────
  const savePassword = async (id: number) => {
    if (editPw.length < 4) { showMsg("Password must be at least 4 characters", false); return; }
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { password: editPw });
      setChangingPwId(null);
      setEditPw("");
      showMsg("Password updated", true);
    } catch (e: any) {
      showMsg(e.message || "Failed to save", false);
    } finally { setSaving(false); }
  };

  // ── Add new staff ────────────────────────────────────────────────────────────
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
      setAddForm({ rfid: '', name: '', role: 'Barista', initials: '', color: '#C9873A', pin: '' });
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

  const startChangePw = (s: StaffMember) => {
    setChangingPwId(s.id);
    setEditPw("");
    setEditingNameId(null);
    setEditingRfidId(null);
    setMsg(null);
  };

  const cancelAll = () => {
    setEditingNameId(null);
    setEditingRfidId(null);
    setChangingPwId(null);
    setEditName("");
    setEditRfid("");
    setEditPw("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.9rem 1rem", borderBottom: "1px solid var(--border-default)", flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
          Staff Management
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 9, color: "var(--text-faint)" }}>
            RFID · Name · Password
          </div>
          {!showAddForm && (
            <button
              onClick={() => { setShowAddForm(true); cancelAll(); }}
              style={{
                background: "var(--gold)", color: "var(--bg-sidebar)",
                border: "none", borderRadius: 8, padding: "6px 14px",
                fontSize: 9, fontWeight: 700, cursor: "pointer",
              }}
            >
              + Add Staff
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="scroll-area" style={{ flex: 1, padding: "1rem", overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>Loading...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* ── Add Staff Form ── */}
            {showAddForm && (
              <div style={{
                background: "var(--bg-surface)", border: "1px solid var(--gold)",
                borderRadius: 14, padding: "20px 18px",
              }}>
                <div style={{ fontSize: 10, color: "var(--gold)", fontWeight: 700, marginBottom: 14, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  New Staff
                </div>

                {/* Name + Role row */}
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 4, letterSpacing: 1 }}>RFID *</div>
                    <input
                      value={addForm.rfid}
                      onChange={(e) => setAddForm(f => ({ ...f, rfid: e.target.value.toUpperCase() }))}
                      placeholder="e.g. RF005"
                      style={{
                        width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)",
                        borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px",
                        fontSize: 12, fontFamily: "monospace", outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 4, letterSpacing: 1 }}>Name *</div>
                    <input
                      value={addForm.name}
                      onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Full name"
                      style={{
                        width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)",
                        borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px",
                        fontSize: 12, outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 4, letterSpacing: 1 }}>Role</div>
                    <select
                      value={addForm.role}
                      onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value }))}
                      style={{
                        width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)",
                        borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px",
                        fontSize: 12, outline: "none",
                      }}
                    >
                      <option>Barista</option>
                      <option>Senior Barista</option>
                      <option>Shift Supervisor</option>
                      <option>Manager</option>
                    </select>
                  </div>
                </div>

                {/* Initials + Color + PIN row */}
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 4, letterSpacing: 1 }}>Initials (auto)</div>
                    <input
                      value={addForm.initials}
                      onChange={(e) => setAddForm(f => ({ ...f, initials: e.target.value.toUpperCase() }))}
                      placeholder="JD"
                      maxLength={2}
                      style={{
                        width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)",
                        borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px",
                        fontSize: 12, outline: "none", textTransform: "uppercase",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 4, letterSpacing: 1 }}>Color</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="color"
                        value={addForm.color}
                        onChange={(e) => setAddForm(f => ({ ...f, color: e.target.value }))}
                        style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border-default)", cursor: "pointer", background: "none", padding: 2 }}
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{addForm.color}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 4, letterSpacing: 1 }}>PIN (4 digits, optional)</div>
                    <input
                      type="password"
                      value={addForm.pin}
                      onChange={(e) => setAddForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').substring(0, 4) }))}
                      placeholder="1234"
                      maxLength={4}
                      style={{
                        width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)",
                        borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px",
                        fontSize: 12, fontFamily: "monospace", outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={saveNewStaff}
                    disabled={saving}
                    style={{
                      background: "var(--gold)", color: "var(--bg-sidebar)", border: "none",
                      borderRadius: 8, padding: "8px 18px", fontSize: 10, fontWeight: 700,
                      cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? "Adding..." : "Add Staff"}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setAddForm({ rfid: '', name: '', role: 'Barista', initials: '', color: '#C9873A', pin: '' }); }}
                    style={{
                      background: "transparent", color: "var(--text-muted)",
                      border: "1px solid var(--border-default)", borderRadius: 8,
                      padding: "8px 14px", fontSize: 10, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {staff.map((s) => (
              <div key={s.id} style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderRadius: 14, padding: "16px 18px",
              }}>
                {/* ── Row 1: Avatar + Name (editable) + Role ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: s.color || "#555",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>
                    {s.initials}
                  </div>

                  {editingNameId === s.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveName(s.id)}
                        autoFocus
                        style={{
                          flex: 1, background: "var(--bg-base)", border: "1px solid var(--border-medium)",
                          borderRadius: 8, color: "var(--text-primary)", padding: "7px 12px",
                          fontSize: 13, fontWeight: 700, outline: "none",
                        }}
                      />
                      <button onClick={() => saveName(s.id)} disabled={saving}
                        style={{ background: "var(--gold)", color: "var(--bg-sidebar)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 9, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                        Save
                      </button>
                      <button onClick={cancelAll}
                        style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "7px 10px", fontSize: 9, cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", cursor: "pointer" }}
                          onClick={() => startEditName(s)} title="Click to edit name">
                          {s.name} <span style={{ fontSize: 10, color: "var(--gold)", opacity: 0.6 }}>✎</span>
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{s.role}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Row 2: RFID ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: "var(--text-faint)", width: 70, flexShrink: 0, letterSpacing: 1 }}>RFID</div>
                  {editingRfidId === s.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                      <input
                        value={editRfid}
                        onChange={(e) => setEditRfid(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && saveRfid(s.id)}
                        placeholder="Tap card or type…"
                        autoFocus
                        style={{
                          flex: 1, background: "var(--bg-base)", border: "1px solid var(--border-medium)",
                          borderRadius: 8, color: "var(--text-primary)", padding: "7px 12px",
                          fontSize: 11, fontFamily: "monospace", outline: "none",
                        }}
                      />
                      <button onClick={() => saveRfid(s.id)} disabled={saving}
                        style={{ background: "var(--gold)", color: "var(--bg-sidebar)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 9, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                        Save
                      </button>
                      <button onClick={() => setEditingRfidId(null)}
                        style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "7px 10px", fontSize: 9, cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        background: s.rfid ? "rgba(201,135,58,0.12)" : "var(--bg-base)",
                        border: `1px solid ${s.rfid ? "var(--gold-dim)" : "var(--border-default)"}`,
                        borderRadius: 8, padding: "6px 14px",
                        fontFamily: "monospace", fontSize: 11,
                        color: s.rfid ? "var(--gold)" : "var(--text-faint)",
                        minWidth: 120, textAlign: "center" as const,
                      }}>
                        {s.rfid || "Not set"}
                      </div>
                      <button onClick={() => startEditRfid(s)}
                        style={{
                          background: "transparent", color: "var(--gold)",
                          border: "1px solid var(--gold-dim)", borderRadius: 8,
                          padding: "6px 12px", fontSize: 9, fontWeight: 700, cursor: "pointer",
                        }}>
                        {s.rfid ? "Change RFID" : "Assign RFID"}
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Row 3: PIN ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 9, color: "var(--text-faint)", width: 70, flexShrink: 0, letterSpacing: 1 }}>PIN</div>
                  {changingPwId === s.id ? (
                    <div style={{ flex: 1 }}>
                      {/* PIN dots */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 10, justifyContent: "flex-start" }}>
                        {[0,1,2,3].map((i) => (
                          <div key={i} style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: "var(--bg-base)",
                            border: `1.5px solid ${i < editPw.length ? "var(--gold)" : "var(--border-default)"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, color: "var(--gold)", transition: "all 0.12s",
                          }}>
                            {i < editPw.length ? "●" : ""}
                          </div>
                        ))}
                      </div>
                      {/* Keypad */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, maxWidth: 200 }}>
                        {(["1","2","3","4","5","6","7","8","9","CLR","0","⌫"] as string[]).map((k) => (
                          <button
                            key={k}
                            onClick={() => {
                              if (k === "CLR") { setEditPw(""); return; }
                              if (k === "⌫") { setEditPw((p) => p.slice(0,-1)); return; }
                              if (editPw.length < 4) setEditPw((p) => p + k);
                            }}
                            style={{
                              background: k === "CLR" || k === "⌫" ? "var(--bg-base)" : "var(--card-bg)",
                              border: "1px solid var(--border-default)", borderRadius: 8,
                              color: k === "CLR" || k === "⌫" ? "var(--text-muted)" : "var(--text-primary)",
                              fontSize: 14, padding: "8px 0", cursor: "pointer",
                              fontFamily: "'Lato', sans-serif",
                            }}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button onClick={() => savePassword(s.id)} disabled={saving || editPw.length !== 4}
                          style={{ background: "var(--gold)", color: "var(--bg-sidebar)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 9, fontWeight: 700, cursor: (saving || editPw.length !== 4) ? "not-allowed" : "pointer", opacity: (saving || editPw.length !== 4) ? 0.5 : 1 }}>
                          Save
                        </button>
                        <button onClick={cancelAll}
                          style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "7px 12px", fontSize: 9, cursor: "pointer" }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startChangePw(s)}
                      style={{
                        background: "transparent", color: "var(--text-muted)",
                        border: "1px solid var(--border-default)", borderRadius: 8,
                        padding: "6px 14px", fontSize: 9, fontWeight: 700, cursor: "pointer",
                        letterSpacing: 0.5,
                      }}>
                      Change PIN
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {msg && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: msg.ok ? "var(--success)" : "var(--danger)", color: "#fff",
          padding: "10px 20px", borderRadius: 10, fontSize: 11, fontWeight: 700,
          zIndex: 9999, animation: "fadeInUp 0.2s ease",
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
};