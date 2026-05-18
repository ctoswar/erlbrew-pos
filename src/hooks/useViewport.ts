import { useState, useEffect } from 'react';

// Breakpoints matching global.css and POSScreen.tsx
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

export interface ViewportInfo {
  width: number;
  height: number;
  size: ViewportSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

function getViewportInfo(): ViewportInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width < BREAKPOINTS.mobile;
  const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.tablet;

  let size: ViewportSize = 'desktop';
  if (isMobile) size = 'mobile';
  else if (isTablet) size = 'tablet';

  return { width, height, size, isMobile, isTablet, isDesktop };
}

/**
 * Shared viewport detection hook.
 * Replaces the inline isMobile/isTablet logic in POSScreen.tsx.
 * All components can import this to conditionally render based on viewport.
 *
 * Usage:
 *   const { isMobile, isTablet, isDesktop } = useViewport();
 *   if (isMobile) return <MobileView />;
 */
export function useViewport(): ViewportInfo {
  const [viewport, setViewport] = useState<ViewportInfo>(getViewportInfo);

  useEffect(() => {
    const handleResize = () => setViewport(getViewportInfo());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

/**
 * Static viewport check (no reactivity).
 * Useful for one-time checks in non-React code or SSR-safe initial values.
 */
export const getViewport = getViewportInfo;