import React, { useState, useEffect, useRef } from "react";
import { Staff, Role } from "../types";
import { useClock } from "../hooks/useClock";
import { useFullscreen } from "../hooks/useFullscreen";
import { formatTime, formatDate } from "../utils";
import { apiPost, apiGet, setAuthToken } from "../utils/api";
import { unlockAudio } from "../utils/sound";
import { useLocation } from "../contexts/LocationContext";

interface CompanyInfo {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo: string;
}

interface RfidStaffResponse {
  id: number;
  rfid: string;
  name: string;
  role: Role;
  initials: string;
  color: string;
  location_id?: number | null;
}

interface Props {
  onLogin: (staff: Staff) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const { locations, loading: locationsLoading, isDeviceConfigured, configureDeviceLocation } = useLocation();
  const time = useClock();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [company] = useState<CompanyInfo>(() => {
    try {
      const s = localStorage.getItem("erlbrew_company_settings");
      return s
        ? JSON.parse(s)
        : { company_name: "Erlbrew", company_address: "", company_phone: "", company_email: "", company_logo: "" };
    } catch {
      return { company_name: "Erlbrew", company_address: "", company_phone: "", company_email: "", company_logo: "" };
    }
  });

  const [rfid, setRfid] = useState("");
  const [pin, setPin] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [msg, setMsg] = useState({ text: "", type: "info" as "info" | "error" | "success" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"rfid" | "pin">("rfid");
  const [setupLocationId, setSetupLocationId] = useState("");
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);

  const rfidInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const branchMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rfidInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === "rfid") {
      rfidInputRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (step === "pin" && selectedStaff) {
      pinInputRef.current?.focus();
    }
  }, [step, selectedStaff]);

  useEffect(() => {
    if (!branchMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!branchMenuRef.current?.contains(event.target as Node)) setBranchMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [branchMenuOpen]);

  const handleRfidSubmit = async (rfidValue: string) => {
    const trimmed = rfidValue.replace(/[\x00-\x1f]/g, "").trim().toUpperCase();
    if (!trimmed) return;
    try {
      const found = await apiGet<RfidStaffResponse>(`/staff/rfid/${encodeURIComponent(trimmed)}`);
      if (!found || !found.id) {
        setMsg({ text: "Card not registered. See admin.", type: "error" });
        setRfid("");
        return;
      }
      const staff: Staff = { ...found, pin: "", locationId: found.location_id ?? null };
      setSelectedStaff(staff);
      setRfid(trimmed);
      setStep("pin");
      setMsg({ text: `${found.name} \u2014 enter your PIN`, type: "info" });
      pinInputRef.current?.focus();
    } catch {
      setMsg({ text: "Card not recognized. Try again.", type: "error" });
      setRfid("");
    }
  };

  const handleRfidKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleRfidSubmit(rfid);
  };

  const pressPin = (key: string) => {
    if (key === "CLR") { setPin(""); return; }
    if (key === "\u232B") { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length < 4) setPin((p) => p + key);
  };

  const submitLogin = () => {
    if (!selectedStaff || pin.length !== 4) return;
    // Autoplay policy: create/resume the shared AudioContext from this user gesture
    unlockAudio();
    setLoading(true);
    apiPost<{ token: string; clockAction?: string }>("/staff/login", {
      rfid: selectedStaff.rfid,
      pin,
    })
      .then((data) => {
        if (data?.token) {
          setAuthToken(data.token);
          const clockMsg = data.clockAction === "clock_in" ? " \u2713 Clocked in!" : "";
          setMsg({ text: `Welcome, ${selectedStaff.name}${clockMsg}`, type: "success" });
          setTimeout(() => {
            setLoading(false);
            onLogin(selectedStaff);
          }, 700);
        } else {
          throw new Error("No token");
        }
      })
      .catch((error: unknown) => {
        setLoading(false);
        const message = error instanceof Error && error.message.includes("not assigned")
          ? "This staff account is not assigned to a branch. Ask a manager."
          : "Incorrect PIN. Try again.";
        setMsg({ text: message, type: "error" });
        setPin("");
      });
  };

  const goBack = () => {
    setStep("rfid");
    setSelectedStaff(null);
    setPin("");
    setMsg({ text: "", type: "info" });
    rfidInputRef.current?.focus();
  };

  const msgColor =
    msg.type === "error"
      ? "text-erl-danger"
      : msg.type === "success"
        ? "text-erl-success"
        : "text-erl-text-muted";

  if (!isDeviceConfigured) {
    const activeLocations = locations.filter((location) => location.is_active);
    const selectedLocationId = setupLocationId || String(
      activeLocations.find((location) => location.is_default)?.id ?? activeLocations[0]?.id ?? ""
    );

    return (
      <div className="flex h-screen bg-erl-base overflow-hidden relative items-center justify-center p-5">
        <div className="card-glass w-full max-w-[420px] p-8 md:p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-erl-accent/10 border border-erl-accent/20 flex items-center justify-center text-2xl">
            ☕
          </div>
          <p className="text-[9px] text-erl-accent tracking-[0.25em] uppercase font-bold mb-3">Terminal setup</p>
          <h1 className="font-display text-2xl font-bold text-erl-text-primary mb-3">Choose this branch</h1>
          <p className="text-sm text-erl-text-muted leading-relaxed mb-7">
            Set this device&apos;s branch once. Managers can switch branches later; staff accounts remain locked to their assigned branch.
          </p>
          {locationsLoading ? (
            <div className="text-sm text-erl-text-muted py-5">Loading branches…</div>
          ) : activeLocations.length === 0 ? (
            <div className="text-sm text-erl-danger py-5">No active branches are configured. Ask a manager to add one.</div>
          ) : (
            <>
              <div ref={branchMenuRef} className="relative mb-4 text-left">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={branchMenuOpen}
                  onClick={() => setBranchMenuOpen((open) => !open)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setBranchMenuOpen(false);
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      setBranchMenuOpen(true);
                    }
                  }}
                  className={`group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm text-erl-text-primary outline-none transition-all duration-300 ${
                    branchMenuOpen
                      ? "border-erl-accent bg-erl-surface shadow-[0_0_0_4px_rgba(196,149,106,0.1),0_12px_32px_rgba(0,0,0,0.25)]"
                      : "border-erl-border-medium bg-erl-base/80 hover:border-erl-accent/70 hover:bg-erl-surface"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-erl-accent/20 bg-erl-accent/10 text-sm text-erl-accent">⌖</span>
                    <span className="truncate">{activeLocations.find((location) => String(location.id) === selectedLocationId)?.name}</span>
                  </span>
                  <span className={`ml-3 text-erl-accent transition-transform duration-300 ${branchMenuOpen ? "rotate-180" : ""}`}>⌄</span>
                </button>
                {branchMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Choose branch"
                    className="branch-select-menu absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-erl-accent/30 bg-[#24150d]/[.98] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.5),0_0_28px_rgba(196,149,106,0.1)] backdrop-blur-xl"
                  >
                    {activeLocations.map((location, index) => {
                      const isSelected = String(location.id) === selectedLocationId;
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          key={location.id}
                          style={{ animationDelay: `${index * 45}ms` }}
                          onClick={() => {
                            setSetupLocationId(String(location.id));
                            setBranchMenuOpen(false);
                          }}
                          className={`branch-select-option flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                            isSelected
                              ? "bg-erl-accent/15 text-erl-accent"
                              : "text-erl-text-secondary hover:bg-white/[0.06] hover:pl-4 hover:text-erl-text-primary"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className={`h-1.5 w-1.5 rounded-full transition-all ${isSelected ? "bg-erl-accent shadow-[0_0_8px_rgba(196,149,106,0.9)]" : "bg-erl-text-faint"}`} />
                            {location.name}
                          </span>
                          {isSelected && <span className="text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => configureDeviceLocation(Number(selectedLocationId))}
                disabled={!selectedLocationId}
                className="btn btn-accent w-full py-3 text-xs tracking-[0.15em] uppercase font-bold disabled:opacity-40"
              >
                Save terminal branch
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-erl-base overflow-hidden relative">
      {/* Ambient background */}
      <div className="absolute top-[-8%] right-[-5%] w-[600px] h-[600px] rounded-full bg-erl-accent/[0.025] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[15%] w-[500px] h-[500px] rounded-full bg-erl-accent/[0.015] blur-[100px] pointer-events-none" />

      {/* Left Brand Sidebar */}
      <aside className="glass-panel hidden md:flex w-[240px] shrink-0 flex-col items-center justify-center p-8 relative overflow-hidden border-r border-erl-accent/[0.06]">
        {/* Radial decorative glow */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_30%,rgba(196,149,106,0.06)_0%,transparent_60%),radial-gradient(ellipse_at_50%_75%,rgba(196,149,106,0.03)_0%,transparent_50%)]" />

        {/* Top decorative line */}
        <div className="absolute top-[8%] left-[15%] w-[70%] h-px bg-gradient-to-r from-transparent via-erl-accent/15 to-transparent" />

        {/* Brand */}
        <div className="relative z-10 flex flex-col items-center">
          {company.company_logo ? (
            <img src={company.company_logo} alt="Logo" className="w-14 h-14 mb-4 rounded-xl object-contain shadow-lg" />
          ) : (
            <div className="w-14 h-14 mb-4 rounded-xl bg-gradient-to-br from-erl-accent/15 to-erl-accent/[0.03] border border-erl-accent/10 flex items-center justify-center shadow-lg shadow-erl-accent/5">
              <CoffeeSVG />
            </div>
          )}

          <h1 className="font-display text-2xl font-bold text-erl-accent tracking-[5px] mb-1">
            {company.company_name || "Erlbrew"}
          </h1>
          <p className="text-[7px] text-erl-accent-dim tracking-[5px] uppercase mb-8 font-bold">
            Point of Sale
          </p>
        </div>

        {/* Clock */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="font-display text-3xl font-bold text-erl-text-primary tracking-wider leading-none tabular-nums">
            {formatTime(time)}
          </div>
          <p className="text-[10px] text-erl-text-muted tracking-[2px] uppercase mt-2 font-medium">
            {formatDate(time)}
          </p>
        </div>

        {company.company_address && (
          <>
            <div className="w-10 h-px bg-erl-border-default my-6 relative z-10" />
            <p className="relative z-10 text-[9px] text-erl-text-faint tracking-[1.5px] text-center leading-relaxed max-w-[180px]">
              {company.company_address}
            </p>
          </>
        )}

        <p className="mt-auto relative z-10 text-[7px] text-erl-text-disabled tracking-[4px] uppercase font-bold">
          v2.0
        </p>

        {/* Bottom decorative line */}
        <div className="absolute bottom-[8%] left-[15%] w-[70%] h-px bg-gradient-to-r from-transparent via-erl-accent/10 to-transparent" />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-y-auto relative">
        {/* Center glow */}
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-erl-accent/[0.02] blur-[120px] pointer-events-none" />

        {/* Step 1: RFID Scan */}
        {step === "rfid" && (
          <div
            className="animate-scale-in card-glass py-8 md:py-10 px-6 md:px-10 w-full max-w-[380px] text-center relative cursor-pointer"
            onClick={() => rfidInputRef.current?.focus()}
          >
            {/* Mobile brand header */}
            <div className="flex flex-col items-center md:hidden mb-6">
              {company.company_logo ? (
                <img src={company.company_logo} alt="Logo" className="w-10 h-10 mb-2 rounded-xl object-contain shadow-lg" />
              ) : (
                <div className="w-10 h-10 mb-2 rounded-xl bg-gradient-to-br from-erl-accent/15 to-erl-accent/[0.03] border border-erl-accent/10 flex items-center justify-center shadow-lg shadow-erl-accent/5">
                  <CoffeeSVG />
                </div>
              )}
              <h1 className="font-display text-lg font-bold text-erl-accent tracking-[4px]">
                {company.company_name || "Erlbrew"}
              </h1>
              <p className="text-[6px] text-erl-accent-dim tracking-[4px] uppercase font-bold">
                Point of Sale
              </p>
            </div>
            <input
              ref={rfidInputRef}
              value={rfid}
              onChange={(e) => setRfid(e.target.value.toUpperCase())}
              onKeyDown={handleRfidKeyDown}
              className="fixed top-0 left-0 w-px h-px opacity-0 -z-10"
              autoFocus
            />

            {/* RFID Card — compact asset card */}
            <div className="relative w-[160px] h-[100px] mx-auto mb-8 perspective-[1200px]">
              {/* Ambient glow */}
              <div className="absolute -inset-3 rounded-[20px] bg-erl-accent/[0.03] blur-lg animate-pulse-glow pointer-events-none" />

              {/* Main card */}
              <div
                className="absolute inset-0 rounded-[16px] backdrop-blur-2xl transition-all duration-500 ease-out cursor-pointer hover:scale-[1.03]"
                style={{
                  background: 'linear-gradient(155deg, rgba(196,149,106,0.16) 0%, rgba(196,149,106,0.04) 35%, rgba(42,27,18,0.55) 100%)',
                  border: '1.5px solid rgba(196,149,106,0.2)',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 50px rgba(196,149,106,0.04)',
                  transform: 'rotateY(4deg) rotateX(1.5deg)',
                }}
              >
                {/* Light diffusion */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent pointer-events-none" />

                {/* Chip */}
                <div className="absolute top-4 left-4 w-7 h-5 rounded-sm overflow-hidden" style={{
                  background: 'linear-gradient(135deg, #d4a87a, #8a6a4a)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.35)',
                }}>
                  <div className="absolute inset-[2px] border border-white/15 rounded-[1px]" />
                </div>

                {/* Contactless icon */}
                <div className="absolute top-3.5 left-12 flex items-center gap-[2px]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent/40">
                    <path d="M2 12C2 6.5 6.5 2 12 2" /><path d="M6 12C6 8.7 8.7 6 12 6" /><path d="M10 12C10 10.9 10.9 10 12 10"/>
                  </svg>
                </div>

                {/* Card number dots */}
                <div className="absolute bottom-[20px] left-4 flex gap-2">
                  {[1,2,3].map((g) => (
                    <div key={g} className="flex gap-[2px]">
                      {[1,2,3].map((d) => (
                        <div key={d} className="w-[3px] h-[3px] rounded-full bg-erl-accent/20" />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Brand */}
                <div className="absolute bottom-3 right-3.5">
                  <span className="text-[7px] font-bold text-erl-accent tracking-[2px] opacity-50" style={{ fontFamily: "'Playfair Display', serif" }}>ERLBREW</span>
                </div>
              </div>

              {/* Scan line */}
              <div className="absolute -left-2 -right-2 top-[10%] h-[2px] bg-gradient-to-r from-transparent via-erl-accent to-transparent shadow-[0_0_20px_rgba(196,149,106,0.6),0_0_40px_rgba(196,149,106,0.2)] animate-scan-line rounded-full" />

              {/* Subtle bottom reflection */}
              <div className="absolute -bottom-3 left-[20%] right-[20%] h-6 bg-gradient-to-t from-erl-accent/[0.03] to-transparent rounded-full blur-lg" />
            </div>

            <h2 className="font-display text-xl font-bold text-erl-text-primary mb-2 tracking-wide">
              Tap Your Card
            </h2>
            <p className="text-xs text-erl-text-faint leading-relaxed tracking-wide max-w-[280px] mx-auto mb-6">
              Place your card near the reader to sign in, or type your ID below
            </p>

            <button
              className="btn btn-glass px-6 py-2.5 text-[10px] tracking-[3px] font-bold uppercase"
              onClick={() => handleRfidSubmit(rfid)}
            >
              Simulate Scan
            </button>

            <p className={`text-xs mt-6 tracking-wide min-h-[20px] ${msgColor}`}>
              {msg.text}
            </p>
          </div>
        )}

        {/* ── Step 2: PIN Entry ── */}
        {step === "pin" && selectedStaff && (
          <div className="animate-scale-in card-glass py-10 md:py-12 px-6 md:px-10 w-full max-w-[400px] text-center">
            {/* Mobile brand header */}
            <div className="flex flex-col items-center md:hidden mb-6">
              {company.company_logo ? (
                <img src={company.company_logo} alt="Logo" className="w-10 h-10 mb-2 rounded-xl object-contain shadow-lg" />
              ) : (
                <div className="w-10 h-10 mb-2 rounded-xl bg-gradient-to-br from-erl-accent/15 to-erl-accent/[0.03] border border-erl-accent/10 flex items-center justify-center shadow-lg shadow-erl-accent/5">
                  <CoffeeSVG />
                </div>
              )}
              <h1 className="font-display text-lg font-bold text-erl-accent tracking-[4px]">
                {company.company_name || "Erlbrew"}
              </h1>
              <p className="text-[6px] text-erl-accent-dim tracking-[4px] uppercase font-bold">
                Point of Sale
              </p>
            </div>
            <button
              onClick={goBack}
              className="bg-transparent border-none text-erl-text-faint text-xs mb-8 px-4 py-2 cursor-pointer hover:text-erl-text-muted transition-colors rounded-xl hover:bg-white/[0.03] flex items-center gap-2 mx-auto"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>

            {/* Staff card */}
            <div className="flex items-center gap-4 mb-10 text-left bg-erl-surface/60 rounded-2xl p-4 border border-erl-border-subtle">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${selectedStaff.color || "#c4956a"}, ${selectedStaff.color || "#c4956a"}bb)`,
                  boxShadow: `0 6px 20px ${(selectedStaff.color || "#c4956a")}35, inset 0 1px 0 rgba(255,255,255,0.15)`,
                }}
              >
                {selectedStaff.initials}
              </div>
              <div>
                <div className="text-lg font-bold text-erl-text-primary font-display">{selectedStaff.name}</div>
                <div className="text-xs text-erl-text-muted tracking-wide mt-0.5">{selectedStaff.role}</div>
              </div>
            </div>

            <p className="text-[10px] text-erl-accent tracking-[5px] uppercase mb-6 font-bold">
              Enter Your PIN
            </p>

            {/* PIN dots */}
            <div className="flex justify-center gap-4 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-[28px] font-bold transition-all duration-300 ease-out ${
                    i < pin.length
                      ? "bg-erl-accent/10 border-2 border-erl-accent text-erl-accent shadow-[0_0_24px_rgba(196,149,106,0.12)]"
                      : "bg-erl-base border-2 border-erl-border-default"
                  }`}
                >
                  {i < pin.length ? "\u2022" : ""}
                </div>
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "\u232B"] as string[]).map((k) => (
                <button
                  key={k}
                  className={`btn text-[20px] py-3 md:py-4 rounded-2xl border transition-all duration-200 ease-out font-semibold ${
                    k === "CLR" || k === "\u232B"
                      ? "bg-erl-base border-erl-border-default text-erl-text-muted hover:bg-erl-elevated hover:text-erl-text-secondary text-sm"
                      : "bg-erl-surface border-erl-border-subtle text-erl-text-primary hover:bg-erl-accent/8 hover:text-erl-accent hover:border-erl-accent/20"
                  } ${loading ? "cursor-not-allowed opacity-40" : "cursor-pointer active:scale-95"}`}
                  onClick={() => !loading && pressPin(k)}
                  disabled={loading}
                >
                  {k}
                </button>
              ))}
            </div>

            <button
              className="btn btn-accent w-full text-[11px] py-4 rounded-2xl tracking-[0.2em] font-bold disabled:opacity-30"
              onClick={submitLogin}
              disabled={loading || pin.length !== 4}
            >
              {loading ? "Authenticating\u2026" : "Sign In"}
            </button>

            <p className={`text-xs mt-5 tracking-wide min-h-[20px] ${msgColor}`}>
              {msg.text}
            </p>
          </div>
        )}
      </main>

      <button
        onClick={toggleFullscreen}
        className="fixed bottom-4 right-4 z-50 btn-ghost text-sm py-2 px-3 rounded-xl transition-all duration-200 opacity-40 hover:opacity-100"
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? "✕" : "⛶"}
      </button>
    </div>
  );
};

const CoffeeSVG: React.FC = () => (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent">
    <rect x="10" y="18" width="22" height="20" rx="4" />
    <path d="M32 22C38 22 40 26 38 29C36 32 32 32 32 32" />
    <path d="M14 18C14 14.5 17.5 12 21 14C23 11 28 11 28 14C31 12 34 14.5 34 18" opacity="0.4" />
  </svg>
);