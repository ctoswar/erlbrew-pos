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
  /** URL to encode in the receipt QR code (e.g. Google survey, GCash, etc.) */
  qrCodeUrl: string;
  printCopies: number;
  /** Where to send print jobs: browser opens OS print dialog; bluetooth calls print-server.py on the Pi */
  printVia: "browser" | "bluetooth";
  /** GCash reference number for e-wallet payments */
  gcashNumber: string;
  /** Show WiFi credentials on receipt */
  showWifiInfo: boolean;
  /** WiFi network name */
  wifiSsid: string;
  /** WiFi password */
  wifiPassword: string;
  /** true = QR code for auto-connect; false = plain text SSID/password */
  wifiAsQR: boolean;
}

const DEFAULT_SETTINGS: PrintSettings = {
  paperSize: "80mm",
  showStoreHeader: true,
  showBIRInfo: true,
  showCustomerCopy: true,
  showQRCode: false,
  qrCodeUrl: "",
  printCopies: 1,
  printVia: "browser",
  gcashNumber: "",
  showWifiInfo: false,
  wifiSsid: "",
  wifiPassword: "",
  wifiAsQR: true,
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
      const msg = e.message || "";
      if (msg.includes("401") || msg.includes("NO_TOKEN") || msg.includes("INVALID_TOKEN") || msg.includes("TOKEN_EXPIRED")) {
        setCompanyError("Session expired — please log out and log in again.");
      } else {
        setCompanyError(e.message || "Failed to save");
      }
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

  return (
    <div className="scroll-area flex-1 overflow-y-auto min-h-0">
      <div className="max-w-[640px] w-full mx-auto px-4 md:px-6 py-5 flex flex-col gap-5">
        {/* ── Section: Appearance ─────────────────────────────── */}
        <SectionTitle title="Appearance" subtitle="Customize theme and text size" />

        {/* Theme Toggle */}
        <SettingsRow label="App Theme" description="Toggle between brown and white theme">
          <div className="flex gap-2">
            <button onClick={() => setThemeByName("brown")} className={`
              px-4 py-2 text-[11px] font-semibold tracking-wide rounded-xl cursor-pointer transition-all duration-200
              ${theme === "brown"
                ? "bg-erl-accent/15 border-[1.5px] border-erl-accent text-erl-accent"
                : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
              }
            `}>☕ Brown</button>
            <button onClick={() => setThemeByName("white")} className={`
              px-4 py-2 text-[11px] font-semibold tracking-wide rounded-xl cursor-pointer transition-all duration-200
              ${theme === "white"
                ? "bg-erl-accent/15 border-[1.5px] border-erl-accent text-erl-accent"
                : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
              }
            `}>☁️ White</button>
          </div>
        </SettingsRow>

        {/* Font Size */}
        <SettingsRow label="Font Size" description="Adjust text size across all screens">
          <div className="flex gap-1.5">
            {(['small', 'normal', 'large', 'extra-large'] as FontSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`
                  min-w-[40px] h-[34px] text-[11px] font-bold rounded-xl cursor-pointer transition-all duration-200 px-3
                  ${fontSize === size
                    ? "bg-erl-accent/15 border-[1.5px] border-erl-accent text-erl-accent"
                    : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
                  }
                `}
              >
                {FONT_SIZE_LABELS[size]}
              </button>
            ))}
          </div>
        </SettingsRow>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className="h-px bg-erl-border-subtle" />

        {/* ── Section: Company Information ──────────────────────── */}
        <div>
          <SectionTitle title="Company Information" subtitle="Shown on invoices and receipts. Upload a logo for printed documents." />

          {/* Logo */}
          <div className="flex gap-4 items-start mb-4">
            <div className="w-[88px] h-[88px] border-2 border-dashed border-erl-border-medium rounded-2xl flex items-center justify-center bg-erl-base/60 overflow-hidden flex-shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
              ) : (
                <span className="text-[28px]">🏪</span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <input type="file" accept="image/*" onChange={handleLogoChange} id="logo-upload" className="hidden" />
              <label htmlFor="logo-upload" className="inline-flex items-center justify-center px-4 py-2.5 text-[11px] font-semibold rounded-xl cursor-pointer transition-all border border-erl-accent bg-erl-accent/10 text-erl-accent hover:bg-erl-accent/20">
                Upload Logo
              </label>
              {logoPreview && (
                <button
                  onClick={() => { setCompanyInfo(c => ({ ...c, company_logo: "" })); setLogoPreview(null); }}
                  className="text-[11px] text-erl-text-faint hover:text-erl-danger transition-colors cursor-pointer bg-transparent border-none"
                >
                  Remove logo
                </button>
              )}
              <div className="text-[11px] text-erl-text-faint">
                Square PNG/JPG recommended, max 500KB
              </div>
            </div>
          </div>

          {/* Company Fields */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormSection label="Company Name">
                <input
                  type="text"
                  value={companyInfo.company_name}
                  onChange={(e) => setCompanyInfo(c => ({ ...c, company_name: e.target.value }))}
                  placeholder="Erlbrew Cafe"
                  className="w-full"
                />
              </FormSection>
              <FormSection label="Business Address">
                <input
                  type="text"
                  value={companyInfo.company_address}
                  onChange={(e) => setCompanyInfo(c => ({ ...c, company_address: e.target.value }))}
                  placeholder="123 Coffee Street"
                  className="w-full"
                />
              </FormSection>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormSection label="Phone">
                <input
                  type="text"
                  value={companyInfo.company_phone}
                  onChange={(e) => setCompanyInfo(c => ({ ...c, company_phone: e.target.value }))}
                  placeholder="+63 917 123 4567"
                  className="w-full"
                />
              </FormSection>
              <FormSection label="Email">
                <input
                  type="email"
                  value={companyInfo.company_email}
                  onChange={(e) => setCompanyInfo(c => ({ ...c, company_email: e.target.value }))}
                  placeholder="hello@erlbrew.cafe"
                  className="w-full"
                />
              </FormSection>
            </div>
          </div>

          {companyError && (
            <div className="mt-3 px-4 py-2.5 bg-erl-danger-bg border border-erl-danger-border rounded-xl text-[12px] text-erl-danger">
              {companyError}
            </div>
          )}

          <button
            onClick={handleSaveCompany}
            disabled={savingCompany}
            className="mt-3 btn btn-accent text-[12px] py-2.5 px-6"
          >
            {savingCompany ? "Saving…" : companySaved ? "✓ Saved!" : "Save Company Info"}
          </button>
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className="h-px bg-erl-border-subtle" />

        {/* ── Section: Print Settings ──────────────────────────── */}
        <div>
          <SectionTitle title="Receipt Print Settings" subtitle="Changes apply to all future print jobs" />

          {/* Paper Size */}
          <SettingsRow label="Paper Size" description="Thermal receipt width">
            <div className="flex gap-2">
              {(["58mm", "80mm"] as const).map((size) => (
                <button key={size} onClick={() => update({ paperSize: size })} className={`
                  px-4 py-2 rounded-xl text-[11px] font-semibold cursor-pointer transition-all duration-200
                  ${settings.paperSize === size
                    ? "bg-erl-accent/15 border-[1.5px] border-erl-accent text-erl-accent"
                    : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
                  }
                `}>{size}</button>
              ))}
            </div>
          </SettingsRow>

          {/* Print Copies */}
          <SettingsRow label="Print Copies" description="Number of copies per receipt">
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ printCopies: Math.max(1, settings.printCopies - 1) })}
                className="w-8 h-8 rounded-xl border border-erl-border-default bg-transparent text-erl-accent text-base cursor-pointer flex items-center justify-center transition-all hover:border-erl-accent/40 hover:bg-erl-accent/10 active:scale-95"
              >−</button>
              <span className="text-lg font-bold text-erl-accent min-w-[24px] text-center tabular-nums">{settings.printCopies}</span>
              <button
                onClick={() => update({ printCopies: Math.min(5, settings.printCopies + 1) })}
                className="w-8 h-8 rounded-xl border border-erl-border-default bg-transparent text-erl-accent text-base cursor-pointer flex items-center justify-center transition-all hover:border-erl-accent/40 hover:bg-erl-accent/10 active:scale-95"
              >+</button>
            </div>
          </SettingsRow>

          {/* Print Method */}
          <SettingsRow label="Print Method" description="Browser opens OS dialog; Bluetooth calls print-server.py">
            <div className="flex gap-2">
              {(["browser", "bluetooth"] as const).map((method) => (
                <button key={method} onClick={() => update({ printVia: method })} className={`
                  px-4 py-2 rounded-xl text-[11px] font-semibold cursor-pointer transition-all duration-200
                  ${settings.printVia === method
                    ? "bg-erl-accent/15 border-[1.5px] border-erl-accent text-erl-accent"
                    : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
                  }
                `}>
                  {method === "browser" ? "🖥 Browser" : "📡 Bluetooth"}
                </button>
              ))}
            </div>
          </SettingsRow>

          {/* Bluetooth URL */}
          {settings.printVia === "bluetooth" && (
            <div className="mt-3 p-4 rounded-xl bg-erl-surface border border-erl-border-subtle">
              <div className="text-[12px] font-semibold text-erl-text-primary mb-1">Print Server URL</div>
              <div className="text-[11px] text-erl-text-faint mb-3">Running on your Pi — e.g. https://192.168.75.101:9100</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={companyInfo.print_server_url || ""}
                  onChange={(e) => setCompanyInfo(c => ({ ...c, print_server_url: e.target.value }))}
                  placeholder="https://192.168.75.101:9100"
                  className="flex-1"
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
                  className="btn btn-accent text-[11px] px-4 py-2 whitespace-nowrap"
                >
                  Save URL
                </button>
              </div>
            </div>
          )}

          {/* GCash Ref */}
          <SettingsRow label="GCash Number" description="Shown on E-Wallet payment screen">
            <div className="w-full md:w-[200px]">
              <input
                type="text"
                value={settings.gcashNumber}
                onChange={(e) => update({ gcashNumber: e.target.value })}
                placeholder="e.g. 0917-123-4567"
                className="!text-[12px] w-full"
              />
            </div>
          </SettingsRow>
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className="h-px bg-erl-border-subtle" />

        {/* ── Section: Receipt Options ─────────────────────────── */}
        <div>
          <SectionTitle title="Receipt Options" subtitle="Toggle sections shown on printed receipts" />

          {([
            ["showStoreHeader", "Store Header", "Cafe name, address, and TIN on receipt"],
            ["showBIRInfo", "BIR Accreditation", "ATP No., COR No., Serial, PTU, and Machine details"],
            ["showCustomerCopy", "Customer Copy Footer", "Thank you message and customer copy note"],
          ] as [keyof PrintSettings, string, string][]).map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div className="flex flex-col mr-4">
                <div className="text-[13px] font-semibold text-erl-text-primary">{label}</div>
                <div className="text-[11px] text-erl-text-faint mt-0.5">{desc}</div>
              </div>
              <button
                onClick={() => toggle(key)}
                className="w-12 h-[26px] rounded-full border-none cursor-pointer relative flex-shrink-0 transition-colors duration-200"
                style={{ background: settings[key] ? "var(--accent)" : "var(--color-border-medium)" }}
                role="switch"
                aria-checked={!!settings[key]}
              >
                <div
                  className="absolute top-[3px] w-[20px] h-[20px] rounded-full transition-all duration-200"
                  style={{
                    left: settings[key] ? 26 : 3,
                    background: settings[key] ? "var(--bg-sidebar)" : "var(--text-muted)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>
            </div>
          ))}

          {/* QR Code toggle + URL input */}
          <div className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col mr-4">
                <div className="text-[13px] font-semibold text-erl-text-primary">QR Code</div>
                <div className="text-[11px] text-erl-text-faint mt-0.5">Show QR code on receipt (survey, payment, etc.)</div>
              </div>
              <button
                onClick={() => toggle("showQRCode")}
                className="w-12 h-[26px] rounded-full border-none cursor-pointer relative flex-shrink-0 transition-colors duration-200"
                style={{ background: settings.showQRCode ? "var(--accent)" : "var(--color-border-medium)" }}
                role="switch"
                aria-checked={settings.showQRCode}
              >
                <div
                  className="absolute top-[3px] w-[20px] h-[20px] rounded-full transition-all duration-200"
                  style={{
                    left: settings.showQRCode ? 26 : 3,
                    background: settings.showQRCode ? "var(--bg-sidebar)" : "var(--text-muted)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>
            </div>
            {settings.showQRCode && (
              <div className="mt-3 pl-1">
                <div className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold mb-1.5">QR Code URL</div>
                <input
                  type="text"
                  value={settings.qrCodeUrl}
                  onChange={(e) => update({ qrCodeUrl: e.target.value })}
                  placeholder="https://forms.gle/... or https://gcash.app/..."
                  className="w-full"
                />
                <div className="text-[11px] text-erl-text-faint mt-1.5">
                  Paste any link — Google Forms, GCash QR, feedback survey, etc.
                </div>
              </div>
            )}
          </div>

          {/* WiFi Info toggle + SSID/password + QR/text option */}
          <div className="py-3 border-t border-erl-border-subtle/60">
            <div className="flex items-center justify-between">
              <div className="flex flex-col mr-4">
                <div className="text-[13px] font-semibold text-erl-text-primary">Wi-Fi Info</div>
                <div className="text-[11px] text-erl-text-faint mt-0.5">Show cafe Wi-Fi credentials on receipt</div>
              </div>
              <button
                onClick={() => toggle("showWifiInfo")}
                className="w-12 h-[26px] rounded-full border-none cursor-pointer relative flex-shrink-0 transition-colors duration-200"
                style={{ background: settings.showWifiInfo ? "var(--accent)" : "var(--color-border-medium)" }}
                role="switch"
                aria-checked={settings.showWifiInfo}
              >
                <div
                  className="absolute top-[3px] w-[20px] h-[20px] rounded-full transition-all duration-200"
                  style={{
                    left: settings.showWifiInfo ? 26 : 3,
                    background: settings.showWifiInfo ? "var(--bg-sidebar)" : "var(--text-muted)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>
            </div>
            {settings.showWifiInfo && (
              <div className="mt-3 pl-1 flex flex-col gap-3">
                {/* QR or Text toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => update({ wifiAsQR: true })}
                    className={`px-4 py-2 rounded-xl text-[11px] font-semibold cursor-pointer transition-all duration-200 ${
                      settings.wifiAsQR
                        ? "bg-erl-accent/15 border-[1.5px] border-erl-accent text-erl-accent"
                        : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
                    }`}
                  >
                    QR Code
                  </button>
                  <button
                    onClick={() => update({ wifiAsQR: false })}
                    className={`px-4 py-2 rounded-xl text-[11px] font-semibold cursor-pointer transition-all duration-200 ${
                      !settings.wifiAsQR
                        ? "bg-erl-accent/15 border-[1.5px] border-erl-accent text-erl-accent"
                        : "border-[1.5px] border-erl-border-default bg-transparent text-erl-text-secondary hover:border-erl-border-medium"
                    }`}
                  >
                    Plain Text
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold">Wi-Fi Name (SSID)</div>
                    <input
                      type="text"
                      value={settings.wifiSsid}
                      onChange={(e) => update({ wifiSsid: e.target.value })}
                      placeholder="Erlbrew Cafe Guest"
                      className="w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold">Password</div>
                    <input
                      type="text"
                      value={settings.wifiPassword}
                      onChange={(e) => update({ wifiPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full"
                    />
                  </div>
                </div>
                {settings.wifiAsQR ? (
                  <div className="text-[11px] text-erl-text-faint">
                    Guests scan the QR to auto-join Wi-Fi (no typing needed)
                  </div>
                ) : (
                  <div className="text-[11px] text-erl-text-faint">
                    SSID and password printed as text on the receipt
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Tip ────────────────────────────────────────────── */}
        <div className="p-4 rounded-xl bg-erl-surface border border-erl-border-subtle text-[12px] text-erl-text-faint leading-relaxed">
          <strong className="text-erl-text-secondary">💡 Tip:</strong> After placing an order, tap "Print Receipt" to preview and print. The settings above control what appears on the printed receipt.
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────

const SectionTitle: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="mb-3">
    <div className="text-[13px] font-bold tracking-wider uppercase text-erl-accent">{title}</div>
    <div className="text-[11px] text-erl-text-faint mt-0.5">{subtitle}</div>
  </div>
);

const SettingsRow: React.FC<{ label: string; description: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-erl-border-subtle/60 last:border-b-0 gap-2">
    <div className="flex flex-col mr-4 min-w-0">
      <div className="text-[13px] font-semibold text-erl-text-primary">{label}</div>
      <div className="text-[11px] text-erl-text-faint mt-0.5">{description}</div>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const FormSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="text-[11px] text-erl-text-muted tracking-wider uppercase font-semibold">{label}</div>
    {children}
  </div>
);