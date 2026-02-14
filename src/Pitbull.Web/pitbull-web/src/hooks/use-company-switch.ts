import { useEffect } from "react";

/**
 * Hook that listens for company switch events and calls the callback.
 * Use this in pages/components that need to re-fetch data when the
 * active company changes.
 *
 * @example
 * ```tsx
 * useCompanySwitch(() => {
 *   // Re-fetch projects, bids, etc.
 *   fetchData();
 * });
 * ```
 */
export function useCompanySwitch(callback: (detail: { companyId: string; companyCode: string; companyName: string }) => void) {
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      callback(detail);
    };

    window.addEventListener("company-switched", handler);
    return () => window.removeEventListener("company-switched", handler);
  }, [callback]);
}
