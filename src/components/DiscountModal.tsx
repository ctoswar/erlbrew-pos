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
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 998, animation: "fadeInOverlay 0.2s ease" }} onClick={onClose} />
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
        <div className="animate-scaleIn card-glass" style={{ padding: "1.3rem", width: "100%", maxWidth: 360, maxHeight: "90vh", overflowY: "auto" }}>
          {/* Header */}
          <div className="font-display" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Apply Discount</div>
            <button onClick={onClose} className="btn-ghost" style={{ fontSize: 14, padding: "2px 5px", color: "var(--text-muted)" }}>✕</button>
          </div>

          {/* Current discount */}
          {currentDiscount && (
            <div style={{ background: "rgba(201,135,58,0.12)", border: "1px solid var(--gold)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 8, color: "var(--gold)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 1, fontWeight: 700 }}>Active Discount</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{currentDiscount.label}</div>
              </div>
              <button onClick={() => { onRemove(); onClose(); }} style={{ fontSize: 8, fontWeight: 700, padding: "4px 8px", borderRadius: 6, letterSpacing: 1, background: "var(--danger)", border: "none", color: "#fff", cursor: "pointer" }}>Remove</button>
            </div>
          )}

          {/* Subtotal */}
          <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
            Subtotal: <strong style={{ color: "var(--gold)" }}>₱{subtotal.toFixed(2)}</strong>
          </div>

          {/* Presets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {PRESET_DISCOUNTS.map((d) => {
              const savings = subtotal * (d.value / 100);
              return (
                <button key={d.type} onClick={() => applyPreset(d.type, d.label, d.value)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--border-medium)",
                    background: "var(--bg-base)", cursor: "pointer", transition: "var(--transition-fast)", width: "100%",
                  }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1 }}>{d.label}</div>
                    <div style={{ fontSize: 8, color: "var(--text-muted)" }}>{d.desc}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>−₱{savings.toFixed(2)}</div>
                </button>
              );
            })}
          </div>

          {/* Custom */}
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)} className="btn-ghost"
              style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1.5px dashed var(--border-default)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
              + Custom Discount
            </button>
          ) : (
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Custom Discount</div>
              <div style={{ marginBottom: 8 }}>
                <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Discount name" style={{ marginBottom: 6, fontSize: 11, padding: "8px 10px" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div style={{ position: "relative" }}>
                    <input type="number" value={customPct} onChange={(e) => setCustomPct(e.target.value)} placeholder="e.g. 15" min="1" max="100" style={{ paddingRight: 28, fontSize: 11, padding: "8px 28px 8px 10px" }} />
                    <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 10, pointerEvents: "none" }}>%</span>
                  </div>
                  <button onClick={applyCustomPct} disabled={!customPct || parseFloat(customPct) <= 0}
                    className="btn btn-gold" style={{ fontSize: 9, padding: "7px", borderRadius: 7 }}>Apply %</button>
                </div>
                {customPct && parseFloat(customPct) > 0 && (
                  <div style={{ fontSize: 8, color: "var(--success)", marginTop: 3 }}>Saves ₱{(subtotal * (parseFloat(customPct) / 100)).toFixed(2)}</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 10, pointerEvents: "none" }}>₱</span>
                    <input type="number" value={customFixed} onChange={(e) => setCustomFixed(e.target.value)} placeholder="e.g. 50" min="1" style={{ paddingLeft: 22, fontSize: 11, padding: "8px 10px 8px 22px" }} />
                  </div>
                  <button onClick={applyCustomFixed} disabled={!customFixed || parseFloat(customFixed) <= 0}
                    className="btn btn-gold" style={{ fontSize: 9, padding: "7px", borderRadius: 7 }}>Apply ₱</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};