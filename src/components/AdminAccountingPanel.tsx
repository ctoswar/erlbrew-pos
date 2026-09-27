import React, { useCallback, useEffect, useState } from "react";
import {
  AccountingProvider,
  AccountingReconcileResponse,
  AccountingReconcileStatus,
  AccountingStatus,
  AccountingSyncLogEntry,
  AccountingSyncResponse,
  AccountingSyncResult,
  AccountingSyncStatus,
  getAccountingStatus,
  getAccountingConnect,
  syncAccounting,
  reconcileAccounting,
  getAccountingSyncLog,
  disconnectAccounting,
} from "../utils/api";
import { formatCurrency } from "../utils";

/**
 * Accounting connection + sync controls (QuickBooks, Xero), rendered inside
 * the expanded provider card on the Integrations screen.
 *
 * Everything here works with no credentials: with nothing connected the sync
 * runs as a dry-run and returns the exact payloads that *would* be pushed, so
 * the mapping can be reviewed before any provider app exists. Which sections
 * render (invoice sync, bills, bank reconciliation) is driven by the
 * `features` array returned from GET /api/accounting/:provider/status.
 */

type SyncKind = "invoice" | "bill";

interface ProviderMeta {
  /** Display name used in buttons, confirmations and messages */
  label: string;
  /** Tooltip on the Connect button */
  connectHint: string;
  /** Shown while Client ID / Client Secret are missing */
  credsHint: string;
  /** Caption under the sync controls */
  syncHelp: string;
  /** Caption above the reconcile controls */
  reconcileHelp?: string;
  /** Server env var that forces dry-run (omitted → generic text) */
  dryRunEnv?: string;
}

const PROVIDER_META: Record<AccountingProvider, ProviderMeta> = {
  quickbooks: {
    label: "QuickBooks",
    connectHint: "Authorize with Intuit",
    credsHint:
      "Add Client ID and Client Secret above (from a QuickBooks app on the Intuit developer portal), enable the integration, then connect.",
    syncHelp:
      "Sales push as one summary invoice per day (auto-triggered after each Z-Report); expenses push one Bill per supplier invoice. Re-running a range never duplicates — already-synced days are skipped.",
    dryRunEnv: "QUICKBOOKS_DRY_RUN=1",
  },
  xero: {
    label: "Xero",
    connectHint: "Authorize with Xero",
    credsHint:
      "Add Client ID and Client Secret above (from a Xero app on the Xero developer portal), enable the integration, then connect.",
    syncHelp:
      "Sales push as one summary invoice per day (auto-triggered after each Z-Report). Re-running a range never duplicates — already-synced days are skipped.",
    reconcileHelp:
      "Match recorded cash/card drawer transactions against a bank statement feed — mock-first, nothing leaves the app until connected.",
  },
};

/** Fallback when the status payload has no `features` array. */
const DEFAULT_FEATURES: Record<AccountingProvider, string[]> = {
  quickbooks: ["invoice", "bill"],
  xero: ["invoice", "reconcile"],
};

const CHIP: Record<string, string> = {
  success: "bg-erl-success/15 text-erl-success",
  dry_run: "bg-erl-accent/15 text-erl-accent",
  skipped: "bg-white/10 text-erl-text-muted",
  failed: "bg-erl-danger/15 text-erl-danger",
};

const RECONCILE_CHIP: Record<AccountingReconcileStatus, string> = {
  matched: "bg-erl-success/15 text-erl-success",
  unmatched: "bg-erl-danger/15 text-erl-danger",
};

const KIND_LABEL: Record<SyncKind, string> = {
  invoice: "Sales invoices (daily summary)",
  bill: "Expenses (supplier invoices → Bills)",
};

const SYNC_TYPE_LABEL: Record<string, string> = {
  invoice: "Sales",
  bill: "Expense",
  reconcile: "Reconcile",
};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const chipClass = (status: string) =>
  `text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${CHIP[status] || "bg-white/10 text-erl-text-muted"}`;

const reconcileChipClass = (status: AccountingReconcileStatus) =>
  `text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${RECONCILE_CHIP[status]}`;

/** Derive counts from the result rows (server `counts` is optional). */
function tallySync(results: AccountingSyncResult[]): Record<AccountingSyncStatus, number> {
  const counts: Record<AccountingSyncStatus, number> = { success: 0, dry_run: 0, skipped: 0, failed: 0 };
  for (const r of results) {
    if (r.status in counts) counts[r.status] += 1;
  }
  return counts;
}

interface SyncRun {
  kind: SyncKind;
  response: AccountingSyncResponse;
  counts: Record<AccountingSyncStatus, number>;
}

export interface AdminAccountingPanelProps {
  provider: AccountingProvider;
}

export const AdminAccountingPanel: React.FC<AdminAccountingPanelProps> = ({ provider }) => {
  const meta = PROVIDER_META[provider];

  const [status, setStatus] = useState<AccountingStatus | null>(null);
  const [log, setLog] = useState<AccountingSyncLogEntry[]>([]);
  const [busy, setBusy] = useState<"connect" | "sync" | "reconcile" | "disconnect" | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [syncRun, setSyncRun] = useState<SyncRun | null>(null);
  const [reconcileResult, setReconcileResult] = useState<AccountingReconcileResponse | null>(null);

  const [kind, setKind] = useState<SyncKind>("invoice");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [dryRun, setDryRun] = useState(false);
  const [openPayload, setOpenPayload] = useState<string | null>(null);

  const [recStart, setRecStart] = useState(todayISO());
  const [recEnd, setRecEnd] = useState(todayISO());
  const [recDryRun, setRecDryRun] = useState(false);
  const [showRecPayload, setShowRecPayload] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        getAccountingStatus(provider),
        getAccountingSyncLog(provider, 10),
      ]);
      setStatus(s);
      setLog(l);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : `Failed to load ${meta.label} status`, type: "error" });
    }
  }, [provider, meta.label]);

  useEffect(() => { load(); }, [load]);

  // Coming back from the provider redirect — surface the result, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("accounting") !== provider) return;
    const result = params.get("result");
    const message = params.get("message");
    if (result === "connected") setMsg({ text: `${meta.label} connected — tokens stored`, type: "success" });
    else if (result === "error") setMsg({ text: message || `${meta.label} connection failed`, type: "error" });
    params.delete("accounting");
    params.delete("result");
    params.delete("message");
    params.delete("company");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    load();
  }, [load, provider, meta.label]);

  const handleConnect = async () => {
    setBusy("connect");
    setMsg(null);
    try {
      const { url } = await getAccountingConnect(provider);
      window.location.href = url;
      return; // page navigates away to the provider
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Connect failed", type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(`Disconnect ${meta.label}? Stored OAuth tokens will be deleted.`)) return;
    setBusy("disconnect");
    setMsg(null);
    try {
      setStatus(await disconnectAccounting(provider));
      setSyncRun(null);
      setReconcileResult(null);
      setMsg({ text: `${meta.label} disconnected`, type: "success" });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Disconnect failed", type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    setMsg(null);
    setSyncRun(null);
    const runKind = activeKind;
    try {
      const response = await syncAccounting(provider, { kind: runKind, start, end: end || start, dryRun });
      const counts = response.counts ?? tallySync(response.results);
      setSyncRun({ kind: runKind, response, counts });
      if (counts.failed > 0) {
        setMsg({ text: `${counts.failed} period(s) failed — see list below`, type: "error" });
      } else if (response.live) {
        setMsg({ text: `Synced ${counts.success} of ${response.results.length}`, type: "success" });
      } else {
        setMsg({ text: `Dry-run complete — ${counts.dry_run} payload(s) prepared, nothing sent`, type: "success" });
      }
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Sync failed", type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleReconcile = async () => {
    setBusy("reconcile");
    setMsg(null);
    setReconcileResult(null);
    setShowRecPayload(false);
    try {
      const r = await reconcileAccounting(provider, {
        start: recStart,
        end: recEnd || recStart,
        dryRun: recDryRun,
      });
      setReconcileResult(r);
      const summary = `${r.matched} matched, ${r.unmatched} unmatched`;
      if (!r.live) {
        setMsg({ text: `Reconciliation dry-run complete — ${summary}, nothing sent`, type: "success" });
      } else if (r.unmatched > 0) {
        setMsg({ text: `Reconciled — ${summary} — review the unmatched rows below`, type: "error" });
      } else {
        setMsg({ text: `Reconciled — ${summary}`, type: "success" });
      }
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Reconciliation failed", type: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (!status) return <div className="px-3 pb-3 text-[10px] text-erl-text-muted">Loading connection status…</div>;

  const features = status.features?.length ? status.features : DEFAULT_FEATURES[provider];
  const syncKinds = (["invoice", "bill"] as const).filter(k => features.includes(k));
  const activeKind: SyncKind = syncKinds.includes(kind) ? kind : syncKinds[0] ?? "invoice";
  const canReconcile = features.includes("reconcile");

  const connected = status.connected;
  const canSync = !!start && !!end && busy === null;
  const canReconcileRun = !!recStart && !!recEnd && busy === null;
  const orgId = status.tenantId ?? status.realmId;
  const environment = status.environment ?? status.mode ?? "";
  const expiresAt = status.expiresAt ?? status.tokenExpiresAt;

  return (
    <div className="pt-3 mt-2 border-t border-erl-border-subtle">
      {/* ── Connection ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${connected ? "bg-erl-success/20 text-erl-success" : "bg-white/10 text-erl-text-muted"}`}>
          {connected ? "CONNECTED" : "NOT CONNECTED"}
        </span>
        {connected && (
          <span className="text-[9px] text-erl-text-muted">
            {orgId ? `${provider === "xero" ? "tenant" : "company"} ${orgId}` : meta.label}
            {environment ? ` · ${environment}` : ""}
            {expiresAt ? ` · token ${new Date(expiresAt).toLocaleString()}` : ""}
          </span>
        )}
        {!connected && status.dryRunForced && (
          <span className="text-[9px] text-erl-accent">{meta.dryRunEnv ?? "DRY-RUN FORCED"}</span>
        )}
        <div className="ml-auto flex gap-2">
          {connected ? (
            <button
              onClick={handleDisconnect}
              disabled={busy !== null}
              className="px-2 py-1 text-[10px] font-semibold rounded-md border border-erl-border-default text-erl-text-secondary hover:bg-white/[0.06] disabled:opacity-40"
            >
              {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={busy !== null || !status.clientIdConfigured}
              title={status.clientIdConfigured ? meta.connectHint : "Save Client ID and Client Secret first"}
              className="px-2 py-1 text-[10px] font-semibold rounded-md bg-erl-accent text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy === "connect" ? "Redirecting…" : `Connect to ${meta.label}`}
            </button>
          )}
        </div>
      </div>

      {!status.clientIdConfigured && (
        <p className="text-[10px] text-erl-text-muted mb-2">{meta.credsHint}</p>
      )}

      {msg && (
        <div className={`mb-2 text-[10px] font-semibold ${msg.type === "success" ? "text-erl-success" : "text-erl-danger"}`}>
          {msg.text}
        </div>
      )}

      {/* ── Sync controls ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
        <div>
          <label className="block text-[9px] uppercase tracking-wider text-erl-text-muted mb-0.5">What to sync</label>
          <select
            value={activeKind}
            onChange={e => setKind(e.target.value as SyncKind)}
            className="w-full px-2 py-1 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
          >
            {syncKinds.map(k => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] uppercase tracking-wider text-erl-text-muted mb-0.5">From</label>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="w-full px-2 py-1 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
          />
        </div>
        <div>
          <label className="block text-[9px] uppercase tracking-wider text-erl-text-muted mb-0.5">To</label>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="w-full px-2 py-1 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
          />
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-erl-text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dryRun || !connected}
              onChange={e => setDryRun(e.target.checked)}
              disabled={!connected}
            />
            Dry-run
          </label>
          <button
            onClick={handleSync}
            disabled={!canSync}
            className="flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md bg-erl-accent text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy === "sync" ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      <p className="text-[9px] text-erl-text-faint mt-1.5">
        {meta.syncHelp}
        {!connected && " Connect to send; until then every sync is a dry-run that only shows the payload."}
      </p>

      {/* ── Sync results ───────────────────────────────────── */}
      {syncRun && (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-erl-border-subtle p-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold text-erl-text-primary">
              {KIND_LABEL[syncRun.kind]} — {syncRun.response.live ? `sent to ${meta.label}` : "dry-run"}
            </span>
            <span className="text-[9px] text-erl-text-muted">
              {syncRun.counts.success} sent · {syncRun.counts.dry_run} dry-run · {syncRun.counts.skipped} skipped · {syncRun.counts.failed} failed
            </span>
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {syncRun.response.results.map(r => (
              <div key={`${syncRun.kind}-${r.period}`} className="text-[10px] flex items-start gap-2">
                <span className="font-mono text-erl-text-secondary shrink-0">{r.period}</span>
                <span className={chipClass(r.status)}>{r.status.replace("_", "-")}</span>
                <span className="text-erl-text-muted truncate">
                  {r.error || r.reason || (r.docNumber ? `doc ${r.docNumber}` : r.externalId ? `id ${r.externalId}` : "")}
                </span>
                {Boolean(r.payload) && (
                  <button
                    onClick={() => setOpenPayload(openPayload === r.period ? null : r.period)}
                    className="ml-auto text-[9px] text-erl-accent hover:underline shrink-0"
                  >
                    {openPayload === r.period ? "hide payload" : "view payload"}
                  </button>
                )}
              </div>
            ))}
            {openPayload && (
              <pre className="text-[9px] font-mono text-erl-text-secondary bg-erl-surface border border-erl-border-subtle rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(syncRun.response.results.find(r => r.period === openPayload)?.payload, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ── Bank reconciliation (feature-flagged — Xero) ───── */}
      {canReconcile && (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-erl-border-subtle p-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold text-erl-text-primary">Bank reconciliation</span>
            <span className="text-[9px] text-erl-text-muted">{meta.reconcileHelp}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-erl-text-muted mb-0.5">From</label>
              <input
                type="date"
                value={recStart}
                onChange={e => setRecStart(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-erl-text-muted mb-0.5">To</label>
              <input
                type="date"
                value={recEnd}
                onChange={e => setRecEnd(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
              />
            </div>
            <div className="flex gap-2">
              <label className="flex items-center gap-1.5 text-[10px] text-erl-text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recDryRun || !connected}
                  onChange={e => setRecDryRun(e.target.checked)}
                  disabled={!connected}
                />
                Dry-run
              </label>
              <button
                onClick={handleReconcile}
                disabled={!canReconcileRun}
                className="flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md bg-erl-accent text-white hover:opacity-90 disabled:opacity-40"
              >
                {busy === "reconcile" ? "Reconciling…" : "Run reconciliation"}
              </button>
            </div>
          </div>

          <p className="text-[9px] text-erl-text-faint mt-1.5">
            Matches recorded cash/card drawer transactions against a bank statement feed for the selected range;
            variances are listed per row.
            {!connected && " Connect to send; until then every run is a dry-run that only shows the result."}
          </p>

          {reconcileResult && (
            <div className="mt-2 pt-2 border-t border-erl-border-subtle">
              <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[10px]">
                <span className="text-erl-success font-semibold">{reconcileResult.matched} matched</span>
                <span className="text-erl-danger font-semibold">{reconcileResult.unmatched} unmatched</span>
                <span className="text-erl-text-muted">
                  variance{" "}
                  <span className="font-semibold text-erl-text-primary">{formatCurrency(reconcileResult.variance)}</span>
                </span>
                <span className="text-[9px] text-erl-text-muted">
                  {reconcileResult.live ? `sent to ${meta.label}` : "dry-run"}
                </span>
                {Boolean(reconcileResult.payload) && (
                  <button
                    onClick={() => setShowRecPayload(v => !v)}
                    className="ml-auto text-[9px] text-erl-accent hover:underline shrink-0"
                  >
                    {showRecPayload ? "hide payload" : "view payload"}
                  </button>
                )}
              </div>

              {reconcileResult.results.length === 0 ? (
                <p className="text-[10px] text-erl-text-muted">No transactions in this range.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wider text-erl-text-muted">
                        <th className="py-1 pr-2 text-left font-semibold">Date</th>
                        <th className="py-1 pr-2 text-left font-semibold">Description</th>
                        <th className="py-1 pr-2 text-right font-semibold">Amount</th>
                        <th className="py-1 pr-2 text-left font-semibold">Status</th>
                        <th className="py-1 text-left font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconcileResult.results.map((r, i) => (
                        <tr
                          key={`${r.date}-${r.drawerTransactionId ?? r.orderId ?? "row"}-${i}`}
                          className="border-t border-erl-border-subtle align-top"
                        >
                          <td className="py-1 pr-2 font-mono text-erl-text-secondary whitespace-nowrap">{r.date}</td>
                          <td className="py-1 pr-2 text-erl-text-primary max-w-[12rem] truncate">{r.description}</td>
                          <td className="py-1 pr-2 text-right font-mono text-erl-text-secondary whitespace-nowrap">
                            {formatCurrency(r.amount)}
                          </td>
                          <td className="py-1 pr-2">
                            <span className={reconcileChipClass(r.status)}>{r.status}</span>
                          </td>
                          <td className="py-1 text-erl-text-muted">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showRecPayload && (
                <pre className="mt-1.5 text-[9px] font-mono text-erl-text-secondary bg-erl-surface border border-erl-border-subtle rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(reconcileResult.payload, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Recent sync log ────────────────────────────────── */}
      {log.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] uppercase tracking-wider text-erl-text-muted mb-1">Recent syncs</div>
          <div className="space-y-1">
            {log.map(row => (
              <div key={row.id} className="text-[10px] flex items-center gap-2">
                <span className={chipClass(row.status)}>{row.status.replace("_", "-")}</span>
                <span className="text-erl-text-secondary">{SYNC_TYPE_LABEL[row.type] ?? row.type}</span>
                <span className="font-mono text-erl-text-muted">{row.period}</span>
                <span className="text-erl-text-muted truncate">
                  {row.error || (row.summary && row.summary.total != null ? `${row.summary.total.toFixed(2)}` : "")}
                </span>
                <span className="ml-auto text-[9px] text-erl-text-faint shrink-0">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
