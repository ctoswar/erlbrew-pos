import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { apiAdminDelete, apiAdminGet, apiAdminPut, createStaff, CreateStaffData } from "../utils/api";
import { formatCurrency } from "../utils";
import { AnimatedSelect } from "./AnimatedSelect";
import { useLocation } from "../contexts/LocationContext";

interface StaffMember {
  id: number;
  rfid: string | null;
  rfid_alt: string | null;
  name: string;
  role: string;
  initials: string;
  color: string;
  locationId?: number | null;
  pay_basis?: string | null;
  daily_rate?: number | null;
  monthly_salary?: number | null;
}

interface ServerStaffMember extends Omit<StaffMember, "locationId"> {
  location_id?: number | null;
}

const ROLES = ["Barista", "Senior Barista", "Shift Supervisor", "Manager"];

const ROLE_STYLES: Record<string, { background: string; color: string }> = {
  Manager: { background: "rgba(196,149,106,0.16)", color: "rgb(var(--color-accent))" },
  "Shift Supervisor": { background: "rgba(176,125,74,0.14)", color: "#d5a56f" },
  "Senior Barista": { background: "rgba(138,112,88,0.14)", color: "#c9aa88" },
  Barista: { background: "rgba(90,69,53,0.14)", color: "rgb(var(--color-text-muted))" },
};

const EMPTY_ADD_FORM = {
  rfid: "",
  name: "",
  role: "Barista",
  initials: "",
  color: "#c4956a",
  pin: "",
};

const PersonIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="7" r="4" />
    <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
    <path d="M16 4.5a4 4 0 0 1 0 7.5M18 15.5a4 4 0 0 1 4 4V21" />
  </svg>
);

const SearchIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="m16 16 5 5" />
  </svg>
);

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
  </svg>
);

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const style = ROLE_STYLES[role] || ROLE_STYLES.Barista;
  return (
    <span className="staff-role-badge" style={{ background: style.background, color: style.color }}>
      {role}
    </span>
  );
};

interface StaffCardProps {
  staff: StaffMember;
  expanded: boolean;
  locations: Array<{ id: number; name: string; is_active: boolean }>;
  editingName: boolean;
  editingRfid: boolean;
  editingRfidAlt: boolean;
  changingPin: boolean;
  editName: string;
  editRfid: string;
  editRfidAlt: string;
  editPin: string;
  saving: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEditName: () => void;
  onSaveName: () => void;
  onEditRfid: () => void;
  onSaveRfid: () => void;
  onEditRfidAlt: () => void;
  onSaveRfidAlt: () => void;
  onChangePin: () => void;
  onSavePin: () => void;
  onCancelEdits: () => void;
  onNameChange: (value: string) => void;
  onRfidChange: (value: string) => void;
  onRfidAltChange: (value: string) => void;
  onPinChange: (value: string) => void;
  onLocationChange: (value: string) => void;
}

