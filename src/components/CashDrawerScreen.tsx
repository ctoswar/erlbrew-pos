import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "../utils";
import {
  getCashDrawer, updateCashDrawer, apiPost,
  getCashDrawerTransactions, createCashDrawerTransaction,
  type CashDrawer, type CashDrawerTransaction,
} from "../utils/api";

const TX_LABELS: Record<string, string> = {
  cash_in: 'Cash In',
  cash_out: 'Cash Out',
  sale: 'Sale',
  payout: 'Payout',
};

const TX_COLORS: Record<string, string> = {
  cash_in: 'var(--success)',
  cash_out: 'var(--danger)',
  sale: 'var(--gold)',
  payout: 'var(--gold)',
};



export const CashDrawerScreen: React.FC = () => {
  const [drawer, setDrawer] = useState<CashDrawer | null>(null);
  const [drawerStatus, setDrawerStatus] = useState<'idle' | 'opening' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'success' | 'error' }>({ text: '', type: 'info' });
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [cashPayouts, setCashPayouts] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Transaction history
  const [transactions, setTransactions] = useState<CashDrawerTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Cash in/out modal
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [txAmount, setTxAmount] = useState('');
  const [txReason, setTxReason] = useState('');
  const [txSaving, setTxSaving] = useState(false);

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

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const data = await getCashDrawerTransactions();
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrawer();
    loadTransactions();
  }, [loadDrawer, loadTransactions]);

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

  // ── Cash In/Out ──────────────────────────────────────────────────────────────

  const openTxModal = (type: 'cash_in' | 'cash_out') => {
    setTxType(type);
    setTxAmount('');
    setTxReason('');
    setShowTxModal(true);
  };

  const handleTxSubmit = async () => {
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0) return;
    setTxSaving(true);
    try {
      await createCashDrawerTransaction({
        transaction_type: txType,
        amount,
        reason: txReason || undefined,
        staff_name: undefined,
      });
      setShowTxModal(false);
      loadDrawer();
      loadTransactions();
      setMsg({
        text: `✓ ${txType === 'cash_in' ? 'Cash in' : 'Cash out'} of ${formatCurrency(amount)} recorded`,
        type: 'success',
      });
      setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to record transaction', type: 'error' });
    } finally {
      setTxSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: 140, padding: "5px 10px", borderRadius: 7,
    border: "1.5px solid var(--border-default)", textAlign: "right",
    background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13,
  };

  const rowLabel: React.CSSProperties = {
    fontSize: 10, color: "var(--text-muted)", fontWeight: 600,
  };

  const sectionStyle: React.CSSProperties = {
    padding: "1rem",
    background: "rgba(58,37,24,0.5)", backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(201,135,58,0.1)",
    borderRadius: 12,
  };

  return (
    <div className="scroll-area" style={{ padding: "0.8rem 1.2rem", display: "flex", flexDirection: "column", gap: 14, maxWidth: 520, overflowY: "auto", minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
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

      {/* Cash In / Out Buttons */}
      {drawer?.status === 'open' && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => openTxModal('cash_in')} className="btn btn-outline" style={{
            flex: 1, fontSize: 10, padding: "10px 0",
            borderColor: "var(--success)", color: "var(--success)",
          }}>
            + Cash In
          </button>
          <button onClick={() => openTxModal('cash_out')} className="btn btn-outline" style={{
            flex: 1, fontSize: 10, padding: "10px 0",
            borderColor: "var(--danger)", color: "var(--danger)",
          }}>
            − Cash Out
          </button>
          <button onClick={handleOpenDrawer} disabled={drawerStatus !== 'idle'}
            className="btn btn-gold" style={{ flex: 1, fontSize: 10, padding: "10px 0" }}>
            {drawerStatus === 'opening' ? "⟳" : "🔓 Open"}
          </button>
        </div>
      )}

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
        {drawer?.status === 'open' && (
          <>
            <button onClick={handleSave} disabled={drawerStatus === 'saving'}
              className="btn btn-outline" style={{ width: "100%", fontSize: 10, padding: "10px 0", borderColor: "var(--gold)", color: "var(--gold)" }}>
              {drawerStatus === 'saving' ? "⟳ Saving..." : "💾 Save Progress"}
            </button>

            <button onClick={handleCloseDrawer} disabled={drawerStatus === 'saving' || closingAmount === 0}
              className="btn btn-gold" style={{
                width: "100%", fontSize: 10, padding: "11px 0",
                background: closingAmount === 0 ? "rgba(80,201,80,0.15)" : "var(--success)",
                color: closingAmount === 0 ? "var(--success)" : "#fff",
              }}>
              {drawerStatus === 'saving' ? "⟳ Closing..." : "✓ Close & Balance Drawer"}
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
            <button onClick={handleOpenDrawer} disabled={drawerStatus !== 'idle'}
              className="btn btn-outline" style={{ width: "100%", fontSize: 10, padding: "10px 0" }}>
              {drawerStatus === 'opening' ? "⟳ Opening..." : "Start New Shift"}
            </button>
          </>
        )}
      </div>

      {/* ── Transaction History ────────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
            Transaction Log
          </span>
          <span style={{ fontSize: 8, color: "var(--text-faint)" }}>
            {transactions.length} entries
          </span>
        </div>
        {txLoading ? (
          <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-disabled)", fontSize: 10 }}>Loading...</div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-disabled)", fontSize: 10 }}>
            No transactions for today.
          </div>
        ) : (
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: "4px 6px", textAlign: "left", color: "var(--text-faint)", fontWeight: 600 }}>Type</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "var(--text-faint)", fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "var(--text-faint)", fontWeight: 600 }}>Balance</th>
                  <th style={{ padding: "4px 6px", textAlign: "left", color: "var(--text-faint)", fontWeight: 600 }}>Reason</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", color: "var(--text-faint)", fontWeight: 600 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "5px 6px" }}>
                      <span style={{ color: TX_COLORS[tx.transaction_type], fontWeight: 600 }}>
                        {TX_LABELS[tx.transaction_type] || tx.transaction_type}
                      </span>
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {tx.transaction_type === 'cash_in' || tx.transaction_type === 'sale' ? '+' : '−'}{formatCurrency(tx.amount)}
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: "var(--text-muted)" }}>
                      {formatCurrency(tx.balance_after)}
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "left", color: "var(--text-faint)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.reason || '—'}
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: "var(--text-faint)", whiteSpace: "nowrap" }}>
                      {new Date(tx.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cash In/Out Modal ──────────────────────────────────────────────── */}
      {showTxModal && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 998 }} onClick={() => setShowTxModal(false)} />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
            <div className="animate-scaleIn card-glass" style={{ padding: "1.5rem", width: "100%", maxWidth: 360 }}>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
                {txType === 'cash_in' ? 'Cash In' : 'Cash Out'}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 1.5, marginBottom: 5, fontWeight: 700, textTransform: "uppercase" }}>
                  Amount
                </div>
                <input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="0.00" min="0" step="0.01" autoFocus
                  style={{ width: "100%", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 1.5, marginBottom: 5, fontWeight: 700, textTransform: "uppercase" }}>
                  Reason
                </div>
                <input value={txReason} onChange={(e) => setTxReason(e.target.value)}
                  placeholder={txType === 'cash_in' ? "e.g. Cash from safe" : "e.g. Paid supplier"}
                  style={{ width: "100%", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowTxModal(false)} className="btn btn-outline" style={{ flex: 1, fontSize: 10, padding: "11px 0" }}>
                  Cancel
                </button>
                <button onClick={handleTxSubmit} disabled={txSaving || !txAmount || parseFloat(txAmount) <= 0}
                  className="btn btn-gold" style={{ flex: 1, fontSize: 10, padding: "11px 0" }}>
                  {txSaving ? "Saving..." : txType === 'cash_in' ? "Record Cash In" : "Record Cash Out"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};