import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiAdminGet, apiAdminPost, apiAdminPut } from "../utils/api";
import { parseServerDatetime, formatTime } from "../utils";

/**
 * Email Marketing (admin) — compose + send advertisement campaigns to
 * customers with an email on file (server decrypts addresses; they are
 * only ever surfaced in the dry-run preview, max 10).
 *
 * SMTP lives in Settings → Email Marketing: save credentials here
 * (stored encrypted on the server) or set SMTP_* env vars — env wins.
 * Saves apply immediately, no server restart needed.
 */

interface EmailStatus {
  configured: boolean;
  from: string | null;
  recipientCount: number;
  skippedWithoutValidEmail: number;
}

interface SmtpFieldConfig {
  configured: boolean;
  source: string | null;
  masked?: string | null;
  value?: string;
}

interface SmtpConfig {
  fields: {
    host: SmtpFieldConfig;
    port: SmtpFieldConfig;
    user: SmtpFieldConfig;
    pass: SmtpFieldConfig;
    from: SmtpFieldConfig;
  };
  ready: boolean;
  from: string | null;
}

interface CampaignRow {
  id: number;
  subject: string;
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  status: string;
  error: string | null;
  created_by_name: string | null;
  created_at: string;
  sent_at: string | null;
}

interface SendResult {
  ok?: boolean;
  campaignId?: number;
  recipientCount?: number;
  sentTo?: string;
  status?: string;
}

interface DryRunResult {
  recipientCount: number;
  preview: { id: number; email: string; name: string | null }[];
}

type Busy = "test" | "send" | "preview" | null;

const MAX_SUBJECT = 200;
const MAX_BODY = 10000;

/** apiAdminGet/Post prefix errors with `API <path> failed: <status> — <real message>` — show only the real message. */
function errorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const idx = raw.indexOf(" — ");
  return idx >= 0 ? raw.slice(idx + 3) : raw;
}

