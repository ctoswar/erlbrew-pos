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

  return (
    <div className="px-8 py-6 overflow-y-auto flex-1">
      {/* Theme Toggle */}
      <div className="mb-6 p-3.5 bg-erl-surface rounded-xl flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold text-erl-text-primary tracking-wide">
            App Theme
          </div>
          <div className="text-[9px] text-erl-muted mt-0.5">
            Toggle between brown and white theme across all screens
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setThemeByName("brown")}
            className={`
              px-4 py-2 text-[9px] font-bold tracking-wide rounded-lg cursor-pointer uppercase
              ${theme === "brown" ? "border-[1.5px] border-erl-accent bg-erl-accent/15 text-erl-accent" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-muted"}
            `}
          >
            ☕ Brown
          </button>
          <button
            onClick={() => setThemeByName("white")}
            className={`
              px-4 py-2 text-[9px] font-bold tracking-wide rounded-lg cursor-pointer uppercase
              ${theme === "white" ? "border-[1.5px] border-erl-accent bg-erl-accent/15 text-erl-accent" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-muted"}
            `}
          >
            ☁️ White
          </button>
        </div>
      </div>

      {/* Font Size */}
      <div className="mb-6 p-3.5 bg-erl-surface rounded-xl flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold text-erl-text-primary tracking-wide">
            Font Size
          </div>
          <div className="text-[9px] text-erl-muted mt-0.5">
            Adjust text size across all screens for better readability
          </div>
        </div>
        <div className="flex gap-1.5">
          {(['small', 'normal', 'large', 'extra-large'] as FontSize[]).map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`
                w-10 h-9 text-[10px] font-bold rounded-lg cursor-pointer uppercase
                ${fontSize === size ? "border-[1.5px] border-erl-accent bg-erl-accent/15 text-erl-accent" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-muted"}
              `}
            >
              {FONT_SIZE_LABELS[size]}
            </button>
          ))}
        </div>
      </div>

      {/* Company Info & Logo */}
      <div className="mb-7">
        <div className="text-[11px] font-bold tracking-widest uppercase text-erl-accent mb-1">
          Company Information
        </div>
        <div className="text-[9px] text-erl-muted mb-4">
          Shown on invoices and receipts. Upload your logo to appear on printed documents.
        </div>

        <div className="flex gap-5 items-start mb-4">
          {/* Logo Preview */}
          <div className="w-[100px] h-[100px] border-2 border-dashed border-erl-border-medium rounded-xl flex items-center justify-center bg-erl-base overflow-hidden flex-shrink-0">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[32px]">🏪</span>
            )}
          </div>

          {/* Logo Upload */}
          <div className="flex-1">
            <input type="file" accept="image/*" onChange={handleLogoChange} id="logo-upload" className="hidden" />
            <label htmlFor="logo-upload" className="inline-block px-4 py-2 text-[9px] rounded-lg border border-erl-accent bg-erl-accent/15 text-erl-accent cursor-pointer font-bold tracking-wide mr-2">
              Upload Logo
            </label>
            {logoPreview && (
              <button onClick={() => { setCompanyInfo(c => ({ ...c, company_logo: "" })); setLogoPreview(null); }} className="px-4 py-2 text-[9px] rounded-lg border border-erl-border-default bg-transparent text-erl-muted cursor-pointer">
                Remove
              </button>
            )}
            <div className="text-[9px] text-erl-muted mt-2">
              Square PNG/JPG recommended, max 500KB
            </div>
          </div>
        </div>

        {/* Company Info Fields */}
        <div className="grid gap-2.5">
          <input
            type="text"
            value={companyInfo.company_name}
            onChange={(e) => setCompanyInfo(c => ({ ...c, company_name: e.target.value }))}
            placeholder="Company Name"
            className="px-3 py-2 text-[11px] rounded-lg border border-erl-border-subtle bg-erl-base text-erl-text-primary"
          />
          <input
            type="text"
            value={companyInfo.company_address}
            onChange={(e) => setCompanyInfo(c => ({ ...c, company_address: e.target.value }))}
            placeholder="Business Address"
            className="px-3 py-2 text-[11px] rounded-lg border border-erl-border-subtle bg-erl-base text-erl-text-primary"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="text"
              value={companyInfo.company_phone}
              onChange={(e) => setCompanyInfo(c => ({ ...c, company_phone: e.target.value }))}
              placeholder="Phone"
              className="px-3 py-2 text-[11px] rounded-lg border border-erl-border-subtle bg-erl-base text-erl-text-primary"
            />
            <input
              type="email"
              value={companyInfo.company_email}
              onChange={(e) => setCompanyInfo(c => ({ ...c, company_email: e.target.value }))}
              placeholder="Email"
              className="px-3 py-2 text-[11px] rounded-lg border border-erl-border-subtle bg-erl-base text-erl-text-primary"
            />
          </div>
        </div>

        {companyError && (
          <div className="mt-2.5 px-3 py-2 bg-erl-danger-bg border border-erl-danger-border rounded-lg text-[10px] text-erl-danger">
            {companyError}
          </div>
        )}

        <button
          onClick={handleSaveCompany}
          disabled={savingCompany}
          className="mt-3 px-5 py-2 text-[9px] rounded-lg border-none bg-erl-accent text-erl-sidebar cursor-pointer font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingCompany ? "Saving..." : companySaved ? "✓ Saved!" : "Save Company Info"}
        </button>
      </div>

      <div className="mb-5 mt-7">
        <div className="text-[11px] font-bold tracking-widest uppercase text-erl-accent mb-1">
          Receipt Print Settings
        </div>
        <div className="text-[9px] text-erl-muted">
          Changes apply to all future print jobs.
        </div>
      </div>

      {/* Paper Size */}
      <div className="flex items-center justify-between py-2.5 border-b border-erl-border-subtle text-[11px] text-erl-text-primary">
        <div>
          <div className="font-semibold text-erl-text-primary">Paper Size</div>
          <div className="text-[9px] text-erl-muted mt-0.5">Thermal receipt width</div>
        </div>
        <div className="flex gap-2">
          {(["58mm", "80mm"] as const).map((size) => (
            <button
              key={size}
              onClick={() => update({ paperSize: size })}
              className={`
                px-3.5 py-1.5 rounded-lg text-[9px] font-bold cursor-pointer tracking-wide
                ${settings.paperSize === size ? "border-[1.5px] border-erl-accent bg-erl-accent/15 text-erl-accent" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-muted"}
              `}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Copies */}
      <div className="flex items-center justify-between py-2.5 border-b border-erl-border-subtle text-[11px] text-erl-text-primary">
        <div>
          <div className="font-semibold text-erl-text-primary">Print Copies</div>
          <div className="text-[9px] text-erl-muted mt-0.5">Number of copies per receipt</div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => update({ printCopies: Math.max(1, settings.printCopies - 1) })}
            className="w-7 h-7 rounded-full border border-erl-border-default bg-transparent text-erl-accent text-base cursor-pointer flex items-center justify-center"
          >−</button>
          <span className="text-base font-bold text-erl-accent min-w-[20px] text-center">
            {settings.printCopies}
          </span>
          <button
            onClick={() => update({ printCopies: Math.min(5, settings.printCopies + 1) })}
            className="w-7 h-7 rounded-full border border-erl-border-default bg-transparent text-erl-accent text-base cursor-pointer flex items-center justify-center"
          >+</button>
        </div>
      </div>

      {/* Print Via */}
      <div className="flex items-center justify-between py-2.5 border-b border-erl-border-subtle text-[11px] text-erl-text-primary">
        <div>
          <div className="font-semibold text-erl-text-primary">Print Method</div>
          <div className="text-[9px] text-erl-muted mt-0.5">Browser opens OS dialog; Bluetooth calls print-server.py</div>
        </div>
        <div className="flex gap-2">
          {(["browser", "bluetooth"] as const).map((method) => (
            <button
              key={method}
              onClick={() => update({ printVia: method })}
              className={`
                px-3.5 py-1.5 rounded-lg text-[9px] font-bold cursor-pointer tracking-wide
                ${settings.printVia === method ? "border-[1.5px] border-erl-accent bg-erl-accent/15 text-erl-accent" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-muted"}
              `}
            >
              {method === "browser" ? "🖥 Browser" : "📡 Bluetooth"}
            </button>
          ))}
        </div>
      </div>

      {/* Bluetooth Print Server URL */}
      {settings.printVia === "bluetooth" && (
        <div className="flex flex-col items-stretch gap-1.5 py-2.5 border-b border-erl-border-subtle text-[11px] text-erl-text-primary">
          <div>
            <div className="font-semibold text-erl-text-primary">Print Server URL</div>
            <div className="text-[9px] text-erl-muted mt-0.5">Running on your Pi — e.g. https://192.168.75.101:9100</div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={companyInfo.print_server_url || ""}
              onChange={(e) => setCompanyInfo(c => ({ ...c, print_server_url: e.target.value }))}
              placeholder="https://192.168.75.101:9100"
              className="flex-1 px-3 py-2 rounded-lg border border-erl-border-subtle bg-erl-base text-erl-text-primary text-[11px]"
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
              className="px-3.5 py-2 text-[9px] rounded-lg border-none bg-erl-accent text-erl-sidebar cursor-pointer font-bold tracking-wide whitespace-nowrap"
            >
              Save URL
            </button>
          </div>
        </div>
      )}

      {/* GCash Reference Number */}
      <div className="flex items-center justify-between py-2.5 border-b border-erl-border-subtle text-[11px] text-erl-text-primary">
        <div>
          <div className="font-semibold text-erl-text-primary">GCash Reference Number</div>
          <div className="text-[9px] text-erl-muted mt-0.5">Shown on E-Wallet payment screen</div>
        </div>
        <input
          type="text"
          value={settings.gcashNumber}
          onChange={(e) => update({ gcashNumber: e.target.value })}
          placeholder="e.g. 0917-123-4567"
          className="flex-1 px-3 py-2 rounded-lg border border-erl-border-subtle bg-erl-base text-erl-text-primary text-[11px]"
        />
      </div>

      {/* Toggle rows */}
      {([
        ["showStoreHeader", "Store Header", "Cafe name, address, TIN on receipt"],
        ["showBIRInfo", "BIR Accreditation Info", "ATP No., COR No., Serial, PTU, Machine"],
        ["showCustomerCopy", "Customer Copy Footer", "Thank you + customer copy note"],
        ["showQRCode", "QR Code Placeholder", "Show QR panel on receipt"],
      ] as [keyof PrintSettings, string, string][]).map(([key, label, desc]) => (
        <div key={key} className="flex items-center justify-between py-3 border-b-0">
          <div className="flex flex-col">
            <div className="font-semibold text-erl-text-primary text-[11px]">{label}</div>
            <div className="text-[9px] text-erl-muted mt-0.5">{desc}</div>
          </div>
          <button
            onClick={() => toggle(key)}
            className="w-11 h-6 rounded-full border-none cursor-pointer relative flex-shrink-0 transition-colors duration-200"
            style={{ background: settings[key] ? "var(--gold)" : "var(--border-medium)" }}
          >
            <div className="absolute top-[3px] w-[18px] h-[18px] rounded-full transition-all duration-200"
              style={{
                left: settings[key] ? 23 : 3,
                background: settings[key] ? "var(--bg-sidebar)" : "var(--text-muted)",
              }} />
          </button>
        </div>
      ))}

      {/* Preview hint */}
      <div className="mt-6 p-3 bg-erl-surface rounded-[10px] border border-erl-border-subtle text-[9px] text-erl-muted leading-relaxed">
        💡 <strong className="text-erl-secondary">Tip:</strong> After placing an order, tap
        "Print Receipt" to preview and print. The settings above control what appears on the printed receipt.
      </div>
    </div>
  );
};
