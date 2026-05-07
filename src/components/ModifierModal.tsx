import React, { useState } from "react";
import { MenuItem, Modifier, CartItemModifier } from "../types";
import { formatCurrency } from "../utils";

interface Props {
  item: MenuItem;
  onAdd: (item: MenuItem, modifiers: CartItemModifier[]) => void;
  onClose: () => void;
}

export const ModifierModal: React.FC<Props> = ({ item, onAdd, onClose }) => {
  const [selected, setSelected] = useState<CartItemModifier[]>([]);

  const modifiers = item.modifiers || [];

  const toggleModifier = (mod: Modifier) => {
    const existing = selected.find(m => m.name === mod.name);
    if (existing) {
      setSelected(prev => prev.filter(m => m.name !== mod.name));
    } else {
      setSelected(prev => [...prev, { name: mod.name, price: mod.price }]);
    }
  };

  const isSelected = (mod: Modifier) =>
    selected.some(m => m.name === mod.name);

  const totalPrice = item.price + selected.reduce((s, m) => s + m.price, 0);

  const handleAdd = () => {
    onAdd(item, selected);
    onClose();
  };

  return (
    <>
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
          zIndex: 998, animation: "fadeInOverlay 0.2s ease",
        }}
        onClick={onClose}
      />
      <div style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 999, padding: "1rem",
      }}>
        <div style={{
          background: "var(--bg-elevated)",
          border: "1.5px solid var(--border-medium)",
          borderRadius: 16, padding: "1.5rem",
          width: "100%", maxWidth: 360,
          maxHeight: "90vh", overflowY: "auto",
          animation: "fadeInUp 0.2s ease",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
                fontFamily: "'Playfair Display', serif",
              }}>
                {item.emoji} {item.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>
                {formatCurrency(item.price)} base
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", color: "var(--text-muted)",
                fontSize: 18, cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Modifier list */}
          {modifiers.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, padding: "1rem 0" }}>
              No modifiers available for this item.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {modifiers.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => toggleModifier(mod)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1.5px solid ${isSelected(mod) ? "var(--gold)" : "var(--border-default)"}`,
                    background: isSelected(mod) ? "rgba(201,135,58,0.1)" : "var(--bg-surface)",
                    cursor: "pointer", textAlign: "left" as const,
                    transition: "all 0.15s",
                  }}
                >
                  {/* Checkbox indicator */}
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${isSelected(mod) ? "var(--gold)" : "var(--border-medium)"}`,
                    background: isSelected(mod) ? "var(--gold)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: 10, color: "var(--bg-sidebar)",
                  }}>
                    {isSelected(mod) ? "✓" : ""}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                      {mod.name}
                      {mod.isDefault && (
                        <span style={{
                          marginLeft: 6, fontSize: 8, fontWeight: 700,
                          color: "var(--gold)", letterSpacing: 1,
                          textTransform: "uppercase" as const,
                        }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gold)" }}>
                    {mod.price > 0 ? `+${formatCurrency(mod.price)}` : "Free"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Total + Add button */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: "8px 0", borderTop: "1px solid var(--border-default)",
            }}>
              <span style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: 1.2, textTransform: "uppercase" as const, fontWeight: 700 }}>
                Item Total
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)", fontFamily: "'Playfair Display', serif" }}>
                {formatCurrency(totalPrice)}
              </span>
            </div>
            <button
              className="btn btn-gold"
              onClick={handleAdd}
              style={{ width: "100%", padding: "10px 0" }}
            >
              Add to Cart
            </button>
            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "8px 0",
                borderRadius: 9, border: "1.5px solid var(--border-default)",
                background: "transparent", color: "var(--text-muted)",
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                cursor: "pointer", textTransform: "uppercase" as const,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};