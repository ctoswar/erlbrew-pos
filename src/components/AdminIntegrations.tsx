import React, { useState, useEffect, useCallback } from "react";
import {
  getIntegrations,
  updateIntegration,
  testIntegration,
  updateCompanySettings,
  getCompanySettings,
  IntegrationsStatus,
} from "../utils/api";

interface TestResult {
  provider: string;
  ok: boolean;
  message: string;
}

/** Field labels per provider — matches backend PROVIDERS field keys. */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  paymongo: {
    secret_key: "Secret Key",
    webhook_secret: "Webhook Signing Secret",
    mode: "Mode (test / live)",
  },
  grab: {
    client_id: "Client ID",
    client_secret: "Client Secret",
    merchant_id: "Merchant ID",
    webhook_secret: "Webhook Secret",
  },
  foodpanda: {
    api_key: "API Key",
    vendor_id: "Vendor ID",
    webhook_secret: "Webhook Secret",
  },
};

const ORDER = ["paymongo", "grab", "foodpanda"];

export const AdminIntegrations: React.FC = () => {
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [baseUrlSaving, setBaseUrlSaving] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  // Edited field values (only non-empty edits are sent — blank = unchanged)
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});

  const load = useCallback(async () => {
    try {
      const [s, cs] = await Promise.all([getIntegrations(), getCompanySettings()]);
      setStatus(s);
      setBaseUrl(cs.base_url || "");
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to load integrations", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveBaseUrl = async () => {
    setBaseUrlSaving(true);
    try {
      await updateCompanySettings({ base_url: baseUrl.trim() });
      setMsg({ text: "Base URL saved — webhook URLs updated", type: "success" });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Save failed", type: "error" });
    } finally {
      setBaseUrlSaving(false);
    }
  };

  const handleToggle = async (provider: string, enabled: boolean) => {
    setSaving(provider);
    setMsg(null);
    try {
      const updated = await updateIntegration(provider, { enabled });
      setStatus(prev => (prev ? { ...prev, [provider]: updated } : prev));
      setMsg({ text: `${updated.label} ${enabled ? "enabled" : "disabled"}`, type: "success" });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Save failed", type: "error" });
    } finally {
      setSaving(null);
    }
  };

  const handleSave = async (provider: string) => {
    const edits = drafts[provider] || {};
    const payload: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(edits)) if (v.trim()) payload[k] = v.trim();
    if (!Object.keys(payload).length) return;
    setSaving(provider);
    setMsg(null);
    try {
      const updated = await updateIntegration(provider, payload);
      setStatus(prev => (prev ? { ...prev, [provider]: updated } : prev));
      setDrafts(prev => ({ ...prev, [provider]: {} }));
      setMsg({ text: `${updated.label} credentials saved (encrypted at rest)`, type: "success" });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Save failed", type: "error" });
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (provider: string) => {
    setTesting(provider);
    setTestResult(null);
    try {
      const r = await testIntegration(provider);
      setTestResult({ provider, ...r });
    } catch (e) {
      setTestResult({ provider, ok: false, message: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(null);
    }
  };

  const copyWebhook = (url: string) => {
    navigator.clipboard.writeText(url).then(
      () => setMsg({ text: "Webhook URL copied", type: "success" }),
      () => setMsg({ text: "Copy failed", type: "error" })
    );
  };

  if (loading) {
    return <div className="p-4 text-xs text-erl-text-muted">Loading integrations…</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-erl-text-primary">Integrations</h3>
        <span className="text-[10px] text-erl-text-muted">Phase 2 — PayMongo · GrabFood · FoodPanda</span>
      </div>
      <p className="text-[11px] text-erl-text-muted mb-3">
        Credentials are encrypted at rest and never shown in full. Secrets entered here override server env vars.
      </p>

      {msg && (
        <div className={`mb-3 text-[11px] font-semibold ${msg.type === "success" ? "text-erl-success" : "text-erl-danger"}`}>
          {msg.text}
        </div>
      )}

      {/* Base URL — required for copyable webhook URLs */}
      <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-erl-border-subtle">
        <label className="block text-[10px] uppercase tracking-wider text-erl-text-muted mb-1">
          Public Base URL (for webhook callbacks)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://your-domain.com — or tunnel URL in dev (ngrok / Cloudflare Tunnel)"
            className="flex-1 px-2 py-1.5 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
          />
          <button
            onClick={handleSaveBaseUrl}
            disabled={baseUrlSaving}
            className="px-3 py-1.5 text-[11px] font-semibold rounded-md bg-erl-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {baseUrlSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ORDER.filter(p => status?.[p]).map(p => {
          const prov = status![p];
          const labels = FIELD_LABELS[p] || {};
          const draft = drafts[p] || {};
          return (
            <div key={p} className="p-3 rounded-lg bg-white/[0.03] border border-erl-border-subtle">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-erl-text-primary">{prov.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${prov.enabled ? "bg-erl-success/20 text-erl-success" : "bg-white/10 text-erl-text-muted"}`}>
                    {prov.enabled ? "ENABLED" : "OFF"}
                  </span>
                </div>
                <button
                  onClick={() => handleToggle(p, !prov.enabled)}
                  disabled={saving === p}
                  className={`relative w-9 h-5 rounded-full transition-colors ${prov.enabled ? "bg-erl-accent" : "bg-white/15"} disabled:opacity-50`}
                  aria-label={`Toggle ${prov.label}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${prov.enabled ? "left-4.5 left-[18px]" : "left-0.5"}`} />
                </button>
              </div>

              <div className="space-y-2">
                {Object.keys(labels).map(f => {
                  const field = prov.fields[f];
                  if (!field) return null;
                  const isSecret = field.configured && field.masked !== undefined && field.value === undefined;
                  return (
                    <div key={f}>
                      <label className="block text-[9px] uppercase tracking-wider text-erl-text-muted mb-0.5">
                        {labels[f]}
                        {field.configured && isSecret && (
                          <span className="ml-1 normal-case text-erl-success">✓ {field.masked}</span>
                        )}
                      </label>
                      <input
                        type={isSecret ? "password" : "text"}
                        value={draft[f] ?? ""}
                        onChange={e => setDrafts(prev => ({ ...prev, [p]: { ...prev[p], [f]: e.target.value } }))}
                        placeholder={
                          isSecret
                            ? "•••• (saved — type to replace)"
                            : field.value || (field.configured ? "" : "not set")
                        }
                        className="w-full px-2 py-1 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
                      />
                    </div>
                  );
                })}
              </div>

              {prov.webhook_url && (
                <div className="mt-2">
                  <label className="block text-[9px] uppercase tracking-wider text-erl-text-muted mb-0.5">Webhook URL</label>
                  <button
                    onClick={() => copyWebhook(prov.webhook_url!)}
                    title="Click to copy"
                    className="w-full px-2 py-1 text-[10px] text-left font-mono rounded-md bg-erl-surface border border-erl-border-default text-erl-text-secondary hover:border-erl-accent truncate"
                  >
                    {prov.webhook_url}
                  </button>
                </div>
              )}
              {!prov.webhook_url && (
                <p className="mt-2 text-[9px] text-erl-danger">Set the Public Base URL to generate a webhook URL</p>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleSave(p)}
                  disabled={saving === p || !Object.values(draft).some(v => v.trim())}
                  className="flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md bg-erl-accent text-white hover:opacity-90 disabled:opacity-40"
                >
                  {saving === p ? "Saving…" : "Save Keys"}
                </button>
                <button
                  onClick={() => handleTest(p)}
                  disabled={testing === p || !prov.enabled}
                  className="flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md border border-erl-border-default text-erl-text-secondary hover:bg-white/[0.06] disabled:opacity-40"
                >
                  {testing === p ? "Testing…" : "Test Connection"}
                </button>
              </div>

              {testResult?.provider === p && (
                <p className={`mt-2 text-[10px] font-semibold ${testResult.ok ? "text-erl-success" : "text-erl-danger"}`}>
                  {testResult.ok ? "✓ " : "✗ "}{testResult.message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
