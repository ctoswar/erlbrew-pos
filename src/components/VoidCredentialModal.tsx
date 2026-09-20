import React, { useState, useRef, useEffect } from "react";
import { apiAdminPost } from "../utils/api";
import { AnimatedModal } from "./AnimatedModal";

interface Props {
  orderId: string;
  onCancel: () => void;
  onVoidSuccess: () => void;
  action?: "void" | "refund";
}

export const VoidCredentialModal: React.FC<Props> = ({ orderId, onCancel, onVoidSuccess, action = "void" }) => {
  const [rfid, setRfid] = useState("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannedName, setScannedName] = useState<string | null>(null);
  const [step, setStep] = useState<"reason" | "auth">("reason");
  const [stepTransition, setStepTransition] = useState(false);
  const rfidRef = useRef<HTMLInputElement>(null);
  const isRefund = action === "refund";

  // Force focus on hidden RFID input when modal opens
  useEffect(() => {
    if (step !== "auth") return;
    rfidRef.current?.focus();
    const interval = setInterval(() => {
      if (document.activeElement !== rfidRef.current) {
        rfidRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [step]);

  // Look up RFID on scan to show who was scanned
  const lookupRfid = async (value: string) => {
    const trimmed = value.replace(/[\x00-\x1f]/g, '').trim().toUpperCase();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/staff/rfid/${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const staff = await res.json();
        if (staff?.name) {
          setScannedName(staff.name);
          setError("");
        } else {
          setScannedName(null);
          setError("Card not registered. See admin.");
        }
      } else {
        setScannedName(null);
        setError("Card not recognized. Try again.");
      }
    } catch {
      setScannedName(null);
    }
  };

  const pressPin = (key: string) => {
    if (key === "CLR") { setPin(""); return; }
    if (key === "⌫") { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length < 4) setPin((p) => p + key);
  };

  const handleSubmit = async () => {
    if (!rfid.trim() || pin.length !== 4) {
      setError("Enter manager RFID and 4-digit PIN");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const loginRes = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfid: rfid.replace(/[\x00-\x1f]/g, '').trim().toUpperCase(), pin }),
      });
      if (!loginRes.ok) throw new Error("Invalid credentials");
      const loginData = await loginRes.json();

      // Fetch manager info to check role
      const meRes = await fetch("/api/staff/me", {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });
      const meData = await meRes.json();
      if (!meRes.ok || !["Manager", "Shift Supervisor"].includes(meData.role)) {
        setError(`Manager credentials required to ${isRefund ? "refund" : "void"}`);
        setLoading(false);
        return;
      }
      // Authorize void or refund on server — pass manager token explicitly
      if (isRefund) {
        await apiAdminPost(`/orders/${orderId}/refund`, { reason }, loginData.token);
      } else {
        await apiAdminPost(`/orders/${orderId}/void`, { reason }, loginData.token);
      }
      onVoidSuccess();
    } catch {
      setError("Invalid manager credentials");
    } finally {
      setLoading(false);
    }
  };

  const goToAuth = () => {
    if (!reason.trim()) return;
    setStepTransition(true);
    setTimeout(() => {
      setStep("auth");
      setStepTransition(false);
    }, 200);
  };

  return (
    <AnimatedModal open={true} onClose={onCancel} zIndex={9999} maxWidth="300px">
      <div
        className={`bg-erl-elevated border-[1.5px] rounded-[14px] p-4 md:p-6 w-full mx-auto transition-all duration-300 ${
          stepTransition ? "opacity-0 scale-95 translate-y-2" : "opacity-100 scale-100 translate-y-0"
        }`}
        style={{
          borderColor: isRefund ? "var(--gold, #C9873A)" : "var(--danger, #e5484d)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors duration-300 ${
              isRefund ? "bg-erl-accent/15 text-erl-accent" : "bg-[#e5484d]/15 text-[#e5484d]"
            }`}
          >
            {isRefund ? "↩" : "✕"}
          </div>
          <div>
            <div className="text-xs font-bold text-erl-text-primary">
              {isRefund ? "Refund Order" : "Void Order"}
            </div>
            <div className="text-[9px] text-erl-text-faint font-mono">
              #{orderId.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        <div className={`text-[9px] mb-3.5 leading-relaxed ${isRefund ? "text-erl-accent" : "text-[#e5484d]"}`}>
          {isRefund
            ? "Manager authorization required to refund this order."
            : "Manager authorization required to void this order."}
        </div>

        {/* Step 1: Reason */}
        {step === "reason" ? (
          <div className="space-y-3">
            <div>
              <div className="text-[8px] text-erl-muted tracking-widest uppercase mb-1.5">
                {isRefund ? "Refund Reason" : "Void Reason"}
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isRefund ? "e.g. Customer returned…" : "e.g. Customer cancelled…"}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && reason.trim()) goToAuth(); }}
                className="w-full bg-erl-base border border-erl-border-medium rounded-lg text-erl-text-primary px-3 py-2.5 text-[10px] outline-none box-border transition-all duration-200 focus:border-erl-accent focus:shadow-[0_0_0_3px_rgba(196,149,106,0.1)]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-secondary text-[9px] font-bold cursor-pointer uppercase tracking-wide min-h-[44px] transition-all duration-200 hover:bg-erl-surface hover:border-erl-border-medium active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                onClick={goToAuth}
                disabled={!reason.trim()}
                className={`flex-1 py-2.5 rounded-lg border-none text-[9px] font-bold uppercase tracking-wide min-h-[44px] transition-all duration-200 active:scale-[0.97] ${
                  reason.trim()
                    ? isRefund
                      ? "bg-erl-accent text-white cursor-pointer hover:brightness-110"
                      : "bg-[#e5484d] text-white cursor-pointer hover:brightness-110"
                    : "bg-erl-surface text-erl-text-disabled cursor-default"
                }`}
              >
                Continue →
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step 2: RFID */}
            <div className="mb-2.5 relative">
              <input
                ref={rfidRef}
                value={rfid}
                onChange={(e) => { const v = e.target.value.replace(/[\x00-\x1f]/g, '').toUpperCase(); setRfid(v); setScannedName(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && rfid.trim()) lookupRfid(rfid); }}
                className="fixed top-0 left-0 w-px h-px opacity-0 -z-[1]"
                autoFocus
              />
              <div onClick={() => rfidRef.current?.focus()} className="flex flex-col items-center gap-1.5 cursor-pointer py-1.5">
                <div className="relative w-[110px] h-[74px]">
                  <div className="absolute inset-0 bg-gradient-to-br from-erl-accent/[0.18] to-erl-accent/[0.06] border-[1.5px] border-erl-accent/30 rounded-[10px] overflow-hidden">
                    <div className="absolute top-2.5 left-3 w-3.5 h-2.5 bg-gradient-to-br from-erl-accent to-erl-accent/50 rounded-sm opacity-60" />
                  </div>
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-erl-accent to-transparent shadow-[0_0_6px_rgba(201,135,58,0.6)]"
                    style={{ animation: "scanLine 2.2s ease-in-out infinite" }}
                  />
                </div>
                <div className="text-[8px] text-erl-text-faint tracking-wide">Scan manager card</div>
                {scannedName && (
                  <div className="text-[10px] text-erl-accent font-semibold tracking-wide animate-fade-in">
                    {scannedName}
                  </div>
                )}
              </div>
            </div>

            {/* PIN pad */}
            <div className="mb-3">
              <div className="text-[8px] text-erl-muted tracking-widest uppercase mb-1.5">Manager PIN</div>
              <div className="flex gap-1.5 mb-2 justify-center">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all duration-200 ${
                      pin.length > i
                        ? "border-[1.5px] border-erl-accent bg-erl-accent/10 text-erl-accent scale-110"
                        : "border-[1.5px] border-erl-border-medium bg-erl-base text-erl-text-disabled"
                    }`}
                  >
                    {pin.length > i ? "●" : ""}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-[5px]">
                {[["1","2","3"],["4","5","6"],["7","8","9"],["CLR","0","⌫"]].map((row) =>
                  row.map((key) => (
                    <button
                      key={key}
                      onClick={() => pressPin(key)}
                      className={`py-2.5 rounded-lg text-[11px] font-bold cursor-pointer border border-erl-border-medium min-h-[44px] transition-all duration-150 active:scale-95 active:brightness-125 ${
                        key === "CLR" || key === "⌫" ? "bg-erl-base" : "bg-erl-surface text-erl-text-primary hover:bg-erl-elevated"
                      } ${key === "CLR" ? "text-[#e5484d]" : key === "⌫" ? "text-erl-accent" : ""}`}
                    >
                      {key}
                    </button>
                  ))
                )}
              </div>
            </div>

            {error && (
              <div className="text-[9px] text-[#e5484d] text-center mb-2 animate-fade-in">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg border border-erl-border-default bg-erl-base text-erl-secondary text-[9px] font-bold tracking-wide cursor-pointer uppercase min-h-[44px] transition-all duration-200 hover:bg-erl-surface hover:border-erl-border-medium active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || pin.length !== 4 || !rfid.trim()}
                className={`flex-1 py-2.5 rounded-lg border-none text-[9px] font-bold tracking-wide uppercase min-h-[44px] transition-all duration-200 active:scale-[0.97] ${
                  pin.length === 4 && rfid.trim()
                    ? isRefund
                      ? "bg-erl-accent text-white cursor-pointer hover:brightness-110"
                      : "bg-[#e5484d] text-white cursor-pointer hover:brightness-110"
                    : "bg-erl-surface text-erl-text-disabled cursor-default"
                }`}
              >
                {loading ? "Verifying…" : isRefund ? "Authorize Refund" : "Authorize Void"}
              </button>
            </div>
          </>
        )}
      </div>
    </AnimatedModal>
  );
};
