import React, { useState, useEffect, useCallback } from "react";
import { getCompanySettings, updateCompanySettings, parsePromoMessages } from "../utils/api";

/** Longest message shown on the ticker — keeps one line readable on the display */
const MAX_MESSAGE_LENGTH = 200;

export const AdminDisplayMessages: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    try {
      const settings = await getCompanySettings();
      setMessages(parsePromoMessages(settings.promo_messages));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to load display messages", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, text.slice(0, MAX_MESSAGE_LENGTH)]);
    setDraft("");
    setMsg(null);
  };

  const handleEdit = (index: number, value: string) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? value : m)));
    setMsg(null);
  };

  const handleRemove = (index: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== index));
    setMsg(null);
  };

  const handleSave = async () => {
    const cleaned = messages.map((m) => m.trim()).filter(Boolean);
    setSaving(true);
    setMsg(null);
    try {
      await updateCompanySettings({ promo_messages: JSON.stringify(cleaned) });
      setMessages(cleaned);
      setMsg({ text: "Display messages saved — the customer display picks them up within 60s", type: "success" });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-erl-text-primary">Display Messages</h3>
        <span className="text-[10px] text-erl-text-muted">Promotional ticker · rotates every 8s</span>
      </div>
      <p className="text-[11px] text-erl-text-muted mb-3">
        Shown on the <span className="font-semibold">?customer</span> display above the footer. Leave the list empty to hide the ticker.
      </p>

      {msg && (
        <div className={`mb-3 text-[11px] font-semibold ${msg.type === "success" ? "text-erl-success" : "text-erl-danger"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-[11px] text-erl-text-muted py-2">Loading…</div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {messages.length === 0 && (
              <div className="text-[11px] text-erl-text-muted py-1">
                No messages yet — the customer display shows no ticker.
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-erl-border-subtle">
                <span className="w-5 text-center text-[10px] text-erl-text-muted">{index + 1}</span>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => handleEdit(index, e.target.value)}
                  maxLength={MAX_MESSAGE_LENGTH}
                  className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
                />
                <button
                  onClick={() => handleRemove(index)}
                  title="Remove message"
                  className="px-2 py-1.5 text-[11px] rounded-md border border-erl-border-default text-erl-text-muted hover:text-erl-danger hover:border-erl-danger transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="e.g. Buy 1 get 1 on lattes every Friday!"
              maxLength={MAX_MESSAGE_LENGTH}
              className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-md bg-erl-surface border border-erl-border-default text-erl-text-primary focus:outline-none focus:border-erl-accent"
            />
            <button
              onClick={handleAdd}
              disabled={!draft.trim()}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-md border border-erl-border-default text-erl-text-secondary hover:border-erl-accent hover:text-erl-accent disabled:opacity-50 transition-colors"
            >
              + Add
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-[11px] font-semibold rounded-md bg-erl-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save messages"}
          </button>
        </>
      )}
    </div>
  );
};
