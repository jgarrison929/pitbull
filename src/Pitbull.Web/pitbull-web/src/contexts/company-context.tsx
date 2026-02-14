"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  getAccessibleCompanies,
  switchCompany as switchCompanyApi,
} from "@/lib/companies";
import type { CompanyAccessible } from "@/lib/types";
import { setToken } from "@/lib/auth";

const ACTIVE_COMPANY_KEY = "pitbull_active_company_id";

interface CompanyContextType {
  /** The currently active company */
  activeCompany: CompanyAccessible | null;
  /** All companies the user can access */
  companies: CompanyAccessible[];
  /** Whether we're still loading company data */
  isLoading: boolean;
  /** Whether the user has multiple companies */
  hasMultipleCompanies: boolean;
  /** Switch to a different company (no page reload) */
  switchCompany: (companyId: string) => Promise<void>;
  /** Refresh the accessible companies list */
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [companies, setCompanies] = useState<CompanyAccessible[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyAccessible | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRef = useRef(false);

  // Load companies when authenticated
  const loadCompanies = useCallback(async () => {
    if (!isAuthenticated) {
      setCompanies([]);
      setActiveCompany(null);
      setIsLoading(false);
      return;
    }

    try {
      const accessible = await getAccessibleCompanies();
      setCompanies(accessible);

      // Determine active company:
      // 1. Check localStorage for persisted selection
      // 2. Use the default company
      // 3. Use the first company
      const storedId =
        typeof window !== "undefined"
          ? localStorage.getItem(ACTIVE_COMPANY_KEY)
          : null;

      const storedCompany = storedId
        ? accessible.find((c) => c.id === storedId)
        : null;
      const defaultCompany = accessible.find((c) => c.isDefault);
      const active = storedCompany || defaultCompany || accessible[0] || null;

      setActiveCompany(active);

      // Persist the active company
      if (active && typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_COMPANY_KEY, active.id);
      }
    } catch {
      // If the API doesn't support companies yet (backend not deployed),
      // gracefully degrade — no companies, no switcher
      setCompanies([]);
      setActiveCompany(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Only load once per auth change
    if (isAuthenticated && !loadedRef.current) {
      loadedRef.current = true;
      loadCompanies();
    }
    if (!isAuthenticated) {
      loadedRef.current = false;
      setCompanies([]);
      setActiveCompany(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, loadCompanies]);

  const switchCompany = useCallback(
    async (companyId: string) => {
      const target = companies.find((c) => c.id === companyId);
      if (!target) return;

      try {
        // Call backend to switch — returns new JWT with updated company_id
        const { token } = await switchCompanyApi(companyId);
        setToken(token);

        // Update local state
        setActiveCompany(target);
        if (typeof window !== "undefined") {
          localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
        }

        // Dispatch a custom event so data-fetching hooks/components can re-fetch
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("company-switched", {
              detail: { companyId, companyCode: target.code, companyName: target.name },
            })
          );
        }
      } catch {
        // If switch fails (backend not ready), just update local state
        setActiveCompany(target);
        if (typeof window !== "undefined") {
          localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
          window.dispatchEvent(
            new CustomEvent("company-switched", {
              detail: { companyId, companyCode: target.code, companyName: target.name },
            })
          );
        }
      }
    },
    [companies]
  );

  const refreshCompanies = useCallback(async () => {
    loadedRef.current = false;
    await loadCompanies();
  }, [loadCompanies]);

  // Reset loaded ref when user changes (e.g., different login)
  useEffect(() => {
    loadedRef.current = false;
  }, [user?.id]);

  return (
    <CompanyContext.Provider
      value={{
        activeCompany,
        companies,
        isLoading,
        hasMultipleCompanies: companies.length > 1,
        switchCompany,
        refreshCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
