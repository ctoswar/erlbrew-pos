import { useState, useEffect, useCallback } from "react";

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  return { isFullscreen, toggle };
}

let kioskInstalled = false;

/**
 * Kiosk mode (?kiosk): enter fullscreen on the first user gesture — tablets
 * need a tap anyway. One-shot, same pattern as installAudioUnlock().
 * A denied/unsupported request is swallowed: the kiosk layout (kitchen-only,
 * no POS chrome) applies regardless.
 */
export function installKioskFullscreen(): void {
  if (kioskInstalled) return;
  kioskInstalled = true;
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    document.documentElement.requestFullscreen().catch(() => {
      /* fullscreen denied (permissions/iframe) — kiosk layout still applies */
    });
  };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
}