const StaffCard: React.FC<StaffCardProps> = ({
  staff,
  expanded,
  locations,
  editingName,
  editingRfid,
  editingRfidAlt,
  changingPin,
  editName,
  editRfid,
  editRfidAlt,
  editPin,
  saving,
  onToggle,
  onDelete,
  onEditName,
  onSaveName,
  onEditRfid,
  onSaveRfid,
  onEditRfidAlt,
  onSaveRfidAlt,
  onChangePin,
  onSavePin,
  onCancelEdits,
  onNameChange,
  onRfidChange,
  onRfidAltChange,
  onPinChange,
  onLocationChange,
}) => {
  const hasPayRate = Boolean(staff.daily_rate || staff.monthly_salary);
  const roleStyle = ROLE_STYLES[staff.role] || ROLE_STYLES.Barista;

  return (
    <article className="staff-directory-card" style={{ "--staff-color": staff.color || "#c4956a" } as React.CSSProperties}>
      <div className="staff-card-accent" style={{ background: `linear-gradient(90deg, ${staff.color || "#c4956a"}, transparent)` }} />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div
            className="staff-avatar"
            style={{
              background: `linear-gradient(145deg, ${staff.color || "#c4956a"}, ${staff.color || "#c4956a"}99)`,
              boxShadow: `0 8px 22px ${staff.color || "#c4956a"}26, inset 0 1px 0 rgba(255,255,255,0.2)`,
            }}
          >
            {staff.initials || staff.name.slice(0, 2).toUpperCase()}
            <span className={`staff-online-dot ${staff.rfid ? "is-ready" : "is-muted"}`} title={staff.rfid ? "Ready to sign in" : "RFID not assigned"} />
          </div>

          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex flex-wrap gap-2">
                <input
                  value={editName}
                  onChange={(event) => onNameChange(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && onSaveName()}
                  autoFocus
                  className="min-w-[150px] flex-1 rounded-lg border border-erl-accent bg-erl-base px-3 py-2 text-sm font-semibold text-erl-text-primary outline-none"
                  aria-label={`Edit ${staff.name} name`}
                />
                <button onClick={onSaveName} disabled={saving} className="btn btn-accent rounded-lg px-3 py-2 text-[10px]">Save</button>
                <button onClick={onCancelEdits} className="btn btn-ghost rounded-lg px-2 py-2 text-[10px]">Cancel</button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-bold tracking-[-0.01em] text-erl-text-primary">{staff.name}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <RoleBadge role={staff.role} />
                    <span className="text-[10px] text-erl-text-faint">ID #{staff.id}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={onEditName} className="staff-icon-button" title="Edit name" aria-label={`Edit ${staff.name}`}>
                    <span aria-hidden="true">✎</span>
                  </button>
                  <button onClick={onDelete} disabled={saving} className="staff-icon-button danger" title="Delete staff" aria-label={`Delete ${staff.name}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="staff-quick-grid">
          <div className="staff-quick-item">
            <span className="staff-quick-label">Primary RFID</span>
            <span className={staff.rfid ? "staff-quick-value is-active" : "staff-quick-value is-muted"}>{staff.rfid || "Not assigned"}</span>
          </div>
          <div className="staff-quick-item">
            <span className="staff-quick-label">Branch</span>
            <span className={staff.locationId ? "staff-quick-value" : "staff-quick-value is-muted"}>
              {staff.locationId ? locations.find((location) => location.id === staff.locationId)?.name || `Branch ${staff.locationId}` : "Unassigned"}
            </span>
          </div>
          <div className="staff-quick-item">
            <span className="staff-quick-label">Pay rate</span>
            <span className={hasPayRate ? "staff-quick-value" : "staff-quick-value is-muted"}>
              {hasPayRate ? (staff.pay_basis === "monthly" ? `${formatCurrency(staff.monthly_salary || 0)}/mo` : `${formatCurrency(staff.daily_rate || 0)}/day`) : "Not set"}
            </span>
          </div>
        </div>

        <button onClick={onToggle} className={`staff-manage-toggle ${expanded ? "is-open" : ""}`} aria-expanded={expanded}>
          <span>{expanded ? "Hide access settings" : "Manage access & branch"}</span>
          <ChevronIcon open={expanded} />
        </button>

        {expanded && (
          <div className="staff-access-panel">
            <div className="staff-access-heading">
              <span className="staff-access-kicker">Access controls</span>
              <span className="text-[10px] text-erl-text-faint">Changes save immediately</span>
            </div>

            <div className="staff-control-grid">
              <div className="staff-control-card">
                <div className="staff-control-label">Branch assignment</div>
                <AnimatedSelect
                  options={[
                    { value: "", label: "Unassigned (cannot sign in)" },
                    ...locations.filter((location) => location.is_active).map((location) => ({ value: String(location.id), label: location.name })),
                  ]}
                  value={staff.locationId ? String(staff.locationId) : ""}
                  onChange={onLocationChange}
                />
              </div>

              <div className="staff-control-card">
                <div className="staff-control-label">Primary RFID</div>
                {editingRfid ? (
                  <div className="flex gap-2">
                    <input value={editRfid} onChange={(event) => onRfidChange(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && onSaveRfid()} autoFocus placeholder="Tap card or type" className="staff-control-input font-mono" />
                    <button onClick={onSaveRfid} disabled={saving} className="btn btn-accent px-3 text-[10px]">Save</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className={staff.rfid ? "staff-code is-active" : "staff-code is-empty"}>{staff.rfid || "Not assigned"}</span>
                    <button onClick={onEditRfid} className="staff-link-button">{staff.rfid ? "Change" : "Assign"}</button>
                  </div>
                )}
              </div>

              <div className="staff-control-card">
                <div className="staff-control-label">Tablet RFID</div>
                {editingRfidAlt ? (
                  <div className="flex gap-2">
                    <input value={editRfidAlt} onChange={(event) => onRfidAltChange(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && onSaveRfidAlt()} autoFocus placeholder="Tablet reader code" className="staff-control-input font-mono" />
                    <button onClick={onSaveRfidAlt} disabled={saving} className="btn btn-accent px-3 text-[10px]">Save</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className={staff.rfid_alt ? "staff-code is-active" : "staff-code is-empty"}>{staff.rfid_alt || "Not assigned"}</span>
                    <button onClick={onEditRfidAlt} className="staff-link-button">{staff.rfid_alt ? "Change" : "Assign"}</button>
                  </div>
                )}
              </div>

              <div className="staff-control-card">
                <div className="staff-control-label">Sign-in PIN</div>
                {changingPin ? (
                  <div>
                    <div className="staff-pin-dots">
                      {[0, 1, 2, 3].map((index) => <span key={index} className={index < editPin.length ? "is-filled" : ""}>●</span>)}
                    </div>
                    <div className="staff-keypad">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "⌫"].map((key) => (
                        <button key={key} onClick={() => key === "CLR" ? onPinChange("") : key === "⌫" ? onPinChange(editPin.slice(0, -1)) : editPin.length < 4 ? onPinChange(editPin + key) : undefined} className={key === "CLR" || key === "⌫" ? "is-utility" : ""}>{key}</button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={onSavePin} disabled={saving || editPin.length !== 4} className="btn btn-accent px-3 text-[10px]">Save PIN</button>
                      <button onClick={onCancelEdits} className="btn btn-ghost px-3 text-[10px]">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={onChangePin} className="staff-outline-button">Change PIN <span aria-hidden="true">→</span></button>
                )}
              </div>
            </div>

            <div className="staff-access-footer" style={{ background: roleStyle.background }}>
              <span><span className="staff-status-pulse" /> {staff.rfid && staff.locationId ? "Ready for sign-in" : "Setup incomplete"}</span>
              <span>{staff.rfid && staff.locationId ? "RFID + branch assigned" : "Assign RFID and branch to activate"}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export const AdminStaff: React.FC = () => {
  const { locations, currentLocationId } = useLocation();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const deferredSearch = useDeferredValue(search);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editingRfidId, setEditingRfidId] = useState<number | null>(null);
  const [editRfid, setEditRfid] = useState("");
  const [editingRfidAltId, setEditingRfidAltId] = useState<number | null>(null);
  const [editRfidAlt, setEditRfidAlt] = useState("");
  const [changingPinId, setChangingPinId] = useState<number | null>(null);
  const [editPin, setEditPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_ADD_FORM, locationId: currentLocationId });
  const toastTimer = useRef<number | null>(null);

  const loadStaff = useCallback(() => {
    setLoading(true);
    apiAdminGet<ServerStaffMember[]>("/staff")
      .then((rows) => setStaff(rows.map((row) => ({ ...row, locationId: row.location_id ?? null }))))
      .catch(() => setMsg({ text: "Failed to load staff", ok: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStaff();
    return () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); };
  }, [loadStaff]);

  const showMsg = useCallback((text: string, ok: boolean) => {
    setMsg({ text, ok });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setMsg(null), 2800);
  }, []);

  const filteredStaff = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesRole = roleFilter === "All" || member.role === roleFilter;
      const matchesSearch = !query || [member.name, member.role, member.rfid || "", member.rfid_alt || ""].some((value) => value.toLowerCase().includes(query));
      return matchesRole && matchesSearch;
    });
  }, [deferredSearch, roleFilter, staff]);

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter((member) => member.rfid && member.locationId).length,
    managers: staff.filter((member) => member.role === "Manager" || member.role === "Shift Supervisor").length,
    unassigned: staff.filter((member) => !member.locationId || !member.rfid).length,
  }), [staff]);

  const findDuplicateRfid = (rfid: string, excludeId?: number): StaffMember | null => {
    const needle = rfid.trim().toUpperCase();
    if (!needle) return null;
    return staff.find((member) => member.id !== excludeId && ((member.rfid || "").toUpperCase() === needle || (member.rfid_alt || "").toUpperCase() === needle)) || null;
  };

  const cancelAll = () => {
    setEditingNameId(null);
    setEditingRfidId(null);
    setEditingRfidAltId(null);
    setChangingPinId(null);
    setEditName("");
    setEditRfid("");
    setEditRfidAlt("");
    setEditPin("");
  };

  const deleteStaff = async (member: StaffMember) => {
    if (!confirm(`Delete ${member.name}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await apiAdminDelete<{ ok: boolean }>(`/staff/${member.id}`);
      showMsg("Staff member removed", true);
      loadStaff();
    } catch (error: unknown) {
      showMsg(error instanceof Error ? error.message : "Failed to delete staff", false);
    } finally { setSaving(false); }
  };

  const saveName = async (id: number) => {
    if (!editName.trim()) { showMsg("Name cannot be empty", false); return; }
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { name: editName.trim() });
      cancelAll();
      showMsg("Name updated", true);
      loadStaff();
    } catch (error: unknown) {
      showMsg(error instanceof Error ? error.message : "Failed to save name", false);
    } finally { setSaving(false); }
  };

  const saveRfid = async (id: number) => {
    const value = editRfid.trim();
    const duplicate = findDuplicateRfid(value, id);
    if (duplicate) { showMsg(`This RFID is already assigned to ${duplicate.name}`, false); return; }
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { rfid: value || null });
      cancelAll();
      showMsg("Primary RFID saved", true);
      loadStaff();
    } catch (error: unknown) {
      showMsg(error instanceof Error ? error.message : "Failed to save RFID", false);
    } finally { setSaving(false); }
  };

  const saveRfidAlt = async (id: number) => {
    const value = editRfidAlt.trim();
    const duplicate = findDuplicateRfid(value, id);
    if (duplicate) { showMsg(`This RFID is already assigned to ${duplicate.name}`, false); return; }
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { rfid_alt: value || null });
      cancelAll();
      showMsg("Tablet RFID saved", true);
      loadStaff();
    } catch (error: unknown) {
      showMsg(error instanceof Error ? error.message : "Failed to save tablet RFID", false);
    } finally { setSaving(false); }
  };

  const savePin = async (id: number) => {
    if (editPin.length < 4) { showMsg("PIN must be exactly 4 digits", false); return; }
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { password: editPin });
      cancelAll();
      showMsg("PIN updated", true);
    } catch (error: unknown) {
      showMsg(error instanceof Error ? error.message : "Failed to save PIN", false);
    } finally { setSaving(false); }
  };

  const saveLocation = async (id: number, value: string) => {
    setSaving(true);
    try {
      await apiAdminPut(`/staff/${id}`, { location_id: value ? Number(value) : null });
      showMsg("Branch assignment updated", true);
      loadStaff();
    } catch (error: unknown) {
      showMsg(error instanceof Error ? error.message : "Failed to save branch", false);
    } finally { setSaving(false); }
  };

  const saveNewStaff = async () => {
    if (!addForm.rfid.trim()) { showMsg("RFID is required", false); return; }
    if (!addForm.name.trim()) { showMsg("Name is required", false); return; }
    if (addForm.pin.length !== 4) { showMsg("PIN must be exactly 4 digits", false); return; }
    const duplicate = findDuplicateRfid(addForm.rfid);
    if (duplicate) { showMsg(`This RFID is already assigned to ${duplicate.name}`, false); return; }
    setSaving(true);
    try {
      const data: CreateStaffData = {
        rfid: addForm.rfid.trim().toUpperCase(),
        name: addForm.name.trim(),
        role: addForm.role,
        initials: addForm.initials.trim() || addForm.name.trim().split(" ").map((word) => word[0]).join("").toUpperCase().substring(0, 2),
        color: addForm.color,
        pin: addForm.pin,
        location_id: addForm.locationId || null,
      };
      await createStaff(data);
      setShowAddForm(false);
      setAddForm({ ...EMPTY_ADD_FORM, locationId: currentLocationId });
      showMsg("Staff member added", true);
      loadStaff();
    } catch (error: unknown) {
      showMsg(error instanceof Error ? error.message : "Failed to add staff", false);
    } finally { setSaving(false); }
  };

  const startNameEdit = (member: StaffMember) => {
    cancelAll();
    setExpandedId(member.id);
    setEditingNameId(member.id);
    setEditName(member.name);
  };

  const startRfidEdit = (member: StaffMember) => {
    cancelAll();
    setExpandedId(member.id);
    setEditingRfidId(member.id);
    setEditRfid(member.rfid || "");
  };

  const startRfidAltEdit = (member: StaffMember) => {
    cancelAll();
    setExpandedId(member.id);
    setEditingRfidAltId(member.id);
    setEditRfidAlt(member.rfid_alt || "");
  };

  const startPinEdit = (member: StaffMember) => {
    cancelAll();
    setExpandedId(member.id);
    setChangingPinId(member.id);
  };

  const resetAddForm = () => setAddForm({ ...EMPTY_ADD_FORM, locationId: currentLocationId });

  return (
    <div className="staff-directory flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="staff-directory-header">
        <div className="flex min-w-0 items-center gap-3">
          <div className="staff-header-icon"><PersonIcon size={20} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-lg font-bold tracking-wide text-erl-text-primary">Staff directory</h1>
              <span className="staff-header-count">{stats.total}</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-erl-text-muted">Keep access, branch assignments, and team identity in one place.</p>
          </div>
        </div>
        <button onClick={() => { setShowAddForm(true); cancelAll(); }} className="btn btn-accent shrink-0 px-4 py-2.5 text-[11px] tracking-wide">
          <span aria-hidden="true">+</span> Add member
        </button>
      </header>

      <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
        <div className="staff-content-shell">
          <div className="staff-stats-grid">
            <div className="staff-stat-card staff-stat-card-primary">
              <div className="staff-stat-icon"><PersonIcon size={17} /></div>
              <div><span className="staff-stat-label">Team members</span><strong>{stats.total}</strong></div>
              <span className="staff-stat-note">all roles</span>
            </div>
            <div className="staff-stat-card">
              <div className="staff-stat-icon is-green"><span className="staff-status-pulse" /></div>
              <div><span className="staff-stat-label">Ready to sign in</span><strong>{stats.active}</strong></div>
              <span className="staff-stat-note">RFID + branch</span>
            </div>
            <div className="staff-stat-card">
              <div className="staff-stat-icon is-blue"><span aria-hidden="true">✦</span></div>
              <div><span className="staff-stat-label">Leads</span><strong>{stats.managers}</strong></div>
              <span className="staff-stat-note">managerial roles</span>
            </div>
            <div className={`staff-stat-card ${stats.unassigned > 0 ? "is-warning" : ""}`}>
              <div className="staff-stat-icon is-warn"><span aria-hidden="true">!</span></div>
              <div><span className="staff-stat-label">Needs setup</span><strong>{stats.unassigned}</strong></div>
              <span className="staff-stat-note">attention needed</span>
            </div>
          </div>

          {showAddForm && (
            <section className="staff-add-panel" aria-label="Add staff member">
              <div className="staff-add-panel-topline" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="staff-section-kicker">New team member</div>
                  <h2 className="mt-1 font-display text-base font-bold text-erl-text-primary">Create a sign-in profile</h2>
                  <p className="mt-1 text-[11px] text-erl-text-muted">A member needs an RFID, four-digit PIN, and branch before they can sign in.</p>
                </div>
                <button onClick={() => { setShowAddForm(false); resetAddForm(); }} className="staff-icon-button" aria-label="Close add staff form">×</button>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_240px]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="staff-field"><span>Full name <b>*</b></span><input value={addForm.name} onChange={(event) => setAddForm((form) => ({ ...form, name: event.target.value }))} placeholder="Jane Dela Cruz" autoComplete="name" /></label>
                  <label className="staff-field"><span>RFID badge <b>*</b></span><input value={addForm.rfid} onChange={(event) => setAddForm((form) => ({ ...form, rfid: event.target.value.toUpperCase() }))} placeholder="RF005" className="font-mono uppercase" /></label>
                  <label className="staff-field"><span>Role</span><AnimatedSelect options={ROLES.map((role) => ({ value: role, label: role }))} value={addForm.role} onChange={(value) => setAddForm((form) => ({ ...form, role: value }))} /></label>
                  <label className="staff-field"><span>Branch</span><AnimatedSelect options={[{ value: "", label: "Unassigned" }, ...locations.filter((location) => location.is_active).map((location) => ({ value: String(location.id), label: location.name }))]} value={addForm.locationId ? String(addForm.locationId) : ""} onChange={(value) => setAddForm((form) => ({ ...form, locationId: value ? Number(value) : null }))} /></label>
                  <label className="staff-field"><span>Initials <em>optional</em></span><input value={addForm.initials} onChange={(event) => setAddForm((form) => ({ ...form, initials: event.target.value.toUpperCase() }))} placeholder="JD" maxLength={2} className="uppercase" /></label>
                  <label className="staff-field"><span>PIN <b>*</b></span><input type="password" inputMode="numeric" value={addForm.pin} onChange={(event) => setAddForm((form) => ({ ...form, pin: event.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="4 digits" maxLength={4} className="font-mono tracking-[0.35em]" /></label>
                  <label className="staff-field sm:col-span-2"><span>Avatar color <em>used for quick identification</em></span><div className="flex items-center gap-3"><input type="color" value={addForm.color} onChange={(event) => setAddForm((form) => ({ ...form, color: event.target.value }))} className="h-10 w-12 cursor-pointer rounded-lg border border-erl-border-default bg-transparent p-1" /><code className="text-[11px] text-erl-text-muted">{addForm.color}</code></div></label>
                </div>

                <div className="staff-preview-card" style={{ borderColor: `${addForm.color}45` }}>
                  <span className="staff-preview-label">Live preview</span>
                  <div className="staff-avatar staff-avatar-large" style={{ background: `linear-gradient(145deg, ${addForm.color}, ${addForm.color}99)`, boxShadow: `0 10px 24px ${addForm.color}30` }}>{addForm.initials || addForm.name.split(" ").map((word) => word[0]).join("").toUpperCase().slice(0, 2) || "??"}</div>
                  <strong>{addForm.name || "New team member"}</strong>
                  <RoleBadge role={addForm.role} />
                  <span className="mt-2 text-center text-[10px] leading-relaxed text-erl-text-faint">This identity appears on orders and staff reports.</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-erl-border-subtle pt-4">
                <button onClick={saveNewStaff} disabled={saving} className="btn btn-accent px-5 py-2.5 text-[11px]">{saving ? "Creating…" : "Create member"}</button>
                <button onClick={() => { setShowAddForm(false); resetAddForm(); }} className="btn btn-ghost px-4 py-2.5 text-[11px]">Cancel</button>
              </div>
            </section>
          )}

          <div className="staff-directory-toolbar">
            <div className="staff-search-wrap"><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role, or RFID…" aria-label="Search staff" />{search && <button onClick={() => setSearch("")} aria-label="Clear search">×</button>}</div>
            <div className="staff-role-filters" role="group" aria-label="Filter staff by role">
              {["All", ...ROLES].map((role) => <button key={role} onClick={() => setRoleFilter(role)} className={roleFilter === role ? "is-active" : ""}>{role === "All" ? `All ${staff.length}` : role}</button>)}
            </div>
          </div>

          {loading ? (
            <div className="staff-card-grid" aria-label="Loading staff" aria-busy="true">
              {[0, 1, 2].map((item) => <div key={item} className="staff-card-skeleton"><span /><span /><span /></div>)}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="staff-empty-state">
              <div className="staff-empty-icon"><SearchIcon /></div>
              <h2>{staff.length === 0 ? "Your team is waiting" : "No matching staff"}</h2>
              <p>{staff.length === 0 ? "Create the first profile to start managing sign-in access." : "Try a different name, RFID, or role filter."}</p>
              {staff.length === 0 ? <button onClick={() => setShowAddForm(true)} className="btn btn-accent mt-3 px-4 py-2 text-[11px]">Add first member</button> : <button onClick={() => { setSearch(""); setRoleFilter("All"); }} className="btn btn-ghost mt-3 px-4 py-2 text-[11px]">Clear filters</button>}
            </div>
          ) : (
            <div className="staff-card-grid">
              {filteredStaff.map((member, index) => (
                <div key={member.id} className="staff-card-entry" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                  <StaffCard
                    staff={member}
                    expanded={expandedId === member.id}
                    locations={locations}
                    editingName={editingNameId === member.id}
                    editingRfid={editingRfidId === member.id}
                    editingRfidAlt={editingRfidAltId === member.id}
                    changingPin={changingPinId === member.id}
                    editName={editName}
                    editRfid={editRfid}
                    editRfidAlt={editRfidAlt}
                    editPin={editPin}
                    saving={saving}
                    onToggle={() => { cancelAll(); setExpandedId(expandedId === member.id ? null : member.id); }}
                    onDelete={() => deleteStaff(member)}
                    onEditName={() => startNameEdit(member)}
                    onSaveName={() => saveName(member.id)}
                    onEditRfid={() => startRfidEdit(member)}
                    onSaveRfid={() => saveRfid(member.id)}
                    onEditRfidAlt={() => startRfidAltEdit(member)}
                    onSaveRfidAlt={() => saveRfidAlt(member.id)}
                    onChangePin={() => startPinEdit(member)}
                    onSavePin={() => savePin(member.id)}
                    onCancelEdits={cancelAll}
                    onNameChange={setEditName}
                    onRfidChange={setEditRfid}
                    onRfidAltChange={setEditRfidAlt}
                    onPinChange={setEditPin}
                    onLocationChange={(value) => saveLocation(member.id, value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {msg && <div className={`staff-toast ${msg.ok ? "is-success" : "is-error"}`} role="status"><span>{msg.ok ? "✓" : "!"}</span>{msg.text}</div>}
    </div>
  );
};
