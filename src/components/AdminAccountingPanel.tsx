import React, { useCallback, useEffect, useState } from "react";
import {
  AccountingStatus,
  AccountingSyncLogEntry,
  AccountingSyncResponse,
  getAccountingStatus,
  getAccountingConnect,
  syncAccounting,
  getAccountingSyncLog,
  disconnectAccounting,
} from "../utils/api";

/**
 * QuickBooks connection + sync controls, rendered inside the expanded
 * QuickBooks card on the Integrations screen.
 *
 * Everything here works with no credentials: with nothing connected the sync
 * runs as a dry-run and returns the exact payloads that *would* be pushed, so
 * the mapping can be reviewed before an Intuit app exists.
 */

const PROVIDER = "quickbooks";

const CHIP: Record<string, string> = {
  success: "bg-erl-success/15 text-erl-success",
  dry_run: "bg-erl-accent/15 text-erl-accent",
  skipped: "bg-white/10 text-erl-text-muted",
  failed: "bg-erl-danger/15 text-erl-danger",
};

const KIND_LABEL: Record<"invoice" | "bill", string> = {
  invoice: "Sales invoices (daily summary)",
  bill: "Expenses (supplier invoices → Bills)",
};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const chipClass = (status: string) =>
  `text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${CHIP[status] || "bg-white/10 text-erl-text-muted"}`;

export const AdminAccountingPanel: React.FC = () => {
  const [status, setStatus] = useState<AccountingStatus | null>(null);
  const [log, setLog] = useState<AccountingSyncLogEntry[]>([]);
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [result, setResult] = useState<AccountingSyncResponse | null>(null);

  const [kind, setKind] = useState<"invoice" | "bill">("invoice");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [dryRun, setDryRun] = useState(false);
  const [openPayload, setOpenPayload] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        getAccountingStatus(PROVIDER),
        getAccountingSyncLog(PROVIDER, 10),
      ]);
      setStatus(s);
      setLog(l);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to load QuickBooks status", type: "error" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Coming back from the Intuit redirect — surface the result, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("accounting") !== PROVIDER) return;
    const result = params.get("result");
    const message = params.get("message");
    if (result === "connected") setMsg({ text: "QuickBooks connected — tokens stored", type: "success" });
    else if (result === "error") setMsg({ text: message || "QuickBooks connection failed", type: "error" });
    params.delete("accounting");
    params.delete("result");
    params.delete("message");
    params.delete("company");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    load();
  }, [load]);

  const handleConnect = async () => {
    setBusy("connect");
    setMsg(null);
    try {
      const { url } = await getAccountingConnect(PROVIDER);
      window.location.href = url;
      return; // page navigates away to Intuit
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Connect failed", type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect QuickBooks? Stored OAuth tokens will be deleted.")) return;
    setBusy("disconnect");
    setMsg(null);
    try {
      setStatus(await disconnectAccounting(PROVIDER));
      setResult(null);
      setMsg({ text: "QuickBooks disconnected", type: "success" });
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
    setResult(null);
    try {
      const r = await syncAccounting(PROVIDER, { kind, start, end: end || start, dryRun });
      setResult(r);
      if (r.counts.failed > 0) {
        setMsg({ text: `${r.counts.failed} period(s) failed — see list below`, type: "error" });
      } else if (r.live) {
        setMsg({ text: `Synced ${r.counts.success} of ${r.results.length}`, type: "success" });
      } else {
        setMsg({ text: `Dry-run complete — ${r.counts.dry_run} payload(s) prepared, nothing sent`, type: "success" });
      }
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Sync failed", type: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (!status) return <div className="px-3 pb-3 text-[10px] text-erl-text-muted">Loading connection status…</div>;

  const connected = status.connected;
  const canSync = !!start && !!end && busy === null;

  return (
    <div className="pt-3 mt-2 border-t border-erl-border-subtle">
      {/* ── Connection ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${connected ? "bg-erl-success/20 text-erl-success" : "bg-white/10 text-erl-text-muted"}`}>
          {connected ? "CONNECTED" : "NOT CONNECTED"}
        </span>
        {connected && (
          <span className="text-[9px] text-erl-text-muted">
            company {status.realmId} · {status.environment}
            {status.expiresAt ? ` · token ${new Date(status.expiresAt).toLocaleString()}` : ""}
          </span>
        )}
        {!connected && status.dryRunForced && (
          <span className="text-[9px] text-erl-accent">QUICKBOOKS_DRY_RUN=1</span>
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
              title={status.clientIdConfigured ? "Authorize with Intuit" : "Save Client ID and Client Secret first"}
              className="px-2 py-1 text-[10px] font-semibold rounded-md bg-erl-accent text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy === "connect" ? "Redirecting…" : "Connect to QuickBooks"}
            </button>
          )}
        </div>
      </div>

      {!status.clientIdConfigured && (
        <p className="text-[10px] text-erl-text-muted mb-2">
          Add Client ID and Client Secret above (from a QuickBooks app on the Intuit developer portal),
          enable the integration, then connect.
        </p>
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
            value={kind}
            onChange={e => setKind(e.target.value as "invoice" | "bill")}
            className="w-full px-2 py-1 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
          >
            <option value="invoice">{KIND_LABEL.invoice}</option>
            <option value="bill">{KIND_LABEL.bill}</option>
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
        Sales push as one summary invoice per day (auto-triggered after each Z-Report);
        expenses push one Bill per supplier invoice. Re-running a range never duplicates — already-synced
        days are skipped.
        {!connected && " Connect to send; until then every sync is a dry-run that only shows the payload."}
      </p>

      {/* ── Results ────────────────────────────────────────── */}
      {result && (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-erl-border-subtle p-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold text-erl-text-primary">
              {KIND_LABEL[result.kind]} — {result.live ? "sent to QuickBooks" : "dry-run"}
            </span>
            <span className="text-[9px] text-erl-text-muted">
              {result.counts.success} sent · {result.counts.dry_run} dry-run · {result.counts.skipped} skipped · {result.counts.failed} failed
            </span>
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {result.results.map(r => (
              <div key={`${result.kind}-${r.period}`} className="text-[10px] flex items-start gap-2">
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
                {JSON.stringify(result.results.find(r => r.period === openPayload)?.payload, null, 2)}
              </pre>
            )}
          </div>
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
                <span className="text-erl-text-secondary">{row.type === "bill" ? "Expense" : "Sales"}</span>
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
