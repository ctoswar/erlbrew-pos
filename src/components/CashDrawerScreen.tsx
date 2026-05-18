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

  // Cash In/Out

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

  return (
    <div className="scroll-area px-5 py-3 flex flex-col gap-3.5 w-full max-w-[520px] mx-auto overflow-y-auto min-h-0">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="font-display text-sm font-bold text-erl-text-primary tracking-wide">
            Cash Drawer
          </div>
          <div className="text-[11px] text-erl-muted mt-0.5">
            {drawer?.shift_date ? `Shift: ${drawer.shift_date}` : 'No open drawer'}
          </div>
        </div>
        <span className={`pill text-[9px] ${drawer?.status === 'open' ? 'pill-success' : 'pill-muted'}`}>
          {drawer?.status === 'open' ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {msg.text && (
        <div className={`
          px-3.5 py-2 rounded-lg text-[11px] border
          ${msg.type === 'error' ? "bg-erl-danger/15 text-erl-danger border-erl-danger" : msg.type === 'success' ? "bg-erl-success/15 text-erl-success border-erl-success" : "bg-erl-accent/10 text-erl-accent border-erl-accent"}
        `}>
          {msg.text}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {[
          { label: "Opening Float", value: formatCurrency(drawer?.opening_float ?? 0) },
          { label: "Cash Sales", value: formatCurrency(drawer?.cash_sales ?? 0) },
          { label: "Payouts", value: formatCurrency(cashPayouts), highlighted: true },
        ].map(({ label, value, highlighted }) => (
          <div key={label} className="card-glass p-3">
            <div className="text-[8px] text-erl-muted tracking-wide uppercase mb-1">{label}</div>
            <div className={`text-[15px] font-bold font-display ${highlighted ? "text-erl-accent" : "text-erl-text-primary"}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Opening Float */}
      <div className="card-glass p-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-erl-muted font-semibold">Opening Float</span>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-display font-bold text-erl-accent">
              {formatCurrency(drawer?.opening_float ?? 0)}
            </span>
            {drawer?.status === 'closed' && (
              <span className="text-[8px] text-erl-muted">• Shift ended</span>
            )}
          </div>
        </div>
      </div>

      {/* Cash In / Out Buttons */}
      {drawer?.status === 'open' && (
        <div className="flex gap-2">
          <button onClick={() => openTxModal('cash_in')} className="btn btn-outline flex-1 text-[10px] py-2.5 border-erl-success text-erl-success">
            + Cash In
          </button>
          <button onClick={() => openTxModal('cash_out')} className="btn btn-outline flex-1 text-[10px] py-2.5 border-erl-danger text-erl-danger">
            − Cash Out
          </button>
          <button onClick={handleOpenDrawer} disabled={drawerStatus !== 'idle'}
            className="btn btn-accent flex-1 text-[10px] py-2.5">
            {drawerStatus === 'opening' ? "⟳" : "🔓 Open"}
          </button>
        </div>
      )}

      {/* Cash Payouts */}
      <div className="card-glass p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <span className="text-[10px] text-erl-muted font-semibold">Cash Payouts (–)</span>
          <input
            type="number"
            value={cashPayouts}
            onChange={(e) => setCashPayouts(Number(e.target.value) || 0)}
            disabled={drawer?.status === 'closed'}
            className="w-full sm:w-[140px] py-[5px] px-2.5 rounded-md border-[1.5px] border-erl-border-default text-right bg-erl-base text-erl-text-primary text-[13px]"
          />
        </div>
      </div>

      {/* Expected */}
      <div className="card-glass p-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-erl-secondary">Expected Cash</span>
          <span className="text-base font-bold text-erl-text-primary font-display">
            {formatCurrency(expected)}
          </span>
        </div>
      </div>

      {/* Actual / Variance */}
      <div className="card-glass p-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span className="text-[10px] text-erl-muted font-semibold">Actual Cash (counted)</span>
            <input
              type="number"
              value={closingAmount}
              onChange={(e) => setClosingAmount(Number(e.target.value) || 0)}
              disabled={drawer?.status === 'closed'}
              className="w-full sm:w-[140px] py-[5px] px-2.5 rounded-md border-[1.5px] border-erl-border-default text-right bg-erl-base text-erl-text-primary text-[13px]"
            />
          </div>
          <div className="h-px bg-erl-border-default" />
          <div className="flex justify-between items-center">
            <span className={`text-[10px] font-bold ${variance === 0 ? "text-erl-success" : Math.abs(variance) > 50 ? "text-erl-danger" : "text-erl-accent"}`}>
              {variance === 0 ? "✓ Balanced" : `Variance ${variance > 0 ? '(+)' : ''}`}
            </span>
            <span className={`text-lg font-bold font-display ${variance === 0 ? "text-erl-success" : Math.abs(variance) > 50 ? "text-erl-danger" : "text-erl-accent"}`}>
              {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card-glass p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <span className="text-[10px] text-erl-muted font-semibold">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Paid supplier, petty cash..."
            disabled={drawer?.status === 'closed'}
            className="py-[5px] px-2.5 rounded-md border-[1.5px] border-erl-border-default text-left bg-erl-base text-erl-text-primary text-[11px] w-full sm:w-[260px]"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        {drawer?.status === 'open' && (
          <>
            <button onClick={handleSave} disabled={drawerStatus === 'saving'}
              className="btn btn-outline w-full text-[10px] py-2.5 border-erl-accent text-erl-accent">
              {drawerStatus === 'saving' ? "⟳ Saving..." : "💾 Save Progress"}
            </button>

            <button onClick={handleCloseDrawer} disabled={drawerStatus === 'saving' || closingAmount === 0}
              className="btn btn-accent w-full text-[10px] py-2.5"
              style={{
                background: closingAmount === 0 ? "rgba(80,201,80,0.15)" : "var(--success)",
                color: closingAmount === 0 ? "var(--success)" : "#fff",
              }}>
              {drawerStatus === 'saving' ? "⟳ Closing..." : "✓ Close & Balance Drawer"}
            </button>

            {closingAmount === 0 && (
              <div className="text-[9px] text-erl-muted text-center">
                Enter actual cash count above to close drawer
              </div>
            )}
          </>
        )}

        {drawer?.status === 'closed' && (
          <>
            <div className="text-[10px] text-erl-muted text-center py-2">
              This shift is closed. Start a new shift to open the drawer again.
            </div>
            <button onClick={handleOpenDrawer} disabled={drawerStatus !== 'idle'}
              className="btn btn-outline w-full text-[10px] py-2.5">
              {drawerStatus === 'opening' ? "⟳ Opening..." : "Start New Shift"}
            </button>
          </>
        )}
      </div>

      {/* Transaction History */}
      <div className="card-glass mt-1 p-4">
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-[10px] font-bold text-erl-text-primary tracking-wide">
            Transaction Log
          </span>
          <span className="text-[8px] text-erl-text-faint">
            {transactions.length} entries
          </span>
        </div>
        {txLoading ? (
          <div className="text-center py-4 text-erl-text-disabled text-[10px]">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-4 text-erl-text-disabled text-[10px]">
            No transactions for today.
          </div>
        ) : (
          <div className="max-h-[240px] overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse text-[9px] min-w-[480px]">
              <thead>
                <tr className="border-b border-erl-border-subtle">
                  <th className="px-1.5 py-1 text-left text-erl-text-faint font-semibold">Type</th>
                  <th className="px-1.5 py-1 text-right text-erl-text-faint font-semibold">Amount</th>
                  <th className="px-1.5 py-1 text-right text-erl-text-faint font-semibold">Balance</th>
                  <th className="px-1.5 py-1 text-left text-erl-text-faint font-semibold">Reason</th>
                  <th className="px-1.5 py-1 text-right text-erl-text-faint font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-erl-border-subtle">
                    <td className="px-1.5 py-[5px]">
                      <span className="font-semibold" style={{ color: TX_COLORS[tx.transaction_type] }}>
                        {TX_LABELS[tx.transaction_type] || tx.transaction_type}
                      </span>
                    </td>
                    <td className="px-1.5 py-[5px] text-right font-bold tabular-nums">
                      {tx.transaction_type === 'cash_in' || tx.transaction_type === 'sale' ? '+' : '−'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-1.5 py-[5px] text-right text-erl-muted">
                      {formatCurrency(tx.balance_after)}
                    </td>
                    <td className="px-1.5 py-[5px] text-left text-erl-text-faint max-w-[140px] truncate">
                      {tx.reason || '—'}
                    </td>
                    <td className="px-1.5 py-[5px] text-right text-erl-text-faint whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cash In/Out Modal */}
      {showTxModal && (
        <>
          <div className="fixed inset-0 bg-black/65 z-[998]" onClick={() => setShowTxModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
            <div className="animate-scale-in card-glass p-6 w-full max-w-[360px]">
              <div className="font-display text-sm font-bold text-erl-text-primary mb-3.5">
                {txType === 'cash_in' ? 'Cash In' : 'Cash Out'}
              </div>

              <div className="mb-3">
                <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] font-bold uppercase">
                  Amount
                </div>
                <input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="0.00" min="0" step="0.01" autoFocus
                  className="w-full box-border" />
              </div>

              <div className="mb-3.5">
                <div className="text-[9px] text-erl-accent-muted tracking-widest mb-[5px] font-bold uppercase">
                  Reason
                </div>
                <input value={txReason} onChange={(e) => setTxReason(e.target.value)}
                  placeholder={txType === 'cash_in' ? "e.g. Cash from safe" : "e.g. Paid supplier"}
                  className="w-full box-border text-erl-text-primary" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowTxModal(false)} className="btn btn-outline flex-1 text-[10px] py-2.5">
                  Cancel
                </button>
                <button onClick={handleTxSubmit} disabled={txSaving || !txAmount || parseFloat(txAmount) <= 0}
                  className="btn btn-accent flex-1 text-[10px] py-2.5">
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