export const AdminEmailMarketing: React.FC = () => {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [smtp, setSmtp] = useState<SmtpConfig | null>(null);
  const [smtpForm, setSmtpForm] = useState({ host: "", port: "587", user: "", pass: "", from: "" });
  const [smtpBusy, setSmtpBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [preview, setPreview] = useState<DryRunResult | null>(null);
  const [history, setHistory] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshHistory = useCallback(async (list: CampaignRow[] = []) => {
    try {
      const rows = await apiAdminGet<CampaignRow[]>("/api/admin/emails/history");
      setHistory(rows);
      return rows;
    } catch {
      return list;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [s, rows, cfg] = await Promise.all([
        apiAdminGet<EmailStatus>("/api/admin/emails/status"),
        apiAdminGet<CampaignRow[]>("/api/admin/emails/history"),
        apiAdminGet<SmtpConfig>("/api/admin/emails/config").catch(() => null),
      ]);
      setStatus(s);
      setHistory(rows);
      if (cfg) {
        setSmtp(cfg);
        setSmtpForm((f) => ({
          ...f,
          host: cfg.fields.host.value || "",
          port: cfg.fields.port.value || "587",
          user: cfg.fields.user.value || "",
          from: cfg.fields.from.value || "",
        }));
      }
    } catch (e) {
      setMsg({ text: errorText(e), type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [load]);

  // While any campaign is still "sending", gently poll the history so the
  // delivered/failed counters tick up without a manual refresh.
  useEffect(() => {
    if (!history.some((r) => r.status === "sending")) return;
    const timer = setTimeout(() => {
      void refreshHistory();
    }, 4000);
    pollingRef.current = timer;
    return () => clearTimeout(timer);
  }, [history, refreshHistory]);

  const composeError =
    !subject.trim() && !body.trim()
      ? "Write a subject and body first"
      : !subject.trim()
        ? "Add a subject"
        : !body.trim()
          ? "Write the email body"
          : null;

  const handleTest = async () => {
    if (composeError) {
      setMsg({ text: composeError, type: "error" });
      return;
    }
    if (!testTo.trim() || !testTo.includes("@")) {
      setMsg({ text: "Enter a test recipient email", type: "error" });
      return;
    }
    setPreview(null);
    try {
      setBusy("test");
      const r = await apiAdminPost<SendResult>("/api/admin/emails/send", {
        subject: subject.trim(),
        body: body.trim(),
        testTo: testTo.trim(),
      });
      setMsg({
        text: r.sentTo ? `Test email sent to ${r.sentTo}. Check the inbox.` : "Test email sent.",
        type: "success",
      });
    } catch (e) {
      setMsg({ text: errorText(e), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    if (composeError) {
      setMsg({ text: composeError, type: "error" });
      return;
    }
    try {
      setBusy("preview");
      const r = await apiAdminPost<DryRunResult>("/api/admin/emails/send", {
        subject: subject.trim(),
        body: body.trim(),
        dryRun: true,
      });
      setPreview(r);
      setMsg(null);
    } catch (e) {
      setMsg({ text: errorText(e), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    if (composeError) {
      setMsg({ text: composeError, type: "error" });
      return;
    }
    const audience = status?.recipientCount ?? 0;
    if (!window.confirm(`Send this campaign to ${audience} customer${audience === 1 ? "" : "s"} now? Suggested: press "Preview" first.`)) {
      return;
    }
    setPreview(null);
    try {
      setBusy("send");
      const r = await apiAdminPost<SendResult>("/api/admin/emails/send", {
        subject: subject.trim(),
        body: body.trim(),
      });
      setMsg({
        text: r.recipientCount != null
          ? `Campaign queued to ${r.recipientCount} recipient${r.recipientCount === 1 ? "" : "s"} — status updates below.`
          : "Campaign queued — status updates below.",
        type: "success",
      });
      await refreshHistory();
      setPreview(null);
    } catch (e) {
      setMsg({ text: errorText(e), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveSmtp = async () => {
    const form = smtpForm;
    const passAlreadySaved = smtp?.fields.pass.configured === true;
    if (!form.host.trim() || !form.user.trim() || (!form.pass.trim() && !passAlreadySaved)) {
      setMsg({ text: "SMTP host and username are required — and a password unless one is already saved", type: "error" });
      return;
    }
    try {
      setSmtpBusy(true);
      const r = await apiAdminPut<{ ok: boolean; saved: string[]; ready: boolean }>(
        "/api/admin/emails/config",
        {
          host: form.host.trim(),
          port: form.port.trim(),
          user: form.user.trim(),
          pass: form.pass.trim(),
          from: form.from.trim(),
        }
      );
      setSmtpForm((f) => ({ ...f, pass: "" })); // never render the saved secret
      setMsg({
        text: r.ready
          ? "SMTP saved — sending is live. Test send recommended before a campaign."
          : "SMTP saved, but the server reports it still not ready — check host/user/password fields.",
        type: r.ready ? "success" : "error",
      });
      setShowSettings(false);
      await load();
    } catch (e) {
      setMsg({ text: errorText(e), type: "error" });
    } finally {
      setSmtpBusy(false);
    }
  };

  const statusBadge = () => {
    if (loading) return <span className="text-erl-text-muted text-xs">Loading…</span>;
    if (!status) return <span className="text-erl-error text-xs font-bold">Status unavailable</span>;
    if (!status.configured) {
      return (
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="text-[11px] font-bold text-[#C65D51] hover:text-[#C65D51]/80 cursor-pointer underline decoration-dotted"
        >
          ⚠ Not configured — set up SMTP here
        </button>
      );
    }
    return (
      <span className="text-[11px] font-bold text-[#4F806A]">
        ✔ SMTP ready{status.from ? ` · from ${status.from}` : ""} · {status.recipientCount} recipient
        {status.recipientCount === 1 ? "" : "s"} on file
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold text-erl-text-primary uppercase tracking-wider">
          Email Marketing
        </h3>
        {statusBadge()}
      </div>

      {msg && (
        <div
          className={`mb-3 rounded-xl border px-3 py-2 text-xs font-bold ${
            msg.type === "success"
              ? "border-[#4F806A]/40 text-[#4F806A] bg-[#4F806A]/10"
              : "border-[#C65D51]/40 text-[#C65D51] bg-[#C65D51]/10"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* SMTP settings */}
      <div className="glass-panel rounded-2xl mb-4">
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        >
          <span className="text-[10px] font-bold text-erl-text-primary uppercase tracking-wider">
            SMTP Settings
            {smtp?.ready && (
              <span className="ml-2 text-[9px] text-[#4F806A] font-normal normal-case">· connected</span>
            )}
          </span>
          <span className="text-erl-text-muted text-xs">{showSettings ? "− Hide" : "+ Edit"}</span>
        </button>
        {showSettings && (
          <div className="px-4 pb-4 space-y-2 border-t border-erl-border-subtle pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">SMTP Host</span>
                <input
                  type="text"
                  value={smtpForm.host}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, host: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="w-full min-h-[40px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
                />
              </label>
              <label className="block">
                <span className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">Port</span>
                <input
                  type="number"
                  value={smtpForm.port}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, port: e.target.value }))}
                  placeholder="587"
                  className="w-full min-h-[40px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
                />
              </label>
              <label className="block">
                <span className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">Username</span>
                <input
                  type="email"
                  value={smtpForm.user}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, user: e.target.value }))}
                  placeholder="ads@erlbrew.ph"
                  className="w-full min-h-[40px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
                />
              </label>
              <label className="block">
                <span className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">Password / App token</span>
                <input
                  type="password"
                  value={smtpForm.pass}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, pass: e.target.value }))}
                  placeholder={smtp?.fields.pass.configured ? "saved — type to replace" : "••••••••"}
                  className="w-full min-h-[40px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">From name / address (optional)</span>
                <input
                  type="text"
                  value={smtpForm.from}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, from: e.target.value }))}
                  placeholder='Erlbrew Café <ads@erlbrew.ph>'
                  className="w-full min-h-[40px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
                />
              </label>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between pt-1">
              <span className="text-[9px] text-erl-text-muted">
                Saved encrypted (the password is encrypted before it is stored) — applies immediately, no restart.
                SMTP_* env vars still override saved values.
              </span>
              <button
                onClick={() => void handleSaveSmtp()}
                disabled={smtpBusy}
                className="shrink-0 min-h-[40px] px-4 rounded-xl bg-erl-accent text-white hover:bg-erl-accent/90 text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 transition-colors"
              >
                {smtpBusy ? "Saving…" : "Save SMTP"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="glass-panel rounded-2xl p-4 mb-4 space-y-2">
        <label className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          maxLength={MAX_SUBJECT}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Double-double weekend — 2 stamps per drink!"
          className="w-full min-h-[44px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
        />
        <div className="flex justify-between">
          <span className="text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold">
            Body
          </span>
          <span className="text-[9px] text-erl-text-muted">{body.length}/{MAX_BODY}</span>
        </div>
        <textarea
          value={body}
          maxLength={MAX_BODY}
          rows={7}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Plain text is fine — we brand it automatically.\nBlank lines become paragraphs."}
          className="w-full bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors resize-y"
        />
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="send a test to… (your email)"
            className="flex-1 min-h-[44px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
          />
          <button
            onClick={() => void handleTest()}
            disabled={busy !== null}
            className="min-h-[44px] px-4 rounded-xl border-[1.5px] border-erl-accent text-erl-accent bg-erl-accent/10 hover:bg-erl-accent/20 text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 transition-colors"
          >
            {busy === "test" ? "Sending…" : "Test"}
          </button>
          <button
            onClick={() => void handlePreview()}
            disabled={busy !== null}
            className="min-h-[44px] px-4 rounded-xl border-[1.5px] border-erl-border-default bg-erl-surface text-erl-text-primary hover:border-erl-accent text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 transition-colors"
          >
            {busy === "preview" ? "Loading…" : "Preview"}
          </button>
          <button
            onClick={() => void handleSend()}
            disabled={busy !== null || (!status?.configured && !loading)}
            title={status?.configured ? "Send to all customers with an email on file" : "Configure SMTP in server/.env first"}
            className="min-h-[44px] px-5 rounded-xl bg-erl-accent text-white hover:bg-erl-accent/90 text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy === "send" ? "Queuing…" : "Send Campaign"}
          </button>
        </div>
      </div>

      {/* Dry-run preview */}
      {preview && (
        <div className="glass-panel rounded-2xl p-4 mb-4">
          <div className="text-[10px] font-bold text-erl-text-primary uppercase tracking-wider mb-2">
            Dry run — {preview.recipientCount} would receive this
            {status?.skippedWithoutValidEmail ? ` · ${status.skippedWithoutValidEmail} skipped (no valid email)` : ""}
          </div>
          {preview.preview.length === 0 ? (
            <div className="text-xs text-erl-text-muted">No customers with an email on file.</div>
          ) : (
            <ul className="text-xs text-erl-text-secondary space-y-1">
              {preview.preview.map((p) => (
                <li key={p.id} className="flex justify-between gap-4">
                  <span>{p.email}</span>
                  <span className="text-erl-text-muted">{p.name || "—"}</span>
                </li>
              ))}
              {preview.recipientCount > preview.preview.length && (
                <li className="text-erl-text-muted italic">
                  …and {preview.recipientCount - preview.preview.length} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* History */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="text-[10px] font-bold text-erl-text-primary uppercase tracking-wider mb-2">
          Recent Campaigns
        </div>
        {history.length === 0 ? (
          <div className="text-xs text-erl-text-muted">Nothing sent yet — your campaigns will appear here.</div>
        ) : (
          <div className="space-y-2">
            {history.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-erl-border-default px-3 py-2"
              >
                <StatusPill status={c.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-erl-text-primary truncate">{c.subject}</div>
                  <div className="text-[10px] text-erl-text-muted">
                    {c.delivered_count} delivered{c.failed_count > 0 ? ` · ${c.failed_count} failed` : ""}
                    {c.created_by_name ? ` · by ${c.created_by_name}` : ""}
                    {c.error ? ` · ${c.error}` : ""}
                  </div>
                </div>
                <div className="text-[10px] text-erl-text-muted whitespace-nowrap">
                  {formatTime(parseServerDatetime(c.created_at))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    sending: { label: "SENDING", cls: "bg-erl-accent/15 text-erl-accent" },
    sent: { label: "SENT", cls: "bg-[#4F806A]/15 text-[#4F806A]" },
    partial: { label: "PARTIAL", cls: "bg-[#C9873A]/15 text-[#C9873A]" },
    failed: { label: "FAILED", cls: "bg-[#C65D51]/15 text-[#C65D51]" },
  };
  const s = map[status] || { label: status.toUpperCase(), cls: "bg-neutral-500/15 text-neutral-400" };
  return (
    <span className={`text-[9px] font-bold tracking-wider px-2 py-1 rounded-md ${s.cls}`}>
      {s.label}
    </span>
  );
};
