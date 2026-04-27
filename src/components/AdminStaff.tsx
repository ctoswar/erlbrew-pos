import React, { useState, useEffect } from "react";
import { apiAdminGet, apiAdminPut } from "../utils/api";

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRfid, setEditRfid] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const loadStaff = () => {
    setLoading(true);
    apiAdminGet<StaffMember[]>("/staff")
      .then(setStaff)
      .catch(() => setMsg({ text: "Failed to load staff", ok: false }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStaff(); }, []);

  const startEdit = (s: StaffMember) => {
    setEditingId(s.id);
    setEditRfid(s.rfid || "");
    setMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRfid("");
    setMsg(null);
  };

  const saveRfid = async (staffId: number) => {
    setSaving(true);
    setMsg(null);
    try {
      await apiAdminPut(`/staff/${staffId}`, { rfid: editRfid.trim() || null });
      setEditingId(null);
      setEditRfid("");
      setMsg({ text: "RFID saved", ok: true });
      loadStaff();
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to save", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.9rem 1rem", borderBottom: "1px solid var(--border-default)", flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
          Staff & RFID Management
        </div>
        <div style={{ fontSize: 9, color: "var(--text-faint)" }}>
          Tap card to register RFID
        </div>
      </div>

      {/* Body */}
      <div className="scroll-area" style={{ flex: 1, padding: "1rem", overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>Loading...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {staff.map((s) => (
              <div key={s.id} style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderRadius: 14, padding: "16px 18px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: s.color || "#555",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>
                  {s.initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{s.role}</div>
                </div>

                {/* RFID field */}
                <div>
                  {editingId === s.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        value={editRfid}
                        onChange={(e) => setEditRfid(e.target.value)}
                        placeholder="Tap card or type RFID…"
                        autoFocus
                        style={{
                          background: "var(--bg-base)", border: "1px solid var(--border-medium)",
                          borderRadius: 8, color: "var(--text-primary)", padding: "7px 12px",
                          fontSize: 11, width: 180, outline: "none",
                        }}
                      />
                      <button
                        onClick={() => saveRfid(s.id)}
                        disabled={saving}
                        style={{
                          background: "var(--gold)", color: "var(--bg-sidebar)", border: "none",
                          borderRadius: 8, padding: "7px 14px", fontSize: 9, fontWeight: 700,
                          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{
                          background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-default)",
                          borderRadius: 8, padding: "7px 12px", fontSize: 9, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        background: s.rfid ? "rgba(201,135,58,0.12)" : "var(--bg-base)",
                        border: `1px solid ${s.rfid ? "var(--gold-dim)" : "var(--border-default)"}`,
                        borderRadius: 8, padding: "7px 14px",
                        fontFamily: "monospace", fontSize: 11,
                        color: s.rfid ? "var(--gold)" : "var(--text-faint)",
                        minWidth: 120, textAlign: "center" as const,
                      }}>
                        {s.rfid || "Not set"}
                      </div>
                      <button
                        onClick={() => startEdit(s)}
                        style={{
                          background: "transparent", color: "var(--gold)", border: "1px solid var(--gold-dim)",
                          borderRadius: 8, padding: "7px 14px", fontSize: 9, fontWeight: 700,
                          cursor: "pointer", letterSpacing: 1,
                        }}
                      >
                        {s.rfid ? "Change RFID" : "Assign RFID"}
                      </button>
                    </div>
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
          background: msg.ok ? "var(--success)" : "var(--danger)",
          color: "#fff", padding: "10px 20px", borderRadius: 10,
          fontSize: 11, fontWeight: 700, zIndex: 9999,
          animation: "fadeInUp 0.2s ease",
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
};