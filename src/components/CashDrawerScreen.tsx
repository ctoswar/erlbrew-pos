import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "../utils";
import { getCashDrawer, updateCashDrawer, apiPost, type CashDrawer } from "../utils/api";

export const CashDrawerScreen: React.FC = () => {
  const [drawer, setDrawer] = useState<CashDrawer | null>(null);
  const [drawerStatus, setDrawerStatus] = useState<'idle' | 'opening' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'success' | 'error' }>({ text: '', type: 'info' });
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [cashPayouts, setCashPayouts] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const loadDrawer = useCallback(async () => {
    try {
      const d = await getCashDrawer();
      setDrawer(d);
      setDrawerId(d.id);
      setCashPayouts(d.cash_payouts);
      setClosingAmount(d.closing_amount);
      setNotes(d.notes || '');
    } catch (e) {
      setMsg({ text: 'Failed to load cash drawer', type: 'error' });
    }
  }, []);

  useEffect(() => { loadDrawer(); }, [loadDrawer]);

const handleOpenDrawer = async () => {
    setDrawerStatus('opening');
    setMsg({ text: '', type: 'info' });
    try {
      await apiPost('/open-drawer', {});
      setDrawerStatus('ok');
      setMsg({ text: '✓ Drawer opened!', type: 'success' });
      setTimeout(() => setDrawerStatus('idle'), 2000);
    } catch (e) {
      setDrawerStatus('error');
      setMsg({ text: 'Drawer unreachable — is the Pi online?', type: 'error' });
      setTimeout(() => setDrawerStatus('idle'), 3000);
    }
  };

  const expected = drawer ? Number(drawer.opening_float) + Number(drawer.cash_sales) - cashPayouts : 0;
  const variance = closingAmount - expected;

  const handleSave = async () => {
    if (!drawerId) return;
    setDrawerStatus('saving');
    setMsg({ text: '', type: 'info' });
    try {
      const updated = await updateCashDrawer(drawerId, {
        closing_amount: closingAmount,
        cash_payouts: cashPayouts,
        notes,
        action: 'save',
      });
      setDrawer(updated);
      setDrawerStatus('ok');
      setMsg({ text: 'Saved', type: 'success' });
      setTimeout(() => setDrawerStatus('idle'), 2000);
    } catch {
      setDrawerStatus('error');
      setMsg({ text: 'Failed to save', type: 'error' });
      setTimeout(() => setDrawerStatus('idle'), 2000);
    }
  };

  const handleCloseDrawer = async () => {
    if (!drawerId) return;
    setDrawerStatus('saving');
    setMsg({ text: '', type: 'info' });
    try {
      const closed = await updateCashDrawer(drawerId, {
        closing_amount: closingAmount,
        cash_payouts: cashPayouts,
        notes,
        action: 'close',
      });
      setDrawer(closed);
      setDrawerStatus('ok');
      setMsg({
        text: variance === 0 ? '✓ Drawer closed — balanced!' : `⚠ Drawer closed — variance ${formatCurrency(variance)}`,
        type: variance === 0 ? 'success' : 'error',
      });
    } catch {
      setDrawerStatus('error');
      setMsg({ text: 'Failed to close drawer', type: 'error' });
      setTimeout(() => setDrawerStatus('idle'), 2000);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: 140, padding: "5px 10px", borderRadius: 7,
    border: "1.5px solid var(--border-default)", textAlign: "right",
    background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13,
  };

  const rowLabel: React.CSSProperties = {
    fontSize: 10, color: "var(--text-muted)", fontWeight: 600,
  };

  const sectionStyle: React.CSSProperties = {
    background: "var(--bg-elevated)", border: "1.5px solid var(--border-medium)",
    borderRadius: 12, padding: "1rem",
  };

  return (
    <div style={{ padding: "0.8rem 1.2rem", display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
            Cash Drawer
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {drawer?.shift_date ? `Shift: ${drawer.shift_date}` : 'No open drawer'}
          </div>
        </div>
        <span className={`pill ${drawer?.status === 'open' ? 'pill-success' : 'pill-muted'}`} style={{ fontSize: 9 }}>
          {drawer?.status === 'open' ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {msg.text && (
        <div style={{
          padding: "8px 14px", borderRadius: 8, fontSize: 11,
          background: msg.type === 'error' ? 'rgba(220,80,80,0.15)' : msg.type === 'success' ? 'rgba(80,180,80,0.15)' : 'rgba(201,135,58,0.1)',
          color: msg.type === 'error' ? 'var(--danger)' : msg.type === 'success' ? 'var(--success)' : 'var(--gold)',
          border: `1px solid ${msg.type === 'error' ? 'var(--danger)' : msg.type === 'success' ? 'var(--success)' : 'var(--gold)'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Opening Float", value: formatCurrency(drawer?.opening_float ?? 0) },
          { label: "Cash Sales", value: formatCurrency(drawer?.cash_sales ?? 0) },
          { label: "Payouts", value: formatCurrency(cashPayouts), highlighted: true },
        ].map(({ label, value, highlighted }) => (
          <div key={label} style={{ ...sectionStyle, padding: "0.75rem" }}>
            <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: highlighted ? "var(--gold)" : "var(--text-primary)", fontFamily: "'Playfair Display', serif" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Opening Float */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={rowLabel}>Opening Float</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "var(--gold)" }}>
              {formatCurrency(drawer?.opening_float ?? 0)}
            </span>
            {drawer?.status === 'closed' && (
              <span style={{ fontSize: 8, color: "var(--text-muted)" }}>• Shift ended</span>
            )}
          </div>
        </div>
      </div>

      {/* Cash Payouts */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={rowLabel}>Cash Payouts (–)</span>
          <input
            type="number"
            value={cashPayouts}
            onChange={(e) => setCashPayouts(Number(e.target.value) || 0)}
            disabled={drawer?.status === 'closed'}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Expected */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>Expected Cash</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Playfair Display', serif" }}>
            {formatCurrency(expected)}
          </span>
        </div>
      </div>

      {/* Actual / Variance */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={rowLabel}>Actual Cash (counted)</span>
            <input
              type="number"
              value={closingAmount}
              onChange={(e) => setClosingAmount(Number(e.target.value) || 0)}
              disabled={drawer?.status === 'closed'}
              style={inputStyle}
            />
          </div>
          <div style={{ height: 1, background: "var(--border-default)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: variance === 0 ? "var(--success)" : Math.abs(variance) > 50 ? "var(--danger)" : "var(--gold)" }}>
              {variance === 0 ? "✓ Balanced" : `Variance ${variance > 0 ? '(+)' : ''}`}
            </span>
            <span style={{
              fontSize: 18, fontWeight: 700,
              color: variance === 0 ? "var(--success)" : Math.abs(variance) > 50 ? "var(--danger)" : "var(--gold)",
              fontFamily: "'Playfair Display', serif",
            }}>
              {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={rowLabel}>Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Paid supplier, petty cash..."
            disabled={drawer?.status === 'closed'}
            style={{ ...inputStyle, textAlign: "left", width: 260, fontSize: 11 }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Open Drawer — always visible, for hardware trigger */}
        <button
          onClick={handleOpenDrawer}
          disabled={drawerStatus !== 'idle'}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 9,
            background: drawerStatus === 'opening' ? "rgba(201,135,58,0.5)" : drawerStatus === 'ok' ? "var(--success)" : "var(--gold)",
            color: "#fff", border: "none", fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
            cursor: drawerStatus === 'idle' ? "pointer" : "wait",
            textTransform: "uppercase" as const,
          }}
        >
          {drawerStatus === 'opening' ? "Opening..." : drawerStatus === 'ok' ? "✓ Drawer Opened" : "🔓 Open Cash Drawer"}
        </button>

        {drawer?.status === 'open' && (
          <>
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={drawerStatus === 'saving'}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 9,
                border: "1.5px solid var(--gold)", background: "transparent",
                color: "var(--gold)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                cursor: drawerStatus === 'idle' ? "pointer" : "wait",
                textTransform: "uppercase" as const,
              }}
            >
              {drawerStatus === 'saving' ? "Saving..." : "Save Progress"}
            </button>

            {/* Close Drawer */}
            <button
              onClick={handleCloseDrawer}
              disabled={drawerStatus === 'saving' || closingAmount === 0}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 9,
                background: closingAmount === 0 ? "rgba(80,201,80,0.15)" : "var(--success)",
                color: closingAmount === 0 ? "var(--success)" : "#fff",
                border: "none", fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                cursor: closingAmount === 0 || drawerStatus !== 'idle' ? "default" : "pointer",
                textTransform: "uppercase" as const,
              }}
            >
              {drawerStatus === 'saving' ? "Closing..." : "✓ Close & Balance Drawer"}
            </button>

            {closingAmount === 0 && (
              <div style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>
                Enter actual cash count above to close drawer
              </div>
            )}
          </>
        )}

        {drawer?.status === 'closed' && (
          <>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
              This shift is closed. Start a new shift to open the drawer again.
            </div>
            <button
              onClick={handleOpenDrawer}
              disabled={drawerStatus !== 'idle'}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 9,
                border: "1.5px solid var(--border-medium)", background: "transparent",
                color: "var(--text-secondary)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                cursor: drawerStatus === 'idle' ? "pointer" : "wait",
                textTransform: "uppercase" as const,
              }}
            >
              {drawerStatus === 'opening' ? "Opening..." : "Start New Shift"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};