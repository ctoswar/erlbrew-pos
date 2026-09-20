import React, { useState, useEffect } from "react";
import { DayRecord } from "../../types";

interface Props {
  record: DayRecord | null;
  onClose: () => void;
  onSave: (id: number, clockIn: string | null, clockOut: string | null, reason: string) => void | Promise<void>;
  saving?: boolean;
}

const toLocalInput = (d: Date | null): string => {
  if (!d) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const EditRecordModal: React.FC<Props> = ({ record, onClose, onSave, saving = false }) => {
  const [editClockIn, setEditClockIn] = useState<string | null>(null);
  const [editClockOut, setEditClockOut] = useState<string | null>(null);
  const [editReason, setEditReason] = useState<string>("");

  useEffect(() => {
    if (!record) {
      setEditClockIn(null);
      setEditClockOut(null);
      setEditReason("");
      return;
    }
    const cin = record.clock_in ? new Date(record.clock_in) : null;
    const cout = record.clock_out ? new Date(record.clock_out) : null;
    setEditClockIn(cin ? toLocalInput(cin) : null);
    setEditClockOut(cout ? toLocalInput(cout) : null);
    setEditReason("");
  }, [record]);

  if (!record) return null;

  const handleSave = async () => {
    if (!editReason || editReason.trim().length < 3) {
      alert('Please provide a reason (min 3 characters)');
      return;
    }
    await onSave(record.id, editClockIn, editClockOut, editReason);
  };

  return (
    <>
      <div className="fixed inset-0 z-[998] bg-black/60" onClick={() => { if (!saving) onClose(); }} />
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[420px]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display text-base font-bold text-erl-text-primary">Adjust Time Record</div>
              <div className="text-[11px] text-erl-text-faint">Record ID: {record.id} · {record.name}</div>
            </div>
            <button onClick={() => { if (!saving) onClose(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-text-primary hover:bg-erl-surface transition-colors">✕</button>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-3">
            <div>
              <label className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1 block">Clock In</label>
              <input type="datetime-local" value={editClockIn || ""} onChange={(e) => setEditClockIn(e.target.value || null)} className="w-full text-sm bg-erl-base border border-erl-border-medium rounded-xl px-3 py-2.5 text-erl-text-primary outline-none focus:border-erl-accent" />
            </div>
            <div>
              <label className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1 block">Clock Out (optional)</label>
              <input type="datetime-local" value={editClockOut || ""} onChange={(e) => setEditClockOut(e.target.value || null)} className="w-full text-sm bg-erl-base border border-erl-border-medium rounded-xl px-3 py-2.5 text-erl-text-primary outline-none focus:border-erl-accent" />
            </div>
            <div>
              <label className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1 block">Reason</label>
              <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Reason for adjustment (required)" className="w-full text-sm bg-erl-base border border-erl-border-medium rounded-xl px-3 py-2.5 text-erl-text-primary outline-none focus:border-erl-accent h-24" />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => { if (!saving) onClose(); }} disabled={saving} className="btn btn-outline text-xs px-4 py-2.5">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-accent text-xs px-4 py-2.5">Save Adjustment</button>
          </div>

        </div>
      </div>
    </>
  );
};

export default EditRecordModal;
