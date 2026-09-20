import React, { useState, useRef, useEffect, useCallback } from "react";

export interface AnimatedSelectOption {
  value: string;
  label: string;
}

interface Props {
  options: AnimatedSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const AnimatedSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className = "",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? selected.label : placeholder;

  const close = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || highlightedIndex < 0) return;
    const item = listRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      const idx = options.findIndex((o) => o.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
      return;
    }

    if (!open) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onChange(options[highlightedIndex].value);
          close();
        }
        break;
      case "Home":
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          if (!open) {
            const idx = options.findIndex((o) => o.value === value);
            setHighlightedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`
          w-full flex items-center justify-between gap-2
          px-3 py-2 rounded-lg text-left
          border transition-all duration-200
          cursor-pointer select-none
          ${
            open
              ? "border-erl-accent bg-erl-surface shadow-[0_0_0_3px_rgba(196,149,106,0.12)]"
              : "border-erl-border-default bg-erl-base hover:border-erl-border-medium"
          }
          ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        `}
      >
        <span
          className={`text-[11px] truncate ${
            selected ? "text-erl-text-primary" : "text-erl-text-disabled"
          }`}
        >
          {displayText}
        </span>
        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 text-erl-text-muted transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown */}
      <div
        className={`
          absolute z-50 mt-1.5 left-0 right-0
          rounded-lg overflow-hidden
          border border-erl-border-default
          bg-erl-surface
          shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]
          backdrop-blur-xl
          origin-top
          transition-all duration-250
          ease-[cubic-bezier(0.16,1,0.3,1)]
          ${
            open
              ? "opacity-100 scale-y-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-y-90 -translate-y-1 pointer-events-none"
          }
        `}
        style={{ willChange: "transform, opacity" }}
      >
        <div ref={listRef} className="max-h-[200px] overflow-y-auto py-1 scrollbar-thin">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[10px] text-erl-text-disabled text-center">
              No options
            </div>
          ) : (
            options.map((option, i) => {
              const isSelected = option.value === value;
              const isHighlighted = i === highlightedIndex;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={`
                    w-full flex items-center justify-between gap-2
                    px-3 py-1.5 text-left
                    transition-all duration-150
                    ${
                      isHighlighted
                        ? "bg-erl-accent/10"
                        : "hover:bg-erl-accent/5"
                    }
                  `}
                >
                  <span
                    className={`text-[11px] ${
                      isSelected
                        ? "text-erl-accent font-semibold"
                        : isHighlighted
                          ? "text-erl-text-primary"
                          : "text-erl-text-secondary"
                    }`}
                  >
                    {option.label}
                  </span>
                  {/* Checkmark */}
                  {isSelected && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className="shrink-0 text-erl-accent"
                    >
                      <path
                        d="M2.5 6.5L5 9L9.5 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
