import React, { useState } from "react";

export interface PrintSettings {
  paperSize: "58mm" | "80mm";
  showStoreHeader: boolean;
  showBIRInfo: boolean;
  showCustomerCopy: boolean;
  showQRCode: boolean;
  printCopies: number;
  /** Where to send print jobs: browser opens OS print dialog; bluetooth calls print-server.py on the Pi */
  printVia: "browser" | "bluetooth";
  /** GCash reference number for e-wallet payments */
  gcashNumber: string;
}

const DEFAULT_SETTINGS: PrintSettings = {
  paperSize: "80mm",
  showStoreHeader: true,
  showBIRInfo: true,
  showCustomerCopy: true,
  showQRCode: false,
  printCopies: 1,
  printVia: "browser",
  gcashNumber: "",
};

const STORAGE_KEY = "erlbrew_print_settings";

function loadSettings(): PrintSettings {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(s: PrintSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function loadPrintSettings(): PrintSettings {
  return loadSettings();
}

export const AdminPrintSettings: React.FC = () => {
  const [settings, setSettings] = useState<PrintSettings>(loadSettings);

  const update = (patch: Partial<PrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const toggle = (key: keyof PrintSettings) => {
    if (typeof settings[key] === "boolean") {
      update({ [key]: !settings[key] } as Partial<PrintSettings>);
    }
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid var(--border-subtle)",
    fontSize: 11,
    color: "var(--text-primary)",
  };

  const labelStyle: React.CSSProperties = { fontWeight: 600, color: "var(--text-primary)" };
  const subStyle: React.CSSProperties = { fontSize: 9, color: "var(--text-muted)", marginTop: 2 };

  return (
    <div style={{ padding: "1.5rem 2rem", overflowY: "auto", flex: 1 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--gold)", marginBottom: 4 }}>
          Receipt Print Settings
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
          Changes apply to all future print jobs.
        </div>
      </div>

      {/* ── Paper Size ─────────────────────────────────────── */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Paper Size</div>
          <div style={subStyle}>Thermal receipt width</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["58mm", "80mm"] as const).map((size) => (
            <button
              key={size}
              onClick={() => update({ paperSize: size })}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: `1.5px solid ${settings.paperSize === size ? "var(--gold)" : "var(--border-default)"}`,
                background: settings.paperSize === size ? "rgba(201,135,58,0.15)" : "transparent",
                color: settings.paperSize === size ? "var(--gold)" : "var(--text-muted)",
                fontSize: 9,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* ── Copies ─────────────────────────────────────────── */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Print Copies</div>
          <div style={subStyle}>Number of copies per receipt</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => update({ printCopies: Math.max(1, settings.printCopies - 1) })}
            style={{
              width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-default)",
              background: "transparent", color: "var(--gold)", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >−</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)", minWidth: 20, textAlign: "center" }}>
            {settings.printCopies}
          </span>
          <button
            onClick={() => update({ printCopies: Math.min(5, settings.printCopies + 1) })}
            style={{
              width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-default)",
              background: "transparent", color: "var(--gold)", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >+</button>
        </div>
      </div>

      {/* ── Print Via ────────────────────────────────────────── */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Print Method</div>
          <div style={subStyle}>Browser opens OS dialog; Bluetooth calls print-server.py</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["browser", "bluetooth"] as const).map((method) => (
            <button
              key={method}
              onClick={() => update({ printVia: method })}
              style={{
                padding: "6px 14px", borderRadius: 8,
                border: `1.5px solid ${settings.printVia === method ? "var(--gold)" : "var(--border-default)"}`,
                background: settings.printVia === method ? "rgba(201,135,58,0.15)" : "transparent",
                color: settings.printVia === method ? "var(--gold)" : "var(--text-muted)",
                fontSize: 9, fontWeight: 700, cursor: "pointer", letterSpacing: 1,
              }}
            >
              {method === "browser" ? "🖥 Browser" : "📡 Bluetooth"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bluetooth Print Server URL ───────────────────────── */}
      {settings.printVia === "bluetooth" && (
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Print Server URL</div>
            <div style={subStyle}>Running on your Pi — e.g. http://192.168.75.101:9100</div>
          </div>
        </div>
      )}

      {/* ── GCash Reference Number ─────────────────────────────────── */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>GCash Reference Number</div>
          <div style={subStyle}>Shown on E-Wallet payment screen</div>
        </div>
        <input
          type="text"
          value={settings.gcashNumber}
          onChange={(e) => update({ gcashNumber: e.target.value })}
          placeholder="e.g. 0917-123-4567"
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            fontSize: 11,
          }}
        />
      </div>

      {/* ── Toggle rows ─────────────────────────────────────── */}
      {([
        ["showStoreHeader", "Store Header", "Cafe name, address, TIN on receipt"],
        ["showBIRInfo", "BIR Accreditation Info", "ATP No., COR No., Serial, PTU, Machine"],
        ["showCustomerCopy", "Customer Copy Footer", "Thank you + customer copy note"],
        ["showQRCode", "QR Code Placeholder", "Show QR panel on receipt"],
      ] as [keyof PrintSettings, string, string][]).map(([key, label, desc]) => (
        <div key={key} style={{ ...rowStyle, borderBottom: "none", paddingTop: 12, paddingBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={labelStyle}>{label}</div>
            <div style={subStyle}>{desc}</div>
          </div>
          <button
            onClick={() => toggle(key)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              background: settings[key] ? "var(--gold)" : "var(--border-medium)",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute",
              top: 3,
              left: settings[key] ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: settings[key] ? "var(--bg-sidebar)" : "var(--text-muted)",
              transition: "left 0.2s",
            }} />
          </button>
        </div>
      ))}

      {/* ── Preview hint ─────────────────────────────────────── */}
      <div style={{
        marginTop: 24, padding: "12px 14px",
        background: "var(--bg-surface)", borderRadius: 10,
        border: "1px solid var(--border-subtle)",
        fontSize: 9, color: "var(--text-muted)", lineHeight: 1.7,
      }}>
        💡 <strong style={{ color: "var(--text-secondary)" }}>Tip:</strong> After placing an order, tap
        "Print Receipt" to preview and print. The settings above control what appears on the printed receipt.
      </div>
    </div>
  );
};