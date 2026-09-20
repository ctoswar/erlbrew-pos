import React, { useState, useEffect, useCallback } from "react";
import {
  Staff,
  TimeRecord,
  ClockResponse,
  DayRecord,
  PrintResponse,
  TimekeepingTab,
} from "../types";
import { apiGet, apiPost, apiAdminPut } from "../utils/api";
import { toLocalDateStr, escapeHtml, fmtShort, getFinalY } from "../utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import TimeKeepingHeader from "./timekeeping/TimeKeepingHeader";
import ExportReportModal from "./timekeeping/ExportReportModal";
import EditRecordModal from "./timekeeping/EditRecordModal";
import TimeKeepingToday from "./timekeeping/TimeKeepingToday";
import TimeKeepingCalendar from "./timekeeping/TimeKeepingCalendar";
import TimeKeepingSchedules from "./timekeeping/TimeKeepingSchedules";

interface TimeKeepingProps {
  staff: Staff;
}

const localToMySql = (dt: string | null): string | null => {
  if (!dt) return null;
  if (dt.length === 16) return dt.replace('T', ' ') + ':00';
  return dt.replace('T', ' ').slice(0, 19);
};

export const TimeKeeping: React.FC<TimeKeepingProps> = ({ staff }) => {
  const isAdmin = staff.role === "Manager";
  const [tab, setTab] = useState<TimekeepingTab>("today");

  // Restrict non-admin to only "today" tab
  useEffect(() => {
    if (!isAdmin && tab !== "today") {
      setTab("today");
    }
  }, [isAdmin, tab]);

  // ── Tab: Today ──
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTap, setLastTap] = useState<ClockResponse | null>(null);
  const [tapError, setTapError] = useState<string | null>(null);

  // ── Tab: Calendar ──
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  // Edit modal state
  const [editingRecord, setEditingRecord] = useState<DayRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Print ──
  const [showPrintPicker, setShowPrintPicker] = useState(false);
  const getTodayStr = () => toLocalDateStr();
  const [printFrom, setPrintFrom] = useState(getTodayStr);
  const [printTo, setPrintTo] = useState(getTodayStr);

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

  // Auto-clear tap error after 4s
  useEffect(() => {
    if (!tapError) return;
    const t = setTimeout(() => setTapError(null), 4000);
    return () => clearTimeout(t);
  }, [tapError]);

  const handleTap = useCallback(async (rfid: string) => {
    setTapError(null);
    try {
      const data = await apiPost<ClockResponse>("/clock", { rfid });
      setLastTap(data);
      loadToday();
    } catch (err) {
      console.error("RFID tap handler error:", err);
      setTapError(err instanceof Error ? err.message : "RFID tap failed. Please try again.");
    }
  }, [loadToday]);

  // Auto-poll every 30s while on Today tab
  useEffect(() => {
    if (tab !== "today") return;
    const id = setInterval(loadToday, 30000);
    return () => clearInterval(id);
  }, [tab, loadToday]);

  // ── Print handler ──
  const handlePrint = useCallback(async () => {
    try {
      const data = await apiGet<PrintResponse>(`/clock/print?from=${printFrom}&to=${printTo}`);
      const fromLabel = new Date(printFrom + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" });
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
            <h1>${escapeHtml(companyName)}</h1>
            <div class="subtitle">Timekeeping Report \u2022 ${escapeHtml(fromLabel)} \u2013 ${escapeHtml(toLabel)}</div>
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
                return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + escapeHtml(s.role) + '</td><td>' + dp + ' / ' + data.total_days + '</td><td>' + th.toFixed(2) + '</td></tr>';
              }).join("")}
              <tr class="grand-total"><td colspan="3" style="text-align:right;padding-right:12px;">Grand Total:</td><td>${data.grand_total_hours.toFixed(2)}</td></tr>
            </tbody>
          </table>

          <div class="section-title">Daily Breakdown</div>
          ${data.dates.map((de, di) => {
            const dl = escapeHtml(new Date(de.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }));
            const hasRecords = de.staff.some((s) => s.records.length > 0);
            if (!hasRecords) return '<div class="date-header"><span>' + dl + ' (' + DAY_LABELS_FULL[de.day_of_week] + ')</span><span class="dh-right">No records</span></div>';
            const pb = di > 0 ? '<div class="page-break"></div>' : '';
            let rows = '';
            for (const s of de.staff) {
              const dayTotal = s.records.reduce((a, r) => a + Number(r.total_hours || 0), 0);
              const schedName = s.schedule_name ? escapeHtml(s.schedule_name) : (s.shift_start ? escapeHtml(fmtShort(s.shift_start) + '\u2013' + fmtShort(s.shift_end || '')) : null);
              if (s.records.length === 0) {
                rows += '<tr><td>' + escapeHtml(s.name) + '</td><td class="no-record">' + (schedName || '\u2014') + '</td><td class="no-record" colspan="3">Off / No records</td></tr>';
              } else {
                for (let ri = 0; ri < s.records.length; ri++) {
                  const r = s.records[ri];
                  const cin = escapeHtml(new Date(r.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" }));
                  const cout = r.clock_out ? escapeHtml(new Date(r.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })) : '<span style="color:#7abf7a">Active</span>';
                  const hrs = r.total_hours ? Number(r.total_hours).toFixed(2) : '\u2014';
                  if (ri === 0) {
                    rows += '<tr><td>' + escapeHtml(s.name) + '</td><td>' + (schedName ? '<span class="shift-badge">' + schedName + '</span>' : '\u2014') + '</td><td>' + cin + '</td><td>' + cout + '</td><td>' + hrs + '</td></tr>';
                  } else {
                    rows += '<tr><td></td><td></td><td>' + cin + '</td><td>' + cout + '</td><td>' + hrs + '</td></tr>';
                  }
                }
                if (s.records.length > 1) {
                  rows += '<tr class="total-row"><td colspan="4" style="text-align:right;padding-right:12px;">' + escapeHtml(s.name) + ' Day Total:</td><td>' + dayTotal.toFixed(2) + '</td></tr>';
                }
              }
            }
            return pb + '<div class="date-header"><span>' + dl + ' (' + DAY_LABELS_FULL[de.day_of_week] + ')</span><span class="dh-right">' + de.staff_present + ' staff &middot; ' + de.total_hours.toFixed(1) + 'h</span></div><table><thead><tr><th>Name</th><th>Shift</th><th>Clock In</th><th>Clock Out</th><th>Hours</th></tr></thead><tbody>' + rows + '</tbody></table>';
          }).join("")}

          <div class="footer">
            <div>Generated on ${escapeHtml(new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }))}</div>
          </div>
          <script>window.onload = function() { window.print(); }</scr` + `ipt></body></html>`);
      printWindow.document.close();
    } catch (err) {
      console.error("Failed to load print data:", err);
    } finally {
      setShowPrintPicker(false);
    }
  }, [printFrom, printTo]);

  // ── PDF Export handler ──
  const handleExportPDF = useCallback(async () => {
    try {
      const data = await apiGet<PrintResponse>(`/clock/print?from=${printFrom}&to=${printTo}`);
      const fromLabel = new Date(printFrom + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      const toLabel = new Date(printTo + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

      const doc = new jsPDF();
      const company = (() => { try { const s = localStorage.getItem("erlbrew_company_settings"); return s ? JSON.parse(s).company_name || "Erlbrew Cafe" : "Erlbrew Cafe"; } catch { return "Erlbrew Cafe"; } })();

      // Header
      doc.setFontSize(18);
      doc.text(company, 14, 22);
      doc.setFontSize(12);
      doc.text(`Timekeeping Report ${fromLabel} – ${toLabel}`, 14, 32);
      doc.setFontSize(9);
      doc.setTextColor(128);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);
      doc.setTextColor(0);

      let startY = 48;

      // Staff totals
      const staffTotals: Record<number, { name: string; role: string; total_hours: number; days_present: number }> = {};
      for (const de of data.dates) {
        for (const s of de.staff) {
          const hrs = s.records.reduce((a, r) => a + Number(r.total_hours || 0), 0);
          if (!staffTotals[s.staff_id]) staffTotals[s.staff_id] = { name: s.name, role: s.role, total_hours: 0, days_present: 0 };
          staffTotals[s.staff_id].total_hours += hrs;
          if (s.records.length > 0) staffTotals[s.staff_id].days_present++;
        }
      }

      // Summary
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Summary", 14, startY);
      startY += 6;

      autoTable(doc, {
        startY,
        head: [["Date Range", "Staff Active", "Total Hours"]],
        body: [[`${data.total_days} days`, `${data.unique_staff_present}/${data.total_staff}`, data.grand_total_hours.toFixed(1)]],
        theme: "grid",
        headStyles: { fillColor: [201, 135, 58] },
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });
      startY = getFinalY(doc) + 10;

      // Staff Summary
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Staff Summary", 14, startY);
      startY += 6;

      autoTable(doc, {
        startY,
        head: [["Name", "Role", "Days Present", "Total Hours"]],
        body: data.all_staff.map((s) => {
          const t = staffTotals[s.staff_id];
          return [
            s.name,
            s.role,
            `${t ? t.days_present : 0} / ${data.total_days}`,
            t ? t.total_hours.toFixed(2) : "0",
          ];
        }),
        theme: "grid",
        headStyles: { fillColor: [201, 135, 58] },
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });
      startY = getFinalY(doc) + 10;

      // Daily Breakdown
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Daily Breakdown", 14, startY);
      startY += 6;

      for (const de of data.dates) {
        const hasRecords = de.staff.some((s) => s.records.length > 0);
        if (!hasRecords) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text(`${de.date} (${de.day_of_week}) - No records`, 14, startY);
          startY += 6;
          continue;
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`${de.date} (${de.day_of_week}) - ${de.staff_present} staff · ${de.total_hours.toFixed(1)}h`, 14, startY);
        startY += 6;

        autoTable(doc, {
          startY,
          head: [["Name", "Shift", "Clock In", "Clock Out", "Hours"]],
          body: de.staff.flatMap((s) => {
            const schedName = s.schedule_name || (s.shift_start ? `${fmtShort(s.shift_start)}–${fmtShort(s.shift_end || "")}` : null);
            return s.records.map((r, ri) => [
              ri === 0 ? s.name : "",
              ri === 0 ? (schedName || "—") : "",
              new Date(r.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" }),
              r.clock_out ? new Date(r.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" }) : "Active",
              r.total_hours ? Number(r.total_hours).toFixed(2) : "—",
            ]);
          }),
          theme: "grid",
          headStyles: { fillColor: [201, 135, 58] },
          styles: { fontSize: 8 },
          margin: { left: 14 },
        });
        startY = getFinalY(doc) + 8;

        // Page break if needed
        if (startY > 250) {
          doc.addPage();
          startY = 20;
        }
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
      }

      // Save
      doc.save(`timekeeping-report-${printFrom}-to-${printTo}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setShowPrintPicker(false);
    }
  }, [printFrom, printTo]);

  const handleSaveAdjustment = async (id: number, clockIn: string | null, clockOut: string | null, reason: string) => {
    setSavingEdit(true);
    try {
      await apiAdminPut(`/clock/${id}/adjust`, {
        clock_in: localToMySql(clockIn),
        clock_out: clockOut === "" ? null : localToMySql(clockOut),
        reason,
      });
      setEditingRecord(null);
      await loadToday();
      if (selectedDate) {
        setDayLoading(true);
        try {
          const recs = await apiGet<DayRecord[]>(`/clock/calendar/${selectedDate}`);
          setDayRecords(recs);
        } catch (e) {
          console.error(e);
        }
        setDayLoading(false);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save adjustment";
      alert(message);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <TimeKeepingHeader
        isAdmin={isAdmin}
        activeTab={tab}
        onTabChange={setTab}
        onExportClick={() => setShowPrintPicker(true)}
      />

      <ExportReportModal
        show={showPrintPicker}
        printFrom={printFrom}
        printTo={printTo}
        onFromChange={setPrintFrom}
        onToChange={setPrintTo}
        onPrint={handlePrint}
        onExportPDF={handleExportPDF}
        onClose={() => setShowPrintPicker(false)}
      />

      <EditRecordModal
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
        onSave={handleSaveAdjustment}
        saving={savingEdit}
      />

      {/* Body */}
      <div className="scroll-area flex-1 p-5 flex flex-col gap-5 overflow-y-auto min-h-0">
        {tab === "today" && (
          <TimeKeepingToday
            staff={staff}
            records={records}
            loading={loading}
            lastTap={lastTap}
            tapError={tapError}
            onScan={handleTap}
          />
        )}

        {tab === "calendar" && (
          <TimeKeepingCalendar
            isAdmin={isAdmin}
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            dayRecords={dayRecords}
            dayLoading={dayLoading}
            onDayRecordsChange={setDayRecords}
            onDayLoadingChange={setDayLoading}
            onEditRecord={setEditingRecord}
          />
        )}

        {tab === "schedules" && (
          <TimeKeepingSchedules onSchedulesChanged={loadToday} />
        )}
      </div>
    </div>
  );
};
