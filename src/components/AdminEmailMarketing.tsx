import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiAdminGet, apiAdminPost, apiAdminPut } from "../utils/api";
import { parseServerDatetime, formatTime } from "../utils";

/**
 * Email Marketing (admin) — compose + send advertisement campaigns to
 * customers with an email on file (server decrypts addresses; they are
 * only ever surfaced in the dry-run preview, max 10).
 *
 * SMTP credentials are saved right in this panel (card below) — stored in
 * company_settings with the password encrypted, the same way the other
 * provider configs are. server/.env SMTP_* vars still win when set. The
 * server refuses sends until host + user + password resolve, and the status
 * box reflects exactly that, so the panel is explorable before any creds.
 */

interface SmtpField {
  configured: boolean;
  value?: string;
  masked?: string | null;
}

interface EmailStatus {
  configured: boolean;
  source: "env" | "settings" | null;
  smtp: {
    host: SmtpField;
    port: SmtpField;
    user: SmtpField;
    pass: SmtpField;
    from: SmtpField;
  };
  recipientCount: number;
  skippedWithoutValidEmail: number;
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

type Busy = "test" | "send" | "preview" | "smtp" | null;

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
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testTo, setTestTo] = useState("");
  const [smtpDraft, setSmtpDraft] = useState({ host: "", port: "", user: "", pass: "", from: "" });
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [preview, setPreview] = useState<DryRunResult | null>(null);
  const [history, setHistory] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshHistory = useCallback(async (list: CampaignRow[] = []) => {
    try {
      const rows = await apiAdminGet<CampaignRow[]>("/admin/emails/history");
      setHistory(rows);
      return rows;
    } catch {
      return list;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [s, rows] = await Promise.all([
        apiAdminGet<EmailStatus>("/admin/emails/status"),
        apiAdminGet<CampaignRow[]>("/admin/emails/history"),
      ]);
      setStatus(s);
      setHistory(rows);
      // Mirror the saved values into the drafts (password stays hidden —
      // only its mask shows). Blank = keep current on save.
      setSmtpDraft({
        host: s.smtp?.host?.value || "",
        port: s.smtp?.port?.value || "",
        user: s.smtp?.user?.value || "",
        pass: "",
        from: s.smtp?.from?.value || "",
      });
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

  const handleSaveSmtp = async () => {
    const payload: Record<string, string> = {};
    if (smtpDraft.host.trim()) payload.host = smtpDraft.host.trim();
    if (smtpDraft.port.trim()) payload.port = smtpDraft.port.trim();
    if (smtpDraft.user.trim()) payload.user = smtpDraft.user.trim();
    if (smtpDraft.pass.trim()) payload.pass = smtpDraft.pass.trim();
    if (smtpDraft.from.trim()) payload.from = smtpDraft.from.trim();
    if (Object.keys(payload).length === 0) {
      setMsg({ text: "Nothing to save — fill at least one SMTP field", type: "error" });
      return;
    }
    try {
      setBusy("smtp");
      const r = await apiAdminPut<{ ok: boolean; configured: boolean }>("/admin/emails/smtp", payload);
      await load();
      setMsg({
        text: r.configured
          ? "SMTP settings saved — email sending is live."
          : "SMTP settings saved — it still needs a host, user and password before sending works.",
        type: r.configured ? "success" : "error",
      });
    } catch (e) {
      setMsg({ text: errorText(e), type: "error" });
    } finally {
      setBusy(null);
    }
  };

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
      const r = await apiAdminPost<SendResult>("/admin/emails/send", {
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
      const r = await apiAdminPost<DryRunResult>("/admin/emails/send", {
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
      const r = await apiAdminPost<SendResult>("/admin/emails/send", {
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

  const statusBadge = () => {
    if (loading) return <span className="text-erl-text-muted text-xs">Loading…</span>;
    if (!status) return <span className="text-xs font-bold text-[#C65D51]">Status unavailable</span>;
    if (!status.configured) {
      return (
        <span className="text-[11px] font-bold text-[#C65D51]">
          ⚠ Not configured — save your SMTP details below
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold text-[#4F806A]">
        ✔ SMTP live ({status.source === "env" ? "from .env" : "saved in settings"}) · {status.recipientCount} recipient
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

      {/* SMTP server — credentials are saved in company_settings (password
          encrypted at rest, never echoed back, only its mask is shown) */}
      <div className="glass-panel rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-erl-text-primary uppercase tracking-wider">
            SMTP Server
          </span>
          {status?.configured && (
            <span className="text-[10px] font-bold text-[#4F806A]">
              {status.source === "env" ? "from server .env" : "saved in settings"}
              {status.smtp.pass.masked ? ` · password ${status.smtp.pass.masked}` : ""}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">
              Host
            </label>
            <input
              type="text"
              value={smtpDraft.host}
              onChange={(e) => setSmtpDraft((d) => ({ ...d, host: e.target.value }))}
              placeholder="smtp.gmail.com"
              className="w-full min-h-[44px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">
              Port (blank = 587)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={smtpDraft.port}
              onChange={(e) => setSmtpDraft((d) => ({ ...d, port: e.target.value }))}
              placeholder="587 (465 = SSL)"
              className="w-full min-h-[44px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">
              Username
            </label>
            <input
              type="text"
              value={smtpDraft.user}
              onChange={(e) => setSmtpDraft((d) => ({ ...d, user: e.target.value }))}
              placeholder="your.smtp.login"
              autoComplete="off"
              className="w-full min-h-[44px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">
              Password
            </label>
            <input
              type="password"
              value={smtpDraft.pass}
              onChange={(e) => setSmtpDraft((d) => ({ ...d, pass: e.target.value }))}
              placeholder={status?.smtp.pass.masked || "app password"}
              autoComplete="new-password"
              className="w-full min-h-[44px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[8px] text-erl-text-muted tracking-[2px] uppercase font-bold mb-1">
              From address (blank = username)
            </label>
            <input
              type="text"
              value={smtpDraft.from}
              onChange={(e) => setSmtpDraft((d) => ({ ...d, from: e.target.value }))}
              placeholder="hello@erlbrew.ph"
              className="w-full min-h-[44px] bg-erl-surface border border-erl-border-default rounded-xl px-3 py-2 text-xs text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2">
          <span className="text-[9px] text-erl-text-muted">
            Leave a field blank to keep its current value. The password is stored encrypted
            and is never displayed again.
          </span>
          <button
            onClick={() => void handleSaveSmtp()}
            disabled={busy !== null}
            className="min-h-[44px] px-5 rounded-xl bg-erl-accent text-white hover:bg-erl-accent/90 text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {busy === "smtp" ? "Saving…" : "Save SMTP"}
          </button>
        </div>
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
