import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiPost, apiAdminGet, apiAdminPut, apiAdminPost, apiAdminDelete } from "../utils/api";

interface ScheduleDay {
  shift_start: string | null;
  shift_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  snack_start: string | null;
  snack_end: string | null;
}

interface ScheduleTemplate {
  id: number;
  name: string;
  days: Record<string, ScheduleDay>;
}

interface StaffSchedule {
  staff_id: number;
  name: string;
  role: string;
  initials: string;
  color: string;
  schedule_id: number | null;
  schedule_name: string | null;
  shift_start: string | null;
  shift_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  snack_start: string | null;
  snack_end: string | null;
}

interface TimeRecord {
  id: number;
  staff_id: number;
  name: string;
  role: string;
  initials: string;
  color: string;
  status: "clocked_in" | "clocked_out" | "not_in";
  record: {
    id: number;
    clock_in: string;
    clock_out: string | null;
    total_hours: number;
  } | null;
  shift_start: string | null;
  shift_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  snack_start: string | null;
  snack_end: string | null;
}

interface ClockResponse {
  action: "clock_in" | "clock_out";
  staff: { staff_id: number; name: string; role: string; initials: string; color: string };
  record: TimeRecord["record"];
}

interface DayRecord {
  id: number;
  staff_id: number;
  clock_in: string;
  clock_out: string | null;
  total_hours: number;
  name: string;
  role: string;
  initials: string;
  color: string;
}

interface PrintStaffRecord {
  staff_id: number;
  name: string;
  role: string;
  initials: string;
  color: string;
  shift_start: string | null;
  shift_end: string | null;
  schedule_name: string | null;
  records: {
    id: number;
    staff_id: number;
    clock_in: string;
    clock_out: string | null;
    total_hours: number;
    record_date: string;
  }[];
}

interface PrintDateEntry {
  date: string;
  day_of_week: string;
  staff: PrintStaffRecord[];
  total_hours: number;
  staff_present: number;
}

interface PrintResponse {
  from: string;
  to: string;
  total_days: number;
  total_staff: number;
  unique_staff_present: number;
  grand_total_hours: number;
  dates: PrintDateEntry[];
  all_staff: { staff_id: number; name: string; role: string; initials: string; color: string }[];
}

type Tab = "today" | "calendar" | "schedules";

export const TimeKeeping: React.FC = () => {
  const [tab, setTab] = useState<Tab>("today");

  // ── Tab: Today ──
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTap, setLastTap] = useState<ClockResponse | null>(null);

  // ── Tab: Calendar ──
  const [calDate, setCalDate] = useState(() => new Date());
  const [summary, setSummary] = useState<Record<string, { staff_id: number; name: string; initials: string; color: string }[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  // ── Tab: Schedules ──
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [staffList, setStaffList] = useState<StaffSchedule[]>([]);
  const [staffListLoading, setStaffListLoading] = useState(false);
  const [schedulesMsg, setSchedulesMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [schedulesSubTab, setSchedulesSubTab] = useState<"templates" | "assignments">("templates");

  // ── Print ──
  const [showPrintPicker, setShowPrintPicker] = useState(false);
  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const [printFrom, setPrintFrom] = useState(getTodayStr);
  const [printTo, setPrintTo] = useState(getTodayStr);

  // Template form
  const DAYS_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const DAY_LABELS: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };
  const emptyDay = (): ScheduleDay => ({ shift_start: null, shift_end: null, lunch_start: null, lunch_end: null, snack_start: null, snack_end: null });
  const emptyDays = (): Record<string, ScheduleDay> => ({
    mon: emptyDay(), tue: emptyDay(), wed: emptyDay(), thu: emptyDay(), fri: emptyDay(), sat: emptyDay(),
  });

  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState<Partial<ScheduleTemplate>>({ name: "" });

  const loadToday = useCallback(() => {
    apiGet<TimeRecord[]>("/clock")
      .then(setRecords)
      .catch((err) => console.error("Failed to load clock records:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Auto-hide tap message after 4s
  useEffect(() => {
    if (!lastTap) return;
    const t = setTimeout(() => setLastTap(null), 4000);
    return () => clearTimeout(t);
  }, [lastTap]);

  const handleTap = useCallback(async (rfid: string) => {
    try {
      const data = await apiPost<ClockResponse>("/clock", { rfid });
      setLastTap(data);
      loadToday();
    } catch (err) { console.error("RFID tap handler error:", err); }
  }, [loadToday]);

  // ── Print handler ──
  const handlePrint = useCallback(async () => {
    try {
      const data = await apiGet<PrintResponse>(`/clock/print?from=${printFrom}&to=${printTo}`);
      const dateObj = new Date(printFrom + "T00:00:00");
      const fromLabel = dateObj.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      const toLabel = new Date(printTo + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      const companyName = (() => { try { const s = localStorage.getItem("erlbrew_company_settings"); return s ? JSON.parse(s).company_name || "Erlbrew Cafe" : "Erlbrew Cafe"; } catch { return "Erlbrew Cafe"; } })();

      const DAY_LABELS_FULL: Record<string, string> = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

      const staffTotals: Record<number, { name: string; role: string; total_hours: number; days_present: number }> = {};
      for (const de of data.dates) {
        for (const s of de.staff) {
          const hrs = s.records.reduce((a, r) => a + Number(r.total_hours || 0), 0);
          if (!staffTotals[s.staff_id]) staffTotals[s.staff_id] = { name: s.name, role: s.role, total_hours: 0, days_present: 0 };
          staffTotals[s.staff_id].total_hours += hrs;
          if (s.records.length > 0) staffTotals[s.staff_id].days_present++;
        }
      }

      printWindow.document.write(`<!DOCTYPE html><html><head>
        <title>Timekeeping Report</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1a0e06; }
          .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #C9873A; padding-bottom: 10px; }
          .header h1 { font-size: 20px; color: #1a0e06; margin-bottom: 3px; }
          .header .subtitle { font-size: 12px; color: #C9873A; }
          .summary { display: flex; gap: 10px; margin-bottom: 14px; justify-content: center; flex-wrap: wrap; }
          .summary-box { background: #f9f5f2; border: 1px solid #e0d5c8; border-radius: 8px; padding: 7px 14px; text-align: center; min-width: 60px; }
          .summary-box .label { font-size: 7px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
          .summary-box .value { font-size: 15px; font-weight: 700; color: #C9873A; }
          .section-title { font-size: 13px; color: #1a0e06; margin: 16px 0 5px 0; padding-bottom: 3px; border-bottom: 1px solid #e0d5c8; font-weight: 700; }
          .date-header { background: #f5f0eb; padding: 5px 9px; font-weight: 700; font-size: 10px; color: #5a4535; margin-top: 12px; border-radius: 4px 4px 0 0; border: 1px solid #ddd; border-bottom: none; display: flex; justify-content: space-between; }
          .date-header .dh-right { font-weight: 400; color: #C9873A; }
          table { width:100%; border-collapse:collapse; margin-bottom:4px; font-size:10px; }
          th, td { border:1px solid #ddd; padding:4px 7px; text-align:left; }
          th { background: #f5f0eb; font-weight:600; font-size:8px; text-transform:uppercase; letter-spacing:0.5px; color:#5a4535; }
          td { font-size:10px; }
          .no-record { color: #999; font-style: italic; font-size:9px; }
          .shift-badge { display: inline-block; font-size:8px; background: #fdf3e8; color: #C9873A; padding: 1px 4px; border-radius: 3px; }
          .footer { margin-top: 18px; text-align: center; font-size: 7px; color: #999; border-top: 1px solid #e0d5c8; padding-top: 8px; }
          .total-row { font-weight: 700; background: #f9f5f2; }
          .grand-total { background: #C9873A; color: #fff; font-weight: 700; }
          .page-break { page-break-before: always; }
          @media print { body { padding: 10px; font-size:9px; } }
          </style></head><body>
          <div class="header">
            <h1>${companyName}</h1>
            <div class="subtitle">Timekeeping Report \u2022 ${fromLabel} \u2013 ${toLabel}</div>
          </div>
          <div class="summary">
            <div class="summary-box"><div class="label">Date Range</div><div class="value">${data.total_days}d</div></div>
            <div class="summary-box"><div class="label">Staff Active</div><div class="value">${data.unique_staff_present}/${data.total_staff}</div></div>
            <div class="summary-box"><div class="label">Total Hours</div><div class="value">${data.grand_total_hours.toFixed(1)}</div></div>
          </div>

          <div class="section-title">Staff Summary</div>
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Days Present</th><th>Total Hours</th></tr></thead>
            <tbody>
              ${data.all_staff.map((s) => {
                const t = staffTotals[s.staff_id];
                const dp = t ? t.days_present : 0;
                const th = t ? t.total_hours : 0;
                return '<tr><td>' + s.name + '</td><td>' + s.role + '</td><td>' + dp + ' / ' + data.total_days + '</td><td>' + th.toFixed(2) + '</td></tr>';
              }).join("")}
              <tr class="grand-total"><td colspan="3" style="text-align:right;padding-right:12px;">Grand Total:</td><td>${data.grand_total_hours.toFixed(2)}</td></tr>
            </tbody>
          </table>

          <div class="section-title">Daily Breakdown</div>
          ${data.dates.map((de, di) => {
            const dl = new Date(de.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
            const hasRecords = de.staff.some((s) => s.records.length > 0);
            if (!hasRecords) return '<div class="date-header"><span>' + dl + ' (' + DAY_LABELS_FULL[de.day_of_week] + ')</span><span class="dh-right">No records</span></div>';
            const pb = di > 0 ? '<div class="page-break"></div>' : '';
            let rows = '';
            for (const s of de.staff) {
              const dayTotal = s.records.reduce((a, r) => a + Number(r.total_hours || 0), 0);
              const schedName = s.schedule_name || (s.shift_start ? fmtShort(s.shift_start) + '\u2013' + fmtShort(s.shift_end || '') : null);
              if (s.records.length === 0) {
                rows += '<tr><td>' + s.name + '</td><td class="no-record">' + (schedName || '\u2014') + '</td><td class="no-record" colspan="3">Off / No records</td></tr>';
              } else {
                for (let ri = 0; ri < s.records.length; ri++) {
                  const r = s.records[ri];
                  const cin = new Date(r.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
                  const cout = r.clock_out ? new Date(r.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : '<span style="color:#7abf7a">Active</span>';
                  const hrs = r.total_hours ? Number(r.total_hours).toFixed(2) : '\u2014';
                  if (ri === 0) {
                    rows += '<tr><td>' + s.name + '</td><td>' + (schedName ? '<span class="shift-badge">' + schedName + '</span>' : '\u2014') + '</td><td>' + cin + '</td><td>' + cout + '</td><td>' + hrs + '</td></tr>';
                  } else {
                    rows += '<tr><td></td><td></td><td>' + cin + '</td><td>' + cout + '</td><td>' + hrs + '</td></tr>';
                  }
                }
                if (s.records.length > 1) {
                  rows += '<tr class="total-row"><td colspan="4" style="text-align:right;padding-right:12px;">' + s.name + ' Day Total:</td><td>' + dayTotal.toFixed(2) + '</td></tr>';
                }
              }
            }
            return pb + '<div class="date-header"><span>' + dl + ' (' + DAY_LABELS_FULL[de.day_of_week] + ')</span><span class="dh-right">' + de.staff_present + ' staff &middot; ' + de.total_hours.toFixed(1) + 'h</span></div><table><thead><tr><th>Name</th><th>Shift</th><th>Clock In</th><th>Clock Out</th><th>Hours</th></tr></thead><tbody>' + rows + '</tbody></table>';
          }).join("")}

          <div class="footer">
            <div>Generated on ${new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <script>window.onload = function() { window.print(); }</scr` + `ipt></body></html>`);
      printWindow.document.close();
    } catch (err) {
      console.error("Failed to load print data:", err);
    } finally {
      setShowPrintPicker(false);
    }
  }, [printFrom, printTo]);

  // Auto-poll every 30s
  useEffect(() => {
    const id = setInterval(loadToday, 30000);
    return () => clearInterval(id);
  }, [loadToday]);

  // ── Schedules logic ──
  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    apiAdminGet<ScheduleTemplate[]>("/staff-schedules")
      .then(setTemplates)
      .catch((err) => console.error("Failed to load schedule templates:", err))
      .finally(() => setTemplatesLoading(false));
  }, []);

  const loadStaffWithSchedules = useCallback(() => {
    setStaffListLoading(true);
    apiAdminGet<StaffSchedule[]>("/staff")
      .then((data) => {
        const normalized = data.map((s: any) => ({
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
    if (tab === "schedules") {
      loadTemplates();
      loadStaffWithSchedules();
    }
  }, [tab, loadTemplates, loadStaffWithSchedules]);

  const showSchedulesMsg = (text: string, ok: boolean) => {
    setSchedulesMsg({ text, ok });
    setTimeout(() => setSchedulesMsg(null), 2500);
  };

  const saveTemplate = async () => {
    if (!templateForm.name?.trim()) { showSchedulesMsg("Schedule name is required", false); return; }
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
      loadToday();
    } catch (e: any) {
      showSchedulesMsg(e.message || "Failed to save schedule", false);
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm("Delete this schedule template? Staff assigned to it will lose their schedule.")) return;
    try {
      await apiAdminDelete(`/staff-schedules/${id}`);
      showSchedulesMsg("Schedule deleted", true);
      loadTemplates();
      loadStaffWithSchedules();
      loadToday();
    } catch (e: any) {
      showSchedulesMsg(e.message || "Failed to delete schedule", false);
    }
  };

  const assignScheduleToStaff = async (staffId: number, scheduleId: number | null) => {
    try {
      await apiAdminPut(`/staff/${staffId}`, { schedule_id: scheduleId });
      showSchedulesMsg("Assignment saved", true);
      loadStaffWithSchedules();
      loadToday();
    } catch (e: any) {
      showSchedulesMsg(e.message || "Failed to assign schedule", false);
    }
  };

  // ── Calendar logic ──
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;

  // Fetch monthly summary
  useEffect(() => {
    if (tab !== "calendar") return;
    apiGet<Record<string, { staff_id: number; name: string; initials: string; color: string }[]>>(`/clock/summary/${monthStr}`)
      .then(setSummary)
      .catch(() => setSummary({}));
  }, [tab, monthStr]);

  // Fetch selected day records
  useEffect(() => {
    if (!selectedDate) { setDayRecords([]); return; }
    setDayLoading(true);
    apiGet<DayRecord[]>(`/clock/calendar/${selectedDate}`)
      .then(setDayRecords)
      .catch(() => setDayRecords([]))
      .finally(() => setDayLoading(false));
  }, [selectedDate]);

  // Build calendar grid
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const todayStr = new Date().toISOString().split("T")[0];

  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setCalDate(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalDate(new Date(calYear, calMonth + 1, 1));

  const dateStr = (d: number) => `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const now = new Date();
  const todayDateStr = now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const clockedIn = records.filter((r) => r.status === "clocked_in");
  const clockedOut = records.filter((r) => r.status === "clocked_out");
  const notIn = records.filter((r) => r.status === "not_in");

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header with tabs */}
      <div className="glass-panel px-4 md:px-5 py-3.5 border-b border-erl-accent/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between flex-shrink-0 rounded-none gap-2">
        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-erl-accent/10 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="font-display text-lg font-bold text-erl-text-primary tracking-wide">Timekeeping</div>
          <div className="flex gap-1 bg-erl-base rounded-xl p-0.5 border border-erl-border-subtle">
            {([["today", "Today"], ["calendar", "Calendar"], ["schedules", "Schedules"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key as Tab)} className={`
                px-3 py-1.5 sm:px-3.5 text-xs rounded-lg cursor-pointer transition-all duration-200 font-semibold tracking-wide min-h-[44px]
                ${tab === key
                  ? "bg-erl-accent/15 text-erl-accent shadow-sm"
                  : "text-erl-text-faint hover:text-erl-text-secondary"}
              `}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-erl-text-faint tracking-wide font-medium hidden sm:block">{todayDateStr}</div>
        <button
          onClick={() => setShowPrintPicker(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-erl-border-default text-erl-text-secondary text-xs font-semibold tracking-wide cursor-pointer hover:border-erl-accent/30 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[44px]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 12H4a2 2 0 00-2 2v4a2 2 0 002 2h16a2 2 0 002-2v-4a2 2 0 00-2-2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Report
        </button>
      </div>

      {/* Print Date Range Picker Modal */}
      {showPrintPicker && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setShowPrintPicker(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[360px]">
              <div className="font-display text-base font-bold text-erl-text-primary mb-4">Print Timekeeping Report</div>
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1.5 block">From</label>
                  <input
                    type="date"
                    value={printFrom}
                    onChange={(e) => setPrintFrom(e.target.value)}
                    className="w-full text-sm bg-erl-base border border-erl-border-medium rounded-xl px-3 py-2.5 text-erl-text-primary outline-none focus:border-erl-accent"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1.5 block">To</label>
                  <input
                    type="date"
                    value={printTo}
                    onChange={(e) => setPrintTo(e.target.value)}
                    className="w-full text-sm bg-erl-base border border-erl-border-medium rounded-xl px-3 py-2.5 text-erl-text-primary outline-none focus:border-erl-accent"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowPrintPicker(false)} className="btn btn-ghost text-xs px-4 py-2.5 min-h-[44px]">
                  Cancel
                </button>
                <button onClick={handlePrint} className="btn btn-accent text-xs px-5 py-2.5 font-semibold tracking-wide min-h-[44px]">
                  Print
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Body */}
      <div className="scroll-area flex-1 p-5 flex flex-col gap-5 overflow-y-auto min-h-0">

        {tab === "today" && (
          <>
            {/* Last tap feedback */}
            {lastTap && (
              <div className={`animate-scale-in rounded-2xl overflow-hidden transition-all duration-500 ${
                lastTap.action === "clock_in" ? "border border-erl-success/30" : "border border-erl-accent/30"
              }`}>
                <div className="h-[2px]" style={{
                  background: lastTap.action === "clock_in"
                    ? 'linear-gradient(90deg, rgba(122,191,122,0.6), transparent)'
                    : 'linear-gradient(90deg, rgba(196,149,106,0.6), transparent)'
                }} />
                <div className={`px-5 py-4 ${lastTap.action === "clock_in" ? "bg-erl-success-bg" : "bg-erl-accent/[0.06]"}`}>
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-12 h-12 rounded-2xl flex items-center justify-center text-lg flex-shrink-0
                      ${lastTap.action === "clock_in"
                        ? "bg-erl-success/15 text-erl-success"
                        : "bg-erl-accent/15 text-erl-accent"}
                    `}>
                      {lastTap.action === "clock_in" ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-erl-text-primary">
                        {lastTap.action === "clock_in" ? "Clocked In" : "Clocked Out"}
                      </div>
                      <div className="text-sm text-erl-accent font-semibold mt-0.5">
                        {lastTap.staff.name} · {lastTap.staff.role}
                      </div>
                      {lastTap.record?.clock_in && (
                        <div className="text-xs text-erl-text-muted mt-1 font-medium">
                          {`In: ${new Date(lastTap.record.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`}
                          {lastTap.record?.clock_out ? `  Out: ${new Date(lastTap.record.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RFID Scan Box */}
            <div className="card-glass p-5 text-center relative">
              <div className="relative z-10 flex flex-col items-center">
                <div className="text-2xl mb-2">📲</div>
                <div className="font-display text-sm text-erl-text-primary font-bold tracking-wide mb-0.5">Scan Your Card</div>
                <div className="text-[10px] text-erl-text-faint mb-3 tracking-wide">Tap to clock in or out</div>
                <RfidInput onScan={handleTap} />
              </div>
            </div>

            {/* Staff status groups */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
                <span className="text-sm text-erl-text-muted">Loading...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <StaffGroup label="Clocked In" count={clockedIn.length} color="rgb(122,191,122)" records={clockedIn} />
                <StaffGroup label="Not Yet In" count={notIn.length} color="rgb(138,112,88)" records={notIn} />
                <StaffGroup label="Clocked Out" count={clockedOut.length} color="rgb(196,149,106)" records={clockedOut} />
              </div>
            )}
          </>
        )}

        {tab === "calendar" && (
          <>
            {/* Month Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-surface border-erl-border-subtle">
                <div className="w-8 h-8 rounded-lg bg-erl-accent/10 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold tabular-nums leading-tight text-erl-text-primary">
                    {Object.keys(summary).length}
                  </span>
                  <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">Active Days</span>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-surface border-erl-border-subtle">
                <div className="w-8 h-8 rounded-lg bg-erl-accent/10 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold tabular-nums leading-tight text-erl-text-primary">
                    {Object.values(summary).reduce((acc, arr) => acc + arr.length, 0)}
                  </span>
                  <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">Clock-ins</span>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-accent/[0.06] border-erl-accent/20">
                <div className="w-8 h-8 rounded-lg bg-erl-accent/15 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold tabular-nums leading-tight text-erl-accent">
                    {selectedDate ? dayRecords.reduce((acc, r) => acc + Number(r.total_hours || 0), 0).toFixed(1) : "—"}
                  </span>
                  <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">
                    {selectedDate ? "Day Hours" : "Select a date"}
                  </span>
                </div>
              </div>
            </div>

            {/* Calendar Navigation */}
            <div className="flex items-center justify-between gap-2">
              <button onClick={prevMonth} className="w-10 h-10 rounded-xl border border-erl-border-default bg-erl-surface/50 text-erl-text-secondary cursor-pointer flex items-center justify-center hover:border-erl-accent/30 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[44px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>

              <div className="flex flex-col items-center">
                <div className="font-display text-lg sm:text-xl font-bold text-erl-text-primary tracking-wide">
                  {monthNames[calMonth]}
                </div>
                <div className="text-xs text-erl-text-muted font-medium tracking-wider mt-0.5">
                  {calYear}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => { const now = new Date(); setCalDate(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(todayStr); }} className="px-3 py-2 rounded-xl border border-erl-border-default bg-erl-surface/50 text-erl-text-secondary cursor-pointer text-[11px] font-semibold tracking-wide hover:border-erl-accent/30 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[44px]">
                  Today
                </button>
                <button onClick={nextMonth} className="w-10 h-10 rounded-xl border border-erl-border-default bg-erl-surface/50 text-erl-text-secondary cursor-pointer flex items-center justify-center hover:border-erl-accent/30 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[44px]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="card-glass overflow-hidden rounded-2xl">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-erl-border-subtle bg-erl-base/60">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, idx) => (
                  <div key={d} className={`py-3 text-center text-[11px] font-bold tracking-[0.15em] uppercase ${idx === 0 || idx === 6 ? "text-erl-accent/60" : "text-erl-text-faint"}`}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {days.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} className="min-h-[60px] sm:min-h-[80px] bg-erl-base/20" />;
                  const ds = dateStr(d);
                  const dayStaff = summary[ds] || [];
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDate;
                  const isWeekend = i % 7 === 0 || i % 7 === 6;

                  return (
                    <div
                      key={ds}
                      onClick={() => setSelectedDate(isSelected ? null : ds)}
                      className={`
                        relative p-1.5 sm:p-2 min-h-[60px] sm:min-h-[80px] cursor-pointer transition-all duration-200
                        ${i % 7 !== 6 ? "border-r border-erl-border-subtle" : ""}
                        ${days.length - i > 7 ? "border-b border-erl-border-subtle" : ""}
                        ${isSelected ? "bg-erl-accent/10" : isToday ? "bg-erl-accent/[0.04]" : isWeekend ? "bg-erl-base/[0.03]" : "hover:bg-erl-accent/[0.02]"}
                      `}
                    >
                      {/* Today indicator ring */}
                      <div className={`flex items-center justify-center mb-2 ${isToday ? "relative" : ""}`}>
                        {isToday && (
                          <div className="absolute inset-0 -m-0.5 rounded-full border-2 border-erl-accent/40" />
                        )}
                        <span className={`text-sm font-semibold ${isToday ? "text-erl-accent" : isWeekend ? "text-erl-text-muted" : "text-erl-text-secondary"}`}>
                          {d}
                        </span>
                      </div>

                      {/* Staff indicators */}
                      {dayStaff.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 sm:gap-1 justify-center">
                          {dayStaff.slice(0, 3).map((s) => (
                            <div key={s.staff_id} title={s.name} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[6px] sm:text-[7px] font-bold text-white shadow-sm"
                              style={{ background: s.color || "#555" }}>
                              {s.initials}
                            </div>
                          ))}
                          {dayStaff.length > 3 && (
                            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-erl-border-default flex items-center justify-center text-[6px] sm:text-[7px] font-bold text-erl-text-muted">
                              +{dayStaff.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Subtle dot for days with records */}
                      {dayStaff.length > 0 && !isSelected && (
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-erl-accent/40" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Detail Panel */}
            {selectedDate && (
              <div className="flex flex-col gap-4">
                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-erl-accent/10 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-erl-text-primary tracking-wide">
                        {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
                      </div>
                      <div className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold">
                        {dayLoading ? "Loading records..." : `${dayRecords.length} staff ${dayRecords.length === 1 ? "member" : "members"}`}
                      </div>
                    </div>
                  </div>
                  {dayLoading && (
                    <div className="w-5 h-5 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
                  )}
                </div>

                {/* Staff cards */}
                {dayLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
                    <span className="text-sm text-erl-text-muted">Loading records...</span>
                  </div>
                ) : dayRecords.length === 0 ? (
                  <div className="card-glass rounded-2xl p-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-erl-accent/5 flex items-center justify-center mx-auto mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-erl-text-faint">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="text-sm text-erl-text-muted font-medium">No time records for this date</div>
                    <div className="text-[11px] text-erl-text-faint mt-1">Select another day to view records</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {dayRecords.map((rec) => {
                      const hours = rec.total_hours ? Number(rec.total_hours) : 0;
                      return (
                        <div key={rec.id} className="card-glass rounded-xl px-4 py-3.5 flex items-center gap-3.5 transition-all duration-200 hover:border-erl-accent/15">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${rec.color || "#555"}, ${(rec.color || "#555")}cc)`,
                              boxShadow: `0 3px 12px ${(rec.color || "#555")}30`,
                            }}>
                            {rec.initials}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-erl-text-primary">{rec.name}</div>
                            <div className="text-[10px] text-erl-text-faint tracking-[0.1em] uppercase font-semibold mt-0.5">{rec.role}</div>
                          </div>

                          {/* Times */}
                          <div className="text-right flex-shrink-0 flex flex-col items-end gap-0.5">
                            <div className="text-xs text-erl-text-secondary font-semibold">
                              {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                              {rec.clock_out ? (
                                <span className="text-erl-text-faint"> → {new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
                              ) : (
                                <span className="ml-1.5 inline-flex items-center gap-1">
                                  <span className="animate-pulse text-erl-success">●</span>
                                  <span className="text-[10px] font-semibold text-erl-success">Active</span>
                                </span>
                              )}
                            </div>
                            {hours > 0 && (
                              <div className="text-[10px] text-erl-accent font-bold">
                                {hours.toFixed(1)}h
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Day total summary */}
                    <div className="mt-1 rounded-xl border border-erl-accent/20 bg-erl-accent/[0.06] px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-erl-accent shadow-[0_0_8px_rgba(196,149,106,0.4)]" />
                        <span className="text-[11px] font-bold tracking-[0.15em] text-erl-text-secondary uppercase">Day Total</span>
                      </div>
                      <span className="font-display text-base font-bold text-erl-accent tabular-nums">
                        {dayRecords.reduce((acc, r) => acc + Number(r.total_hours || 0), 0).toFixed(1)}h
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "schedules" && (
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
                          <select
                            value={s.schedule_id || ""}
                            onChange={(e) => assignScheduleToStaff(s.staff_id, e.target.value ? Number(e.target.value) : null)}
                            className="text-xs bg-erl-base border border-erl-border-medium rounded-xl px-3 py-2 text-erl-text-primary outline-none focus:border-erl-accent min-w-[160px]"
                          >
                            <option value="">— No Schedule —</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
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
        )}
      </div>
    </div>
  );
};

// ── RFID Scan Input ──
const RfidInput: React.FC<{ onScan: (rfid: string) => void }> = ({ onScan }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      onScan(value.replace(/[\x00-\x1f]/g, '').trim());
      setValue("");
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-center">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="fixed top-0 left-0 w-px h-px opacity-0 -z-[1]"
        autoFocus
      />
      <div onClick={() => inputRef.current?.focus()} className="flex flex-col items-center gap-3 cursor-pointer py-2">
        <div className="relative w-[140px] h-[88px]">
          {/* Subtle ambient glow */}
          <div className="absolute -inset-2 rounded-[16px] bg-erl-accent/[0.03] blur-md animate-pulse-glow pointer-events-none" />

          {/* Card body */}
          <div
            className="absolute inset-0 rounded-[14px] cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
            style={{
              background: 'linear-gradient(145deg, rgba(196,149,106,0.13) 0%, rgba(196,149,106,0.04) 35%, rgba(42,27,18,0.55) 100%)',
              border: '1.5px solid rgba(196,149,106,0.2)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 40px rgba(196,149,106,0.04)',
            }}
          >
            {/* Light diffusion */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />

            {/* Chip */}
            <div className="absolute top-3.5 left-3.5 w-7 h-[18px] rounded-sm overflow-hidden" style={{
              background: 'linear-gradient(135deg, #d4a87a, #8a6a4a)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.35)',
            }}>
              <div className="absolute inset-[2px] border border-white/15 rounded-[1px]" />
            </div>

            {/* Contactless icon — compact SVG */}
            <div className="absolute top-3 left-[48px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent/35">
                <path d="M2 12C2 6.5 6.5 2 12 2"/><path d="M6 12C6 8.7 8.7 6 12 6"/><path d="M10 12C10 10.9 10.9 10 12 10"/>
              </svg>
            </div>

            {/* Card number dots */}
            <div className="absolute bottom-[18px] left-3.5 flex gap-1.5">
              {[1,2,3].map((g) => (
                <div key={g} className="flex gap-[2px]">
                  {[1,2,3].map((d) => (
                    <div key={d} className="w-[2.5px] h-[2.5px] rounded-full bg-erl-accent/20" />
                  ))}
                </div>
              ))}
            </div>

            {/* Brand */}
            <div className="absolute bottom-2.5 right-3">
              <span className="text-[6px] font-bold text-erl-accent tracking-[2px] opacity-40" style={{ fontFamily: "'Playfair Display', serif" }}>TAP</span>
            </div>

            {/* Scan line */}
            <div className="absolute left-2 right-2 h-[1.5px] bg-gradient-to-r from-transparent via-erl-accent/70 to-transparent shadow-[0_0_16px_rgba(196,149,106,0.5),0_0_32px_rgba(196,149,106,0.15)] animate-scan-line rounded-full" />
          </div>

          {/* Bottom reflection — subtle */}
          <div className="absolute -bottom-2.5 left-[20%] right-[20%] h-5 bg-gradient-to-t from-erl-accent/[0.02] to-transparent rounded-full blur-md" />
        </div>
        <div className="text-xs text-erl-text-muted tracking-wide font-medium">
          Tap your card to clock in/out
        </div>
      </div>
    </div>
  );
};

// ── Helpers ──
function fmtTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtShort(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isWithinBreak(now: Date, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  const n = now.getHours() * 60 + now.getMinutes();
  return n >= s && n < e;
}

function getLateMinutes(clockIn: string, shiftStart: string | null): number {
  if (!shiftStart) return 0;
  const ci = new Date(clockIn);
  const [sh, sm] = shiftStart.split(":").map(Number);
  const ciMin = ci.getHours() * 60 + ci.getMinutes();
  const ssMin = sh * 60 + sm;
  const diff = ciMin - ssMin;
  const GRACE = 15; // 15-minute grace period
  return diff > GRACE ? diff : 0;
}

// ── Staff Group ──
const StaffGroup: React.FC<{
  label: string;
  count: number;
  color: string;
  records: TimeRecord[];
}> = ({ label, count, color, records }) => (
  <div>
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: color, boxShadow: `0 0 8px ${color}40` }} />
      <span className="text-[10px] font-bold tracking-[0.2em] text-erl-text-faint uppercase">{label}</span>
      <span className="text-[10px] text-erl-text-faint font-semibold">({count})</span>
    </div>
    {records.length === 0 ? (
      <div className="text-xs text-erl-text-faint py-3 italic px-2">No one yet</div>
    ) : (
      <div className="flex flex-col gap-2">
        {records.map((r) => {
          const rec = r.record;
          const hours = rec?.total_hours ? parseFloat(String(rec.total_hours)) : 0;
          const statusColor = r.status === "clocked_in" ? "rgb(122,191,122)" : r.status === "clocked_out" ? "rgb(196,149,106)" : "rgb(90,69,53)";
          const now = new Date();
          const onLunch = r.status === "clocked_in" && isWithinBreak(now, r.lunch_start, r.lunch_end);
          const onSnack = r.status === "clocked_in" && isWithinBreak(now, r.snack_start, r.snack_end);
          const lateMins = rec ? getLateMinutes(rec.clock_in, r.shift_start) : 0;
          const isLate = lateMins > 0;
          return (
            <div key={r.staff_id} className="card-glass px-4 py-3.5 flex items-center gap-3.5 transition-all duration-200 hover:border-erl-accent/15">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${r.color || "#555"}, ${(r.color || "#555")}cc)`,
                  boxShadow: `0 3px 12px ${(r.color || "#555")}30`,
                }}>
                {r.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-erl-text-primary">{r.name}</div>
                <div className="text-[10px] text-erl-text-faint tracking-[0.1em] uppercase font-semibold mt-0.5">{r.role}</div>
                {/* Schedule pills */}
                {(r.shift_start || r.shift_end || isLate) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(r.shift_start || r.shift_end) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-erl-accent/8 text-erl-accent font-semibold tracking-wide">
                        Shift {fmtTime(r.shift_start)} – {fmtTime(r.shift_end)}
                      </span>
                    )}
                    {isLate && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-erl-danger/10 text-erl-danger font-semibold tracking-wide">
                        Late {lateMins}m
                      </span>
                    )}
                    {onLunch && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-erl-success/10 text-erl-success font-semibold tracking-wide">
                        On Lunch
                      </span>
                    )}
                    {onSnack && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#d4a87a]/15 text-[#d4a87a] font-semibold tracking-wide">
                        Snack Break
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Time */}
              <div className="text-right flex-shrink-0">
                {rec ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="text-xs text-erl-text-secondary font-semibold">
                      {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      {rec.clock_out ? (
                        <span className="text-erl-text-faint"> → {new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
                      ) : (
                        <span className="ml-1.5 inline-flex items-center gap-1">
                          <span className="animate-pulse" style={{ color: statusColor }}>●</span>
                          <span className="text-[10px] font-semibold" style={{ color: statusColor }}>Active</span>
                        </span>
                      )}
                    </div>
                    {hours > 0 && (
                      <div className="text-[10px] text-erl-accent font-bold">
                        {hours.toFixed(1)}h
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-erl-text-faint">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);