import React, { useState, useEffect } from "react";
import { getCompanySettings, updateCompanySettings } from "../utils/api";
import { useTheme } from "../hooks/useTheme";
import { useFontSize, FONT_SIZE_LABELS, type FontSize } from "../hooks/useFontSize";

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

interface CompanyInfo {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo: string;
  print_server_url: string;
}

function loadCompanySettings(): CompanyInfo {
  try {
    const s = localStorage.getItem("erlbrew_company_settings");
    return s ? JSON.parse(s) : { company_name: 'Erlbrew Cafe', company_address: '', company_phone: '', company_email: '', company_logo: '', print_server_url: '' };
  } catch { return { company_name: 'Erlbrew Cafe', company_address: '', company_phone: '', company_email: '', company_logo: '', print_server_url: '' }; }
}

function saveCompanySettingsLocal(s: CompanyInfo) {
  localStorage.setItem("erlbrew_company_settings", JSON.stringify(s));
}

export const AdminPrintSettings: React.FC = () => {
  const [settings, setSettings] = useState<PrintSettings>(loadSettings);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(loadCompanySettings);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const { theme, setThemeByName } = useTheme();
  const { fontSize, setFontSize } = useFontSize();

  // Load company info from server on mount
  useEffect(() => {
    getCompanySettings()
      .then((data: any) => {
        const info = {
          company_name: data.company_name || 'Erlbrew Cafe',
          company_address: data.company_address || '',
          company_phone: data.company_phone || '',
          company_email: data.company_email || '',
          company_logo: data.company_logo || '',
          print_server_url: data.print_server_url || '',
        };
        setCompanyInfo(info);
        if (info.company_logo) setLogoPreview(info.company_logo);
        saveCompanySettingsLocal(info);
      })
      .catch(() => {});
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCompanyError("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setCompanyInfo(c => ({ ...c, company_logo: base64 }));
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    setCompanyError("");
    try {
      await updateCompanySettings(companyInfo);
      saveCompanySettingsLocal(companyInfo);
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 2000);
    } catch (e: any) {
      setCompanyError(e.message || "Failed to save");
    } finally {
      setSavingCompany(false);
    }
  };

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
      {/* ── Theme Toggle ─────────────────────────────────────── */}
      <div style={{ marginBottom: 24, padding: "14px 16px", background: "var(--bg-surface)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
            App Theme
          </div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
            Toggle between brown and white theme across all screens
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setThemeByName("brown")}
            style={{
              padding: "8px 16px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
              borderRadius: 8,
              border: `1.5px solid ${theme === "brown" ? "var(--gold)" : "var(--border-default)"}`,
              background: theme === "brown" ? "rgba(201,135,58,0.15)" : "transparent",
              color: theme === "brown" ? "var(--gold)" : "var(--text-muted)",
              cursor: "pointer",
              textTransform: "uppercase" as const,
            }}
          >
            ☕ Brown
          </button>
          <button
            onClick={() => setThemeByName("white")}
            style={{
              padding: "8px 16px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
              borderRadius: 8,
              border: `1.5px solid ${theme === "white" ? "var(--gold)" : "var(--border-default)"}`,
              background: theme === "white" ? "rgba(201,135,58,0.15)" : "transparent",
              color: theme === "white" ? "var(--gold)" : "var(--text-muted)",
              cursor: "pointer",
              textTransform: "uppercase" as const,
            }}
          >
            ☁️ White
          </button>
        </div>
      </div>

      {/* ── Font Size ──────────────────────────────────────── */}
      <div style={{ marginBottom: 24, padding: "14px 16px", background: "var(--bg-surface)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
            Font Size
          </div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
            Adjust text size across all screens for better readability
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(['small', 'normal', 'large', 'extra-large'] as FontSize[]).map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              style={{
                width: 40,
                height: 36,
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 8,
                border: `1.5px solid ${fontSize === size ? "var(--gold)" : "var(--border-default)"}`,
                background: fontSize === size ? "rgba(201,135,58,0.15)" : "transparent",
                color: fontSize === size ? "var(--gold)" : "var(--text-muted)",
                cursor: "pointer",
                textTransform: "uppercase" as const,
              }}
            >
              {FONT_SIZE_LABELS[size]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Company Info & Logo ────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--gold)", marginBottom: 4 }}>
          Company Information
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 16 }}>
          Shown on invoices and receipts. Upload your logo to appear on printed documents.
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 16 }}>
          {/* Logo Preview */}
          <div style={{
            width: 100,
            height: 100,
            border: "2px dashed var(--border-medium)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-base)",
            overflow: "hidden",
            flexShrink: 0,
          }}>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 32 }}>🏪</span>
            )}
          </div>

          {/* Logo Upload */}
          <div style={{ flex: 1 }}>
            <input type="file" accept="image/*" onChange={handleLogoChange} id="logo-upload" style={{ display: "none" }} />
            <label htmlFor="logo-upload" style={{
              display: "inline-block",
              padding: "8px 16px",
              fontSize: 9,
              borderRadius: 8,
              border: "1px solid var(--gold)",
              background: "rgba(201,135,58,0.15)",
              color: "var(--gold)",
              cursor: "pointer",
              fontWeight: 700,
              letterSpacing: 1,
              marginRight: 8,
            }}>
              Upload Logo
            </label>
            {logoPreview && (
              <button onClick={() => { setCompanyInfo(c => ({ ...c, company_logo: "" })); setLogoPreview(null); }} style={{
                padding: "8px 16px",
                fontSize: 9,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}>
                Remove
              </button>
            )}
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 8 }}>
              Square PNG/JPG recommended, max 500KB
            </div>
          </div>
        </div>

        {/* Company Info Fields */}
        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="text"
            value={companyInfo.company_name}
            onChange={(e) => setCompanyInfo(c => ({ ...c, company_name: e.target.value }))}
            placeholder="Company Name"
            style={{ padding: "8px 12px", fontSize: 11, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-primary)" }}
          />
          <input
            type="text"
            value={companyInfo.company_address}
            onChange={(e) => setCompanyInfo(c => ({ ...c, company_address: e.target.value }))}
            placeholder="Business Address"
            style={{ padding: "8px 12px", fontSize: 11, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-primary)" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              type="text"
              value={companyInfo.company_phone}
              onChange={(e) => setCompanyInfo(c => ({ ...c, company_phone: e.target.value }))}
              placeholder="Phone"
              style={{ padding: "8px 12px", fontSize: 11, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-primary)" }}
            />
            <input
              type="email"
              value={companyInfo.company_email}
              onChange={(e) => setCompanyInfo(c => ({ ...c, company_email: e.target.value }))}
              placeholder="Email"
              style={{ padding: "8px 12px", fontSize: 11, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {companyError && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 8, fontSize: 10, color: "var(--danger)" }}>
            {companyError}
          </div>
        )}

        <button
          onClick={handleSaveCompany}
          disabled={savingCompany}
          style={{
            marginTop: 12,
            padding: "8px 20px",
            fontSize: 9,
            borderRadius: 8,
            border: "none",
            background: "var(--gold)",
            color: "var(--bg-sidebar)",
            cursor: savingCompany ? "not-allowed" : "pointer",
            fontWeight: 700,
            letterSpacing: 1,
            opacity: savingCompany ? 0.6 : 1,
          }}
        >
          {savingCompany ? "Saving..." : companySaved ? "✓ Saved!" : "Save Company Info"}
        </button>
      </div>

      <div style={{ marginBottom: 20, marginTop: 28 }}>
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
        <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div>
            <div style={labelStyle}>Print Server URL</div>
            <div style={subStyle}>Running on your Pi — e.g. https://192.168.75.101:9100</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={companyInfo.print_server_url || ""}
              onChange={(e) => setCompanyInfo(c => ({ ...c, print_server_url: e.target.value }))}
              placeholder="https://192.168.75.101:9100"
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
            <button
              onClick={async () => {
                try {
                  await updateCompanySettings({ print_server_url: companyInfo.print_server_url || "" });
                  saveCompanySettingsLocal(companyInfo);
                  setCompanySaved(true);
                  setTimeout(() => setCompanySaved(false), 2000);
                } catch (e: any) {
                  setCompanyError(e.message || "Failed to save");
                }
              }}
              style={{
                padding: "8px 14px",
                fontSize: 9,
                borderRadius: 8,
                border: "none",
                background: "var(--gold)",
                color: "var(--bg-sidebar)",
                cursor: "pointer",
                fontWeight: 700,
                letterSpacing: 1,
                whiteSpace: "nowrap",
              }}
            >
              Save URL
            </button>
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