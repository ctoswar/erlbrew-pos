import React, { useState, useEffect, useRef } from "react";

const RfidInput: React.FC<{ onScan: (rfid: string) => void }> = ({ onScan }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      onScan(value.replace(/[\x00-\x1f]/g, '').trim());
      setValue("");
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-center">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="fixed top-0 left-0 w-px h-px opacity-0 -z-[1]"
        autoFocus
      />
      <div onClick={() => inputRef.current?.focus()} className="flex flex-col items-center gap-3 cursor-pointer py-2">
        <div className="relative w-[140px] h-[88px]">
          {/* Subtle ambient glow */}
          <div className="absolute -inset-2 rounded-[16px] bg-erl-accent/[0.03] blur-md animate-pulse-glow pointer-events-none" />

          {/* Card body */}
          <div
            className="absolute inset-0 rounded-[14px] cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
            style={{
              background: 'linear-gradient(145deg, rgba(196,149,106,0.13) 0%, rgba(196,149,106,0.04) 35%, rgba(42,27,18,0.55) 100%)',
              border: '1.5px solid rgba(196,149,106,0.2)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 40px rgba(196,149,106,0.04)',
            }}
          >
            {/* Light diffusion */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />

            {/* Chip */}
            <div className="absolute top-3.5 left-3.5 w-7 h-[18px] rounded-sm overflow-hidden" style={{
              background: 'linear-gradient(135deg, #d4a87a, #8a6a4a)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.35)',
            }}>
              <div className="absolute inset-[2px] border border-white/15 rounded-[1px]" />
            </div>

            {/* Contactless icon — compact SVG */}
            <div className="absolute top-3 left-[48px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent/35">
                <path d="M2 12C2 6.5 6.5 2 12 2"/><path d="M6 12C6 8.7 8.7 6 12 6"/><path d="M10 12C10 10.9 10.9 10 12 10"/>
              </svg>
            </div>

            {/* Card number dots */}
            <div className="absolute bottom-[18px] left-3.5 flex gap-1.5">
              {[1,2,3].map((g) => (
                <div key={g} className="flex gap-[2px]">
                  {[1,2,3].map((d) => (
                    <div key={d} className="w-[2.5px] h-[2.5px] rounded-full bg-erl-accent/20" />
                  ))}
                </div>
              ))}
            </div>

            {/* Brand */}
            <div className="absolute bottom-2.5 right-3">
              <span className="text-[6px] font-bold text-erl-accent tracking-[2px] opacity-40" style={{ fontFamily: "'Playfair Display', serif" }}>TAP</span>
            </div>

            {/* Scan line */}
            <div className="absolute left-2 right-2 h-[1.5px] bg-gradient-to-r from-transparent via-erl-accent/70 to-transparent shadow-[0_0_16px_rgba(196,149,106,0.5),0_0_32px_rgba(196,149,106,0.15)] animate-scan-line rounded-full" />
          </div>

          {/* Bottom reflection — subtle */}
          <div className="absolute -bottom-2.5 left-[20%] right-[20%] h-5 bg-gradient-to-t from-erl-accent/[0.02] to-transparent rounded-full blur-md" />
        </div>
        <div className="text-xs text-erl-text-muted tracking-wide font-medium">
          Tap your card to clock in/out
        </div>
      </div>
    </div>
  );
};

export default RfidInput;
