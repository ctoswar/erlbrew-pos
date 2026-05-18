import React, { useState, useEffect, useCallback, useMemo } from "react";
import { formatCurrency } from "../utils";
import {
  apiAdminGet,
  apiAdminPost,
  apiAdminPut,
  apiAdminDelete,
} from "../utils/api";
import type {
  PayrollPeriod,
  PayrollPeriodStatus,
  PayrollEntry,
  StaffPayrollInfo,
  PayBasis,
  TaxStatus,
} from "../types";

type TabKey = "overview" | "staff-rates";

interface PeriodForm {
  dateFrom: string;
  dateTo: string;
  payDate: string;
  label: string;
}

const STATUS_COLORS: Record<PayrollPeriodStatus, string> = {
  open: "pill-muted",
  computed: "pill-accent",
  approved: "pill-success",
  paid: "pill-success",
};

const STATUS_LABELS: Record<PayrollPeriodStatus, string> = {
  open: "Open",
  computed: "Computed",
  approved: "Approved",
  paid: "Paid",
};

const TAX_STATUS_OPTIONS: { value: TaxStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "head_of_family", label: "Head of Family" },
];

const PAY_BASIS_OPTIONS: { value: PayBasis; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
];

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function getSemiMonthlyDates(which: "first" | "second"): {
  from: string;
  to: string;
  payDate: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (which === "first") {
    const from = new Date(year, month, 1);
    const to = new Date(year, month, 15);
    const payDate = new Date(year, month, 20);
    return {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      payDate: payDate.toISOString().split("T")[0],
    };
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  const from = new Date(year, month, 16);
  const to = new Date(year, month, lastDay);
  const payDate = new Date(year, month + 1, 5);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
    payDate: payDate.toISOString().split("T")[0],
  };
}

function periodLabel(from: string, to: string): string {
  const d1 = new Date(from);
  const d2 = new Date(to);
  const sameMonth = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const monthName = d1.toLocaleDateString("en-PH", { month: "short" });
  const year = d1.getFullYear();
  if (sameMonth) {
    if (d1.getDate() === 1 && d2.getDate() === 15) return `${monthName} 1st Half ${year}`;
    if (d1.getDate() === 16) return `${monthName} 2nd Half ${year}`;
    return `${monthName} ${d1.getDate()}–${d2.getDate()}, ${year}`;
  }
  const m2 = d2.toLocaleDateString("en-PH", { month: "short" });
  return `${monthName} ${d1.getDate()} – ${m2} ${d2.getDate()}, ${year}`;
}

export const AdminPayroll: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // ── Overview state ──
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Create period modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [periodForm, setPeriodForm] = useState<PeriodForm>({
    dateFrom: "",
    dateTo: "",
    payDate: "",
    label: "",
  });
  const [creating, setCreating] = useState(false);

  // Payslip modal
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);

  // Action states
  const [computingId, setComputingId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  // ── Staff Rates state ──
  const [staffList, setStaffList] = useState<StaffPayrollInfo[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editStaffForm, setEditStaffForm] = useState<Partial<StaffPayrollInfo>>({});
  const [savingStaff, setSavingStaff] = useState(false);

  const showToast = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const loadPeriods = useCallback(async () => {
    setLoadingPeriods(true);
    setError("");
    try {
      const data = await apiAdminGet<PayrollPeriod[]>("/payroll/periods");
      setPeriods(data);
      if (data.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(data[0].id);
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Failed to load periods";
      setError(err);
    } finally {
      setLoadingPeriods(false);
    }
  }, [selectedPeriodId]);

  const loadEntries = useCallback(async (periodId: number) => {
    setLoadingEntries(true);
    try {
      const data = await apiAdminGet<PayrollEntry[]>(`/payroll/periods/${periodId}/entries`);
      setEntries(data);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Failed to load entries";
      showToast(err, false);
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  const loadStaffRates = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const data = await apiAdminGet<StaffPayrollInfo[]>("/payroll/staff-with-rates");
      setStaffList(data);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Failed to load staff rates";
      showToast(err, false);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    if (selectedPeriodId) {
      loadEntries(selectedPeriodId);
    }
  }, [selectedPeriodId, loadEntries]);

  useEffect(() => {
    if (activeTab === "staff-rates") {
      loadStaffRates();
    }
  }, [activeTab, loadStaffRates]);

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) || null,
    [periods, selectedPeriodId]
  );

  const summary = useMemo(() => {
    const totalGross = entries.reduce((s, e) => s + (e.gross_pay || 0), 0);
    const totalDeductions = entries.reduce((s, e) => s + (e.total_deductions || 0), 0);
    const totalNet = entries.reduce((s, e) => s + (e.net_pay || 0), 0);
    return {
      totalGross,
      totalDeductions,
      totalNet,
      count: entries.length,
    };
  }, [entries]);

  // ── Create Period ──
  const openCreateModal = () => {
    setPeriodForm({ dateFrom: "", dateTo: "", payDate: "", label: "" });
    setShowCreateModal(true);
  };

  const quickCreate = (which: "first" | "second") => {
    const { from, to, payDate } = getSemiMonthlyDates(which);
    setPeriodForm({
      dateFrom: from,
      dateTo: to,
      payDate,
      label: periodLabel(from, to),
    });
    setShowCreateModal(true);
  };

  const handleCreatePeriod = async () => {
    if (!periodForm.dateFrom || !periodForm.dateTo) {
      showToast("Date from and date to are required", false);
      return;
    }
    setCreating(true);
    try {
      const body = {
        date_from: periodForm.dateFrom,
        date_to: periodForm.dateTo,
        pay_date: periodForm.payDate || null,
        label: periodForm.label || periodLabel(periodForm.dateFrom, periodForm.dateTo),
      };
      const created = await apiAdminPost<PayrollPeriod>("/payroll/periods", body);
      setShowCreateModal(false);
      showToast("Period created", true);
      setPeriods((prev) => [created, ...prev]);
      setSelectedPeriodId(created.id);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Failed to create period";
      showToast(err, false);
    } finally {
      setCreating(false);
    }
  };

  // ── Period Actions ──
  const handleCompute = async (periodId: number) => {
    setComputingId(periodId);
    try {
      const res = await apiAdminPost<{ period: PayrollPeriod; entries: PayrollEntry[] }>(
        `/payroll/periods/${periodId}/compute`,
        {}
      );
      setEntries(res.entries);
      setPeriods((prev) =>
        prev.map((p) => (p.id === periodId ? { ...p, status: res.period.status } : p))
      );
      showToast("Payroll computed", true);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Failed to compute payroll";
      showToast(err, false);
    } finally {
      setComputingId(null);
    }
  };

  const handleUpdateStatus = async (periodId: number, status: PayrollPeriodStatus) => {
    setUpdatingStatusId(periodId);
    try {
      const updated = await apiAdminPut<PayrollPeriod>(`/payroll/periods/${periodId}`, {
        status,
      });
      setPeriods((prev) => prev.map((p) => (p.id === periodId ? updated : p)));
      showToast(`Period marked as ${STATUS_LABELS[status]}`, true);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Failed to update status";
      showToast(err, false);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDeletePeriod = async (periodId: number) => {
    if (!window.confirm("Delete this payroll period? This cannot be undone.")) return;
    try {
      await apiAdminDelete<{ ok: boolean }>(`/payroll/periods/${periodId}`);
      setPeriods((prev) => prev.filter((p) => p.id !== periodId));
      if (selectedPeriodId === periodId) {
        setSelectedPeriodId(null);
        setEntries([]);
      }
      showToast("Period deleted", true);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Failed to delete period";
      showToast(err, false);
    }
  };

  // ── Staff Rates Inline Edit ──
  const startEditStaff = (s: StaffPayrollInfo) => {
    setEditingStaffId(s.id);
    setEditStaffForm({
      pay_basis: s.pay_basis,
      daily_rate: s.daily_rate,
      monthly_salary: s.monthly_salary,
      sss_number: s.sss_number,
      philhealth_number: s.philhealth_number,
      pagibig_number: s.pagibig_number,
      tin: s.tin,
      tax_status: s.tax_status,
    });
  };

  const cancelEditStaff = () => {
    setEditingStaffId(null);
    setEditStaffForm({});
  };

  const saveStaff = async (id: number) => {
    setSavingStaff(true);
    try {
      const body: Partial<StaffPayrollInfo> = {
        pay_basis: editStaffForm.pay_basis,
        daily_rate: editStaffForm.daily_rate != null ? Number(editStaffForm.daily_rate) : null,
        monthly_salary: editStaffForm.monthly_salary != null ? Number(editStaffForm.monthly_salary) : null,
        sss_number: editStaffForm.sss_number || null,
        philhealth_number: editStaffForm.philhealth_number || null,
        pagibig_number: editStaffForm.pagibig_number || null,
        tin: editStaffForm.tin || null,
        tax_status: editStaffForm.tax_status || null,
      };
      await apiAdminPut<StaffPayrollInfo>(`/payroll/staff/${id}`, body);
      showToast("Staff rate updated", true);
      setEditingStaffId(null);
      loadStaffRates();
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Failed to save staff rate";
      showToast(err, false);
    } finally {
      setSavingStaff(false);
    }
  };

  // ── Render helpers ──
  const header = (
    <div className="glass-panel flex items-center justify-between px-5 py-3.5 border-b border-erl-accent/10 flex-shrink-0 rounded-none">
      <div>
        <h2 className="font-display text-base font-bold text-erl-text-primary tracking-wide">
          Payroll
        </h2>
        <div className="text-[11px] text-erl-text-muted mt-0.5">
          Manage semi-monthly payroll periods and staff rates
        </div>
      </div>
      <div className="flex items-center gap-2">
        {activeTab === "overview" && (
          <button onClick={openCreateModal} className="btn btn-accent text-[11px] px-4 py-2 tracking-wide">
            + Create Period
          </button>
        )}
      </div>
    </div>
  );

  const tabs = (
    <div className="flex gap-1.5 px-4 py-3 border-b border-erl-border-default flex-shrink-0">
      {(
        [
          ["overview", "Overview"],
          ["staff-rates", "Staff Rates"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`px-5 py-[7px] rounded-lg text-[9px] font-bold tracking-wide cursor-pointer uppercase
            ${activeTab === key ? "border-[1.5px] border-erl-accent bg-erl-accent/15 text-erl-accent" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-secondary"}
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {header}
      {tabs}

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Period selector + quick actions */}
          <div className="px-5 py-3 border-b border-erl-border-subtle flex items-center gap-3 flex-shrink-0 flex-wrap">
            <div className="text-[9px] text-erl-muted tracking-wide uppercase font-bold">Period:</div>
            <select
              value={selectedPeriodId ?? ""}
              onChange={(e) => setSelectedPeriodId(Number(e.target.value) || null)}
              className="text-[10px] bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary outline-none cursor-pointer min-w-[180px]"
            >
              {periods.length === 0 && <option value="">No periods</option>}
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label || periodLabel(p.date_from, p.date_to)} ({STATUS_LABELS[p.status]})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => quickCreate("first")}
                className="px-2.5 py-1 text-[8px] rounded-md cursor-pointer border border-erl-border-subtle bg-transparent text-erl-muted font-normal hover:border-erl-accent hover:text-erl-accent"
              >
                Current 1st Half
              </button>
              <button
                onClick={() => quickCreate("second")}
                className="px-2.5 py-1 text-[8px] rounded-md cursor-pointer border border-erl-border-subtle bg-transparent text-erl-muted font-normal hover:border-erl-accent hover:text-erl-accent"
              >
                Current 2nd Half
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-5 mt-3 px-4 py-2.5 bg-erl-danger-bg border border-erl-danger-border rounded-xl text-[12px] text-erl-danger flex-shrink-0">
              {error}
            </div>
          )}

          {/* Summary stats */}
          {selectedPeriod && (
            <div className="grid grid-cols-4 gap-2.5 px-5 py-3 flex-shrink-0">
              {[
                { label: "Total Gross Pay", value: formatCurrency(summary.totalGross), color: "text-erl-accent" },
                { label: "Total Deductions", value: formatCurrency(summary.totalDeductions), color: "text-erl-danger" },
                { label: "Total Net Pay", value: formatCurrency(summary.totalNet), color: "text-erl-success" },
                { label: "Employees", value: String(summary.count), color: "text-erl-text-primary" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-accent/8 border-erl-accent/20">
                  <div>
                    <div className="text-[10px] text-erl-text-muted tracking-wide uppercase font-semibold">{label}</div>
                    <div className={`text-[15px] font-bold mt-0.5 tabular-nums font-display ${color}`}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Period actions */}
          {selectedPeriod && (
            <div className="px-5 pb-3 flex items-center gap-2 flex-shrink-0">
              <span className={`pill text-[10px] ${STATUS_COLORS[selectedPeriod.status]}`}>
                {STATUS_LABELS[selectedPeriod.status]}
              </span>
              <span className="text-[11px] text-erl-text-faint">
                {new Date(selectedPeriod.date_from).toLocaleDateString("en-PH")} – {new Date(selectedPeriod.date_to).toLocaleDateString("en-PH")}
                {selectedPeriod.pay_date && (
                  <span> · Pay date: {new Date(selectedPeriod.pay_date).toLocaleDateString("en-PH")}</span>
                )}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {selectedPeriod.status === "open" && (
                  <button
                    onClick={() => handleCompute(selectedPeriod.id)}
                    disabled={computingId === selectedPeriod.id}
                    className="btn btn-accent text-[10px] px-3 py-2"
                  >
                    {computingId === selectedPeriod.id ? "Computing..." : "Compute Payroll"}
                  </button>
                )}
                {selectedPeriod.status === "computed" && (
                  <button
                    onClick={() => handleUpdateStatus(selectedPeriod.id, "approved")}
                    disabled={updatingStatusId === selectedPeriod.id}
                    className="btn btn-success text-[10px] px-3 py-2"
                  >
                    {updatingStatusId === selectedPeriod.id ? "Saving..." : "Approve"}
                  </button>
                )}
                {selectedPeriod.status === "approved" && (
                  <button
                    onClick={() => handleUpdateStatus(selectedPeriod.id, "paid")}
                    disabled={updatingStatusId === selectedPeriod.id}
                    className="btn btn-accent text-[10px] px-3 py-2"
                  >
                    {updatingStatusId === selectedPeriod.id ? "Saving..." : "Mark Paid"}
                  </button>
                )}
                <button
                  onClick={() => handleDeletePeriod(selectedPeriod.id)}
                  className="btn btn-danger text-[10px] px-3 py-2"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Entries table */}
          <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5">
            {loadingPeriods || loadingEntries ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="animate-shimmer w-28 h-4 rounded-md" />
                <div className="animate-shimmer w-20 h-3 rounded-md" />
              </div>
            ) : !selectedPeriod ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <div className="text-[13px] text-erl-text-disabled">No payroll periods yet</div>
                <button onClick={openCreateModal} className="btn btn-accent text-[11px] px-4 py-2 mt-2">
                  Create your first period
                </button>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <div className="text-[13px] text-erl-text-disabled">No entries for this period</div>
                {selectedPeriod.status === "open" && (
                  <button onClick={() => handleCompute(selectedPeriod.id)} className="btn btn-accent text-[11px] px-4 py-2 mt-2">
                    Compute Payroll
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-erl-surface/60 rounded-xl overflow-hidden border border-erl-border-subtle">
                <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-erl-elevated sticky top-0 z-10">
                        <th className="px-3 py-2 text-left text-erl-muted font-semibold">Staff</th>
                        <th className="px-3 py-2 text-left text-erl-muted font-semibold">Role</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Hrs</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Reg</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">OT</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Basic</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">OT Pay</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Gross</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">SSS</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">PhilHealth</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Pag-IBIG</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">WHT</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Deductions</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => setSelectedEntry(e)}
                          className="border-t border-erl-border-subtle hover:bg-erl-accent/5 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 text-erl-text-primary font-medium whitespace-nowrap">
                            <span
                              className="inline-block w-5 h-5 rounded-full text-[8px] font-bold text-white text-center leading-5 mr-2"
                              style={{ background: e.color || "#888" }}
                            >
                              {e.initials || "?"}
                            </span>
                            {e.name || `Staff #${e.staff_id}`}
                          </td>
                          <td className="px-3 py-2 text-erl-muted">{e.role || "—"}</td>
                          <td className="px-3 py-2 text-right text-erl-text-primary tabular-nums">
                            {(e.total_hours || 0).toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-muted tabular-nums">
                            {(e.regular_hours || 0).toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-muted tabular-nums">
                            {(e.overtime_hours || 0).toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-text-primary tabular-nums">
                            {formatCurrency(e.basic_pay || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-muted tabular-nums">
                            {formatCurrency(e.overtime_pay || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-accent font-semibold tabular-nums">
                            {formatCurrency(e.gross_pay || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-danger tabular-nums">
                            {formatCurrency(e.sss_employee || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-danger tabular-nums">
                            {formatCurrency(e.philhealth_employee || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-danger tabular-nums">
                            {formatCurrency(e.pagibig_employee || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-danger tabular-nums">
                            {formatCurrency(e.withholding_tax || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-danger font-semibold tabular-nums">
                            {formatCurrency(e.total_deductions || 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-success font-bold tabular-nums">
                            {formatCurrency(e.net_pay || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Staff Rates Tab ── */}
      {activeTab === "staff-rates" && (
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
          {loadingStaff ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="animate-shimmer w-28 h-4 rounded-md" />
              <div className="animate-shimmer w-20 h-3 rounded-md" />
            </div>
          ) : staffList.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2">
              <div className="text-[13px] text-erl-text-disabled">No staff found</div>
            </div>
          ) : (
            <div className="bg-erl-surface/60 rounded-xl overflow-hidden border border-erl-border-subtle">
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-erl-elevated sticky top-0 z-10">
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">Staff</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">Role</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">Pay Basis</th>
                      <th className="px-3 py-2 text-right text-erl-muted font-semibold">Daily Rate</th>
                      <th className="px-3 py-2 text-right text-erl-muted font-semibold">Monthly Salary</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">TIN</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">SSS #</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">PhilHealth #</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">Pag-IBIG #</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">Tax Status</th>
                      <th className="px-3 py-2 text-center text-erl-muted font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((s) => (
                      <tr key={s.id} className="border-t border-erl-border-subtle">
                        <td className="px-3 py-2 text-erl-text-primary font-medium whitespace-nowrap">
                          <span
                            className="inline-block w-5 h-5 rounded-full text-[8px] font-bold text-white text-center leading-5 mr-2"
                            style={{ background: s.color || "#888" }}
                          >
                            {s.initials || "?"}
                          </span>
                          {s.name}
                        </td>
                        <td className="px-3 py-2 text-erl-muted">{s.role}</td>
                        {editingStaffId === s.id ? (
                          <>
                            <td className="px-3 py-2">
                              <select
                                value={editStaffForm.pay_basis || ""}
                                onChange={(ev) =>
                                  setEditStaffForm((prev) => ({
                                    ...prev,
                                    pay_basis: (ev.target.value as PayBasis) || null,
                                  }))
                                }
                                className="w-full bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary text-[10px] outline-none"
                              >
                                <option value="">—</option>
                                {PAY_BASIS_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={editStaffForm.daily_rate ?? ""}
                                onChange={(ev) =>
                                  setEditStaffForm((prev) => ({
                                    ...prev,
                                    daily_rate: ev.target.value === "" ? null : Number(ev.target.value),
                                  }))
                                }
                                placeholder="0.00"
                                className="w-full bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary text-[10px] outline-none text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={editStaffForm.monthly_salary ?? ""}
                                onChange={(ev) =>
                                  setEditStaffForm((prev) => ({
                                    ...prev,
                                    monthly_salary: ev.target.value === "" ? null : Number(ev.target.value),
                                  }))
                                }
                                placeholder="0.00"
                                className="w-full bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary text-[10px] outline-none text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={editStaffForm.tin ?? ""}
                                onChange={(ev) =>
                                  setEditStaffForm((prev) => ({ ...prev, tin: ev.target.value }))
                                }
                                placeholder="TIN"
                                className="w-full bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary text-[10px] outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={editStaffForm.sss_number ?? ""}
                                onChange={(ev) =>
                                  setEditStaffForm((prev) => ({ ...prev, sss_number: ev.target.value }))
                                }
                                placeholder="SSS #"
                                className="w-full bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary text-[10px] outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={editStaffForm.philhealth_number ?? ""}
                                onChange={(ev) =>
                                  setEditStaffForm((prev) => ({
                                    ...prev,
                                    philhealth_number: ev.target.value,
                                  }))
                                }
                                placeholder="PhilHealth #"
                                className="w-full bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary text-[10px] outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={editStaffForm.pagibig_number ?? ""}
                                onChange={(ev) =>
                                  setEditStaffForm((prev) => ({
                                    ...prev,
                                    pagibig_number: ev.target.value,
                                  }))
                                }
                                placeholder="Pag-IBIG #"
                                className="w-full bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary text-[10px] outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={editStaffForm.tax_status || ""}
                                onChange={(ev) =>
                                  setEditStaffForm((prev) => ({
                                    ...prev,
                                    tax_status: (ev.target.value as TaxStatus) || null,
                                  }))
                                }
                                className="w-full bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary text-[10px] outline-none"
                              >
                                <option value="">—</option>
                                {TAX_STATUS_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => saveStaff(s.id)}
                                  disabled={savingStaff}
                                  className="btn btn-accent text-[9px] px-2 py-1"
                                >
                                  {savingStaff ? "..." : "Save"}
                                </button>
                                <button
                                  onClick={cancelEditStaff}
                                  className="btn btn-ghost text-[9px] px-2 py-1"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-erl-muted capitalize">{s.pay_basis || "—"}</td>
                            <td className="px-3 py-2 text-right text-erl-text-primary tabular-nums">
                              {s.daily_rate != null ? formatCurrency(s.daily_rate) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-erl-text-primary tabular-nums">
                              {s.monthly_salary != null ? formatCurrency(s.monthly_salary) : "—"}
                            </td>
                            <td className="px-3 py-2 text-erl-muted font-mono">{s.tin || "—"}</td>
                            <td className="px-3 py-2 text-erl-muted font-mono">{s.sss_number || "—"}</td>
                            <td className="px-3 py-2 text-erl-muted font-mono">{s.philhealth_number || "—"}</td>
                            <td className="px-3 py-2 text-erl-muted font-mono">{s.pagibig_number || "—"}</td>
                            <td className="px-3 py-2 text-erl-muted capitalize">{s.tax_status || "—"}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => startEditStaff(s)}
                                className="text-[10px] text-erl-text-faint hover:text-erl-accent transition-colors tracking-wide font-semibold uppercase"
                              >
                                Edit
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create Period Modal ── */}
      {showCreateModal && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-6 w-full max-w-[420px]">
              <div className="font-display text-sm font-bold text-erl-text-primary mb-4">
                Create Payroll Period
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] font-bold uppercase">
                    Date From
                  </div>
                  <input
                    type="date"
                    value={periodForm.dateFrom}
                    onChange={(e) =>
                      setPeriodForm((p) => ({
                        ...p,
                        dateFrom: e.target.value,
                        label: periodLabel(e.target.value, p.dateTo || e.target.value),
                      }))
                    }
                    className="w-full text-erl-text-primary text-[11px]"
                  />
                </div>
                <div>
                  <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] font-bold uppercase">
                    Date To
                  </div>
                  <input
                    type="date"
                    value={periodForm.dateTo}
                    onChange={(e) =>
                      setPeriodForm((p) => ({
                        ...p,
                        dateTo: e.target.value,
                        label: periodLabel(p.dateFrom || e.target.value, e.target.value),
                      }))
                    }
                    className="w-full text-erl-text-primary text-[11px]"
                  />
                </div>
              </div>

              <div className="mb-3">
                <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] font-bold uppercase">
                  Pay Date
                </div>
                <input
                  type="date"
                  value={periodForm.payDate}
                  onChange={(e) => setPeriodForm((p) => ({ ...p, payDate: e.target.value }))}
                  className="w-full text-erl-text-primary text-[11px]"
                />
              </div>

              <div className="mb-5">
                <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] font-bold uppercase">
                  Label
                </div>
                <input
                  value={periodForm.label}
                  onChange={(e) => setPeriodForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. May 1st Half 2026"
                  className="w-full text-erl-text-primary text-[11px]"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowCreateModal(false)} className="btn btn-outline flex-1 text-[10px] py-2.5">
                  Cancel
                </button>
                <button
                  onClick={handleCreatePeriod}
                  disabled={creating || !periodForm.dateFrom || !periodForm.dateTo}
                  className="btn btn-accent flex-1 text-[10px] py-2.5"
                >
                  {creating ? "Creating..." : "Create Period"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Payslip Modal ── */}
      {selectedEntry && selectedPeriod && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setSelectedEntry(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-6 w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-display text-sm font-bold text-erl-text-primary">
                    Payslip
                  </div>
                  <div className="text-[11px] text-erl-text-muted mt-0.5">
                    {selectedEntry.name || `Staff #${selectedEntry.staff_id}`} · {selectedPeriod.label || periodLabel(selectedPeriod.date_from, selectedPeriod.date_to)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-[10px] text-erl-text-faint hover:text-erl-accent transition-colors"
                >
                  Close
                </button>
              </div>

              {/* Pay date */}
              {selectedPeriod.pay_date && (
                <div className="rounded-xl px-4 py-2.5 border bg-erl-accent/8 border-erl-accent/20 mb-4">
                  <div className="text-[10px] text-erl-text-muted tracking-wide uppercase font-semibold">Pay Date</div>
                  <div className="text-[13px] font-bold text-erl-text-primary">
                    {new Date(selectedPeriod.pay_date).toLocaleDateString("en-PH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>
              )}

              {/* Earnings */}
              <div className="mb-4">
                <div className="text-[9px] text-erl-accent-muted tracking-widest uppercase font-bold mb-2">
                  Earnings
                </div>
                <div className="bg-erl-surface/60 rounded-xl border border-erl-border-subtle overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Basic Pay</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.basic_pay || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Overtime Pay</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.overtime_pay || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Holiday Pay</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.holiday_pay || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Night Differential</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.night_differential_pay || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Rest Day Pay</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.rest_day_pay || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Allowances</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.allowances || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-[11px] text-erl-text-secondary">Bonuses</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.bonuses || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 bg-erl-accent/8 border-t border-erl-accent/20">
                    <span className="text-[11px] font-bold text-erl-text-primary uppercase tracking-wide">Gross Pay</span>
                    <span className="text-[13px] font-bold text-erl-accent tabular-nums">{formatCurrency(selectedEntry.gross_pay || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="mb-4">
                <div className="text-[9px] text-erl-accent-muted tracking-widest uppercase font-bold mb-2">
                  Deductions
                </div>
                <div className="bg-erl-surface/60 rounded-xl border border-erl-border-subtle overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">SSS</span>
                    <span className="text-[11px] text-erl-danger tabular-nums">{formatCurrency(selectedEntry.sss_employee || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">PhilHealth</span>
                    <span className="text-[11px] text-erl-danger tabular-nums">{formatCurrency(selectedEntry.philhealth_employee || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Pag-IBIG</span>
                    <span className="text-[11px] text-erl-danger tabular-nums">{formatCurrency(selectedEntry.pagibig_employee || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Withholding Tax</span>
                    <span className="text-[11px] text-erl-danger tabular-nums">{formatCurrency(selectedEntry.withholding_tax || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">Absences</span>
                    <span className="text-[11px] text-erl-danger tabular-nums">{formatCurrency(selectedEntry.absence_deductions || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-[11px] text-erl-text-secondary">Other Deductions</span>
                    <span className="text-[11px] text-erl-danger tabular-nums">{formatCurrency(selectedEntry.other_deductions || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 bg-erl-danger/5 border-t border-erl-danger/20">
                    <span className="text-[11px] font-bold text-erl-text-primary uppercase tracking-wide">Total Deductions</span>
                    <span className="text-[13px] font-bold text-erl-danger tabular-nums">{formatCurrency(selectedEntry.total_deductions || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="rounded-xl px-5 py-4 border bg-erl-success/8 border-erl-success/20 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-erl-text-muted tracking-wide uppercase font-semibold">Net Pay</div>
                    <div className="text-[22px] font-bold text-erl-success font-display tabular-nums mt-1">
                      {formatCurrency(selectedEntry.net_pay || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Employer Contributions */}
              <div>
                <div className="text-[9px] text-erl-accent-muted tracking-widest uppercase font-bold mb-2">
                  Employer Contributions
                </div>
                <div className="bg-erl-surface/60 rounded-xl border border-erl-border-subtle overflow-hidden">
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">SSS (ER)</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.sss_employer || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-erl-border-subtle">
                    <span className="text-[11px] text-erl-text-secondary">PhilHealth (ER)</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.philhealth_employer || 0)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-[11px] text-erl-text-secondary">Pag-IBIG (ER)</span>
                    <span className="text-[11px] text-erl-text-primary tabular-nums">{formatCurrency(selectedEntry.pagibig_employer || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {msg && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-white px-6 py-3 rounded-2xl text-sm font-bold z-[9999] shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 ${msg.ok ? "bg-erl-success" : "bg-erl-danger"}`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
};
