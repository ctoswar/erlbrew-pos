import React, { useState, useEffect, useCallback } from "react";
import {
  ScheduleDay,
  ScheduleTemplate,
  StaffSchedule,
  StaffScheduleRaw,
} from "../../types";
import {
  apiAdminGet,
  apiAdminPut,
  apiAdminPost,
  apiAdminDelete,
} from "../../utils/api";
import { fmtTime } from "../../utils";
import { AnimatedSelect } from "../AnimatedSelect";

interface Props {
  onSchedulesChanged: () => void;
}

const DAYS_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const emptyDay = (): ScheduleDay => ({
  shift_start: null,
  shift_end: null,
  lunch_start: null,
  lunch_end: null,
  snack_start: null,
  snack_end: null,
});

const emptyDays = (): Record<string, ScheduleDay> => ({
  mon: emptyDay(),
  tue: emptyDay(),
  wed: emptyDay(),
  thu: emptyDay(),
  fri: emptyDay(),
  sat: emptyDay(),
  sun: emptyDay(),
});

const TimeKeepingSchedules: React.FC<Props> = ({ onSchedulesChanged }) => {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [staffList, setStaffList] = useState<StaffSchedule[]>([]);
  const [staffListLoading, setStaffListLoading] = useState(false);
  const [schedulesMsg, setSchedulesMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [schedulesSubTab, setSchedulesSubTab] = useState<"templates" | "assignments">("templates");

  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState<Partial<ScheduleTemplate>>({ name: "" });

  const showSchedulesMsg = (text: string, ok: boolean) => {
    setSchedulesMsg({ text, ok });
    setTimeout(() => setSchedulesMsg(null), 2500);
  };

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    apiAdminGet<ScheduleTemplate[]>("/staff-schedules")
      .then(setTemplates)
      .catch((err) => console.error("Failed to load schedule templates:", err))
      .finally(() => setTemplatesLoading(false));
  }, []);

  const loadStaffWithSchedules = useCallback(() => {
    setStaffListLoading(true);
    apiAdminGet<StaffScheduleRaw[]>("/staff")
      .then((data) => {
        const normalized = data.map((s) => ({
          staff_id: s.id,
          name: s.name,
          role: s.role,
          initials: s.initials,
          color: s.color,
          schedule_id: s.schedule_id || null,
          schedule_name: s.schedule_name || null,
          shift_start: s.shift_start || null,
          shift_end: s.shift_end || null,
          lunch_start: s.lunch_start || null,
          lunch_end: s.lunch_end || null,
          snack_start: s.snack_start || null,
          snack_end: s.snack_end || null,
        }));
        setStaffList(normalized);
      })
      .catch((err) => console.error("Failed to load staff schedules:", err))
      .finally(() => setStaffListLoading(false));
  }, []);

  useEffect(() => {
    loadTemplates();
    loadStaffWithSchedules();
  }, [loadTemplates, loadStaffWithSchedules]);

  const saveTemplate = async () => {
    if (!templateForm.name?.trim()) {
      showSchedulesMsg("Schedule name is required", false);
      return;
    }
    const payload = {
      name: templateForm.name,
      days: templateForm.days || emptyDays(),
    };
    try {
      if (editingTemplateId) {
        await apiAdminPut(`/staff-schedules/${editingTemplateId}`, payload);
        showSchedulesMsg("Schedule updated", true);
      } else {
        await apiAdminPost("/staff-schedules", payload);
        showSchedulesMsg("Schedule created", true);
      }
      setShowTemplateForm(false);
      setEditingTemplateId(null);
      setTemplateForm({ name: "" });
      loadTemplates();
      loadStaffWithSchedules();
      onSchedulesChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save schedule";
      showSchedulesMsg(message, false);
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm("Delete this schedule template? Staff assigned to it will lose their schedule.")) return;
    try {
      await apiAdminDelete(`/staff-schedules/${id}`);
      showSchedulesMsg("Schedule deleted", true);
      loadTemplates();
      loadStaffWithSchedules();
      onSchedulesChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete schedule";
      showSchedulesMsg(message, false);
    }
  };

  const assignScheduleToStaff = async (staffId: number, scheduleId: number | null) => {
    try {
      await apiAdminPut(`/staff/${staffId}`, { schedule_id: scheduleId });
      showSchedulesMsg("Assignment saved", true);
      loadStaffWithSchedules();
      onSchedulesChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to assign schedule";
      showSchedulesMsg(message, false);
    }
  };

  return (
    <>
      {schedulesMsg && (
        <div className={`animate-scale-in rounded-xl px-4 py-3 text-sm font-bold ${schedulesMsg.ok ? "bg-erl-success-bg text-erl-success border border-erl-success-border" : "bg-erl-danger-bg text-erl-danger border border-erl-danger-border"}`}>
          {schedulesMsg.text}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {([["templates", "Schedule Templates"], ["assignments", "Staff Assignments"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSchedulesSubTab(key)} className={`
            px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 min-h-[44px]
            ${schedulesSubTab === key
              ? "bg-erl-accent/15 text-erl-accent border-[1.5px] border-erl-accent"
              : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"}
          `}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Templates Sub-tab ── */}
      {schedulesSubTab === "templates" && (
        <>
          <div className="flex items-center justify-between">
            <div className="font-display text-sm font-bold text-erl-text-primary tracking-wide">
              {templates.length} {templates.length === 1 ? "Template" : "Templates"}
            </div>
            {!showTemplateForm && (
              <button onClick={() => { setShowTemplateForm(true); setEditingTemplateId(null); setTemplateForm({ name: "" }); }}
                className="btn btn-accent text-xs px-4 py-2 tracking-wider">
                + Create Schedule
              </button>
            )}
          </div>

          {/* Create / Edit Form */}
          {showTemplateForm && (
            <div className="card-glass p-5 border border-erl-accent/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-erl-accent shadow-[0_0_8px_rgba(196,149,106,0.4)]" />
                <span className="text-xs text-erl-accent font-bold tracking-[0.2em] uppercase">
                  {editingTemplateId ? "Edit Schedule" : "New Schedule"}
                </span>
              </div>
              <div className="mb-4">
                <label className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1.5 block">Schedule Name *</label>
                <input type="text" value={templateForm.name || ""} onChange={(e) => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Morning Shift" className="w-full max-w-[300px] text-sm" />
              </div>

              {/* Mon-Sat schedule table */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-erl-base/60 text-erl-text-faint uppercase tracking-wider">
                      <th className="px-3 py-2 text-left font-semibold">Day</th>
                      <th className="px-3 py-2 text-left font-semibold">Shift Start</th>
                      <th className="px-3 py-2 text-left font-semibold">Shift End</th>
                      <th className="px-3 py-2 text-left font-semibold">Lunch Start</th>
                      <th className="px-3 py-2 text-left font-semibold">Lunch End</th>
                      <th className="px-3 py-2 text-left font-semibold">Snack Start</th>
                      <th className="px-3 py-2 text-left font-semibold">Snack End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS_ORDER.map((day) => {
                      const d = (templateForm.days?.[day] as ScheduleDay) || emptyDay();
                      return (
                        <tr key={day} className="border-t border-erl-border-subtle/50">
                          <td className="px-3 py-2 font-bold text-erl-text-primary">{DAY_LABELS[day]}</td>
                          {(["shift_start", "shift_end", "lunch_start", "lunch_end", "snack_start", "snack_end"] as (keyof ScheduleDay)[]).map((field) => (
                            <td key={field} className="px-3 py-2">
                              <input
                                type="time"
                                value={d[field] || ""}
                                onChange={(e) => {
                                  const nextDays = { ...(templateForm.days || emptyDays()) };
                                  nextDays[day] = { ...d, [field]: e.target.value || null };
                                  setTemplateForm((f) => ({ ...f, days: nextDays }));
                                }}
                                className="w-full text-xs bg-erl-base border border-erl-border-medium rounded-lg px-2 py-1 text-erl-text-primary outline-none focus:border-erl-accent"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button onClick={saveTemplate} className="btn btn-accent text-xs px-5 py-2.5 tracking-wider">
                  {editingTemplateId ? "Update" : "Create"}
                </button>
                <button onClick={() => { setShowTemplateForm(false); setEditingTemplateId(null); setTemplateForm({ name: "" }); }} className="btn btn-ghost text-xs px-4 py-2.5">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Templates List */}
          {templatesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
              <span className="text-sm text-erl-text-muted">Loading templates...</span>
            </div>
          ) : templates.length === 0 && !showTemplateForm ? (
            <div className="card-glass rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-erl-accent/5 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-erl-text-faint">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="text-sm text-erl-text-muted font-medium">No schedule templates yet</div>
              <div className="text-[11px] text-erl-text-faint mt-1">Create your first shift schedule above</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {templates.map((t) => (
                <div key={t.id} className="card-glass rounded-xl px-4 py-3.5 flex items-center gap-3 transition-all duration-200 hover:border-erl-accent/15">
                  <div className="w-10 h-10 rounded-xl bg-erl-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-erl-text-primary">{t.name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {DAYS_ORDER.map((day) => {
                        const d = t.days?.[day];
                        const hasTimes = d && (d.shift_start || d.shift_end);
                        return (
                          <span key={day} className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold tracking-wide ${hasTimes ? "bg-erl-accent/8 text-erl-accent" : "bg-erl-base text-erl-text-faint"}`}>
                            {day.charAt(0).toUpperCase() + day.slice(1)}
                            {hasTimes ? ` ${fmtTime(d.shift_start)}–${fmtTime(d.shift_end)}` : " —"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => {
                      setEditingTemplateId(t.id);
                      setTemplateForm({ name: t.name, days: { ...(t.days || {}) } });
                      setShowTemplateForm(true);
                    }} className="text-[10px] px-2.5 py-1.5 rounded-lg border border-erl-border-default text-erl-text-faint font-bold hover:border-erl-accent/30 hover:text-erl-accent transition-colors">
                      Edit
                    </button>
                    <button onClick={() => deleteTemplate(t.id)} className="text-[10px] px-2.5 py-1.5 rounded-lg border border-erl-border-default text-erl-text-faint font-bold hover:border-erl-danger/30 hover:text-erl-danger transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Assignments Sub-tab ── */}
      {schedulesSubTab === "assignments" && (
        <>
          <div className="font-display text-sm font-bold text-erl-text-primary tracking-wide mb-1">
            Assign Schedules to Staff
          </div>
          <div className="text-[11px] text-erl-text-faint mb-3">
            Select a schedule template for each staff member. Their assigned times will appear on the Today tab.
          </div>

          {staffListLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
              <span className="text-sm text-erl-text-muted">Loading staff...</span>
            </div>
          ) : staffList.length === 0 ? (
            <div className="text-center py-12 text-sm text-erl-text-muted">No staff found</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {staffList.map((s) => (
                <div key={s.staff_id} className="card-glass rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-200 hover:border-erl-accent/15">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: s.color || "#555" }}>
                    {s.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-erl-text-primary">{s.name}</div>
                    <div className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">{s.role}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      {s.schedule_name ? (
                        <div className="text-xs text-erl-accent font-semibold">{s.schedule_name}</div>
                      ) : (
                        <div className="text-xs text-erl-text-faint italic">No schedule</div>
                      )}
                      {(s.shift_start || s.shift_end) && (
                        <div className="text-[10px] text-erl-text-muted font-mono mt-0.5">
                          {fmtTime(s.shift_start)} – {fmtTime(s.shift_end)}
                        </div>
                      )}
                    </div>
                    <AnimatedSelect
                      options={[
                        { value: "", label: "— No Schedule —" },
                        ...templates.map((t) => ({ value: String(t.id), label: t.name })),
                      ]}
                      value={s.schedule_id ? String(s.schedule_id) : ""}
                      onChange={(val) => assignScheduleToStaff(s.staff_id, val ? Number(val) : null)}
                      className="min-w-[160px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="p-4 rounded-xl bg-erl-surface border border-erl-border-subtle text-[12px] text-erl-text-faint leading-relaxed">
        <strong className="text-erl-text-secondary">💡 Tip:</strong> Create schedule templates first (e.g. "Morning Shift", "Closing Shift"), then assign them to staff. Break badges will show on the Today tab during lunch and snack hours.
      </div>
    </>
  );
};

export default TimeKeepingSchedules;
