import React, { useEffect, useCallback } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** z-index override — default 9999 */
  zIndex?: number;
  /** Max width of the content panel */
  maxWidth?: string;
  /** Allow closing by clicking the backdrop — default true */
  closeOnBackdrop?: boolean;
  /** Allow closing with Escape key — default true */
  closeOnEscape?: boolean;
  children: React.ReactNode;
}

export const AnimatedModal: React.FC<Props> = ({
  open,
  onClose,
  zIndex = 9999,
  maxWidth = "320px",
  closeOnBackdrop = true,
  closeOnEscape = true,
  children,
}) => {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) onClose();
    },
    [onClose, closeOnEscape],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, handleEscape]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{
          zIndex: zIndex - 1,
          animation: "modalBackdropIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        }}
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Content */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex }}
      >
        <div
          className="w-full"
          style={{
            maxWidth,
            animation: "modalContentIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};
