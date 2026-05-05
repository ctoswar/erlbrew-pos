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
        <div style={{
          background: "var(--bg-elevated)", border: "1.5px solid var(--border-medium)",
          borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 380,
          maxHeight: "90vh", overflowY: "auto", animation: "fadeInUp 0.2s ease",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Playfair Display', serif" }}>
              Apply Discount
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>

          {/* Current discount badge */}
          {currentDiscount && (
            <div style={{ background: "rgba(201,135,58,0.12)", border: "1px solid var(--gold)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--gold)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Active Discount</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{currentDiscount.label}</div>
              </div>
              <button onClick={() => { onRemove(); onClose(); }}
                style={{ background: "var(--danger)", color: "#fff", border: "none", borderRadius: 6, fontSize: 9, fontWeight: 700, padding: "5px 10px", cursor: "pointer", letterSpacing: 1 }}>
                Remove
              </button>
            </div>
          )}

          {/* Subtotal info */}
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
            Subtotal: <strong style={{ color: "var(--gold)" }}>₱{subtotal.toFixed(2)}</strong>
          </div>

          {/* Preset discounts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {PRESET_DISCOUNTS.map((d) => {
              const savings = subtotal * (d.value / 100);
              return (
                <button key={d.type} onClick={() => applyPreset(d.type, d.label, d.value)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--border-medium)",
                    background: "var(--bg-base)", cursor: "pointer", transition: "all 0.15s", width: "100%",
                  }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{d.label}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{d.desc}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--success)" }}>−₱{savings.toFixed(2)}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom toggle */}
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)}
              style={{
                width: "100%", padding: "10px", borderRadius: 9, border: "1.5px dashed var(--border-default)",
                background: "transparent", color: "var(--text-muted)", fontSize: 10, fontWeight: 700,
                letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" as const,
              }}>
              + Custom Discount
            </button>
          ) : (
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
                Custom Discount
              </div>
              <div style={{ marginBottom: 10 }}>
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Discount name"
                  style={{ width: "100%", marginBottom: 8, background: "var(--bg-base)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 12 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      value={customPct}
                      onChange={(e) => setCustomPct(e.target.value)}
                      placeholder="e.g. 15"
                      min="1" max="100"
                      style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 12, paddingRight: 30 }}
                    />
                    <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 11, pointerEvents: "none" }}>%</span>
                  </div>
                  <button onClick={applyCustomPct} disabled={!customPct || parseFloat(customPct) <= 0}
                    style={{ background: "var(--gold)", color: "var(--bg-sidebar)", border: "none", borderRadius: 8, padding: "8px", fontSize: 10, fontWeight: 700, cursor: parseFloat(customPct) > 0 ? "pointer" : "not-allowed", opacity: parseFloat(customPct) > 0 ? 1 : 0.5 }}>
                    Apply %
                  </button>
                </div>
                {customPct && parseFloat(customPct) > 0 && (
                  <div style={{ fontSize: 9, color: "var(--success)", marginTop: 4 }}>
                    Saves ₱{(subtotal * (parseFloat(customPct) / 100)).toFixed(2)}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 11, pointerEvents: "none" }}>₱</span>
                    <input
                      type="number"
                      value={customFixed}
                      onChange={(e) => setCustomFixed(e.target.value)}
                      placeholder="e.g. 50"
                      min="1"
                      style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 12, paddingLeft: 24 }}
                    />
                  </div>
                  <button onClick={applyCustomFixed} disabled={!customFixed || parseFloat(customFixed) <= 0}
                    style={{ background: "var(--gold)", color: "var(--bg-sidebar)", border: "none", borderRadius: 8, padding: "8px", fontSize: 10, fontWeight: 700, cursor: parseFloat(customFixed) > 0 ? "pointer" : "not-allowed", opacity: parseFloat(customFixed) > 0 ? 1 : 0.5 }}>
                    Apply ₱
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};