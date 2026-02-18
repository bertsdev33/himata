import { useState, useEffect } from "react";

const SM_BREAKPOINT = 640;

/**
 * Returns true when the viewport is below the `sm` (640px) Tailwind breakpoint.
 * Uses matchMedia so it reacts to resizes and orientation changes.
 * Returns false during SSR / initial hydration (safe default).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SM_BREAKPOINT - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
