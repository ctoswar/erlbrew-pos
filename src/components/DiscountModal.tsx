import React, { useState } from "react";
import { DiscountType, Discount } from "../types";

interface Props {
  subtotal: number;
  currentDiscount: Discount | null;
  onApply: (type: DiscountType, label: string, value: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

const PRESET_DISCOUNTS: { type: DiscountType; label: string; value: number; desc: string }[] = [
  { type: "pwd",     label: "PWD Discount",       value: 20, desc: "20% off (Philippine law)" },
  { type: "senior",  label: "Senior Citizen",      value: 20, desc: "20% off (Philippine law)" },
];

export const DiscountModal: React.FC<Props> = ({ subtotal, currentDiscount, onApply, onRemove, onClose }) => {
  const [customPct, setCustomPct] = useState("");
  const [customFixed, setCustomFixed] = useState("");
  const [customLabel, setCustomLabel] = useState("Custom Discount");
  const [showCustom, setShowCustom] = useState(false);

  const applyPreset = (type: DiscountType, label: string, value: number) => {
    onApply(type, label, value);
    onClose();
  };

  const applyCustomPct = () => {
    const v = parseFloat(customPct);
    if (!v || v <= 0 || v > 100) return;
    onApply("custom_pct", customLabel || `${v}% Discount`, v);
    onClose();
  };

  const applyCustomFixed = () => {
    let v = parseFloat(customFixed);
    if (!v || v <= 0) return;
    if (v > subtotal) v = subtotal; // don't exceed subtotal
    onApply("custom_fixed", customLabel || `₱${v.toFixed(0)} Discount`, v);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/65 z-[998] animate-fade-in-overlay" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="animate-scale-in card-glass p-[1.3rem] w-full max-w-[360px] max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="font-display flex items-center justify-between mb-3.5">
            <div className="text-sm font-bold text-erl-text-primary">Apply Discount</div>
            <button onClick={onClose} className="btn-ghost text-sm px-1 py-0.5 text-erl-muted">✕</button>
          </div>

          {/* Current discount */}
          {currentDiscount && (
            <div className="bg-erl-accent/10 border border-erl-accent rounded-lg px-3 py-2 mb-2.5 flex items-center justify-between">
              <div>
                <div className="text-[8px] text-erl-accent tracking-wide uppercase font-bold mb-px">Active Discount</div>
                <div className="text-[11px] font-semibold text-erl-text-primary">{currentDiscount.label}</div>
              </div>
              <button onClick={() => { onRemove(); onClose(); }} className="text-[8px] font-bold px-2 py-1 rounded-md bg-erl-danger text-white cursor-pointer">Remove</button>
            </div>
          )}

          {/* Subtotal */}
          <div className="text-[8px] text-erl-muted tracking-widest uppercase mb-2.5">
            Subtotal: <strong className="text-erl-accent">₱{subtotal.toFixed(2)}</strong>
          </div>

          {/* Presets */}
          <div className="flex flex-col gap-1.5 mb-3">
            {PRESET_DISCOUNTS.map((d) => {
              const savings = subtotal * (d.value / 100);
              return (
                <button key={d.type} onClick={() => applyPreset(d.type, d.label, d.value)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border-[1.5px] border-erl-border-medium bg-erl-base cursor-pointer transition-all duration-150 w-full text-left hover:border-erl-accent">
                  <div>
                    <div className="text-[11px] font-semibold text-erl-text-primary mb-px">{d.label}</div>
                    <div className="text-[8px] text-erl-muted">{d.desc}</div>
                  </div>
                  <div className="text-sm font-bold text-erl-success">−₱{savings.toFixed(2)}</div>
                </button>
              );
            })}
          </div>

          {/* Custom */}
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)} className="btn-ghost w-full py-2 rounded-lg border-[1.5px] border-dashed border-erl-border-default text-[9px] font-bold tracking-wide uppercase">
              + Custom Discount
            </button>
          ) : (
            <div className="border-t border-erl-border-subtle pt-3">
              <div className="text-[9px] text-erl-muted tracking-widest uppercase mb-2">Custom Discount</div>
              <div className="mb-2">
                <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Discount name" className="mb-1.5 text-[11px] px-2.5 py-2 text-erl-text-primary" />
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input type="number" value={customPct} onChange={(e) => setCustomPct(e.target.value)} placeholder="e.g. 15" min="1" max="100" className="pr-7 text-[11px] px-2.5 py-2" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-erl-muted text-[10px] pointer-events-none">%</span>
                  </div>
                  <button onClick={applyCustomPct} disabled={!customPct || parseFloat(customPct) <= 0}
                    className="btn btn-accent text-[9px] py-[7px] rounded-md">Apply %</button>
                </div>
                {customPct && parseFloat(customPct) > 0 && (
                  <div className="text-[8px] text-erl-success mt-[3px]">Saves ₱{(subtotal * (parseFloat(customPct) / 100)).toFixed(2)}</div>
                )}
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-erl-muted text-[10px] pointer-events-none">₱</span>
                    <input type="number" value={customFixed} onChange={(e) => setCustomFixed(e.target.value)} placeholder="e.g. 50" min="1" className="pl-5 text-[11px] px-2.5 py-2" />
                  </div>
                  <button onClick={applyCustomFixed} disabled={!customFixed || parseFloat(customFixed) <= 0}
                    className="btn btn-accent text-[9px] py-[7px] rounded-md">Apply ₱</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
