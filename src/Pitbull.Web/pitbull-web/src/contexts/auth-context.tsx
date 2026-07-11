"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, startTransition } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getToken, setToken, removeToken, getRefreshToken, setRefreshToken, removeRefreshToken, decodeToken, isTokenExpired } from "@/lib/auth";
import { posthog } from "@/lib/posthog";
import { API_BASE_URL } from "@/lib/config";

function buildUserFromToken(token: string): User | null {
  if (!token || isTokenExpired(token)) return null;
  const payload = decodeToken(token);
  if (!payload) return null;

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    roles: payload.roles,
    permissions: payload.permissions,
    tenantId: payload.tenantId,
    isDemoUser: payload.isDemoUser,
    jobTitle: payload.jobTitle,
    roleProfile: payload.roleProfile,
  };
}

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
  isDemoUser?: boolean;
  jobTitle?: string;
  roleProfile?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** One-click demo persona login (server maps role → seeded user; no password in browser). */
  loginAsDemoRole: (role: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  // Role helpers
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isAdmin: boolean;
  isManager: boolean;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName?: string;
  tenantId?: string;
  industryType?: string;
  employeeRange?: string;
}

interface AuthResponse {
  token: string;
  refreshToken?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule a "session expiring soon" toast 5 minutes before JWT expiry.
  // Clears any previous timer first to handle token rotation correctly.
  const scheduleExpiryWarning = useCallback((token: string) => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);

    const payload = decodeToken(token);
    if (!payload) return;

    const msUntilExpiry = payload.exp * 1000 - Date.now();
    const msUntilWarning = msUntilExpiry - 5 * 60 * 1000; // warn 5 min before
    if (msUntilWarning <= 0) return;

    expiryTimerRef.current = setTimeout(() => {
      toast.warning("Your session expires soon", {
        description: "You'll be signed out in 5 minutes. Save any unsaved work.",
        duration: Infinity,
        action: {
          label: "Stay signed in",
          onClick: async () => {
            const currentToken = getToken();
            const refreshToken = getRefreshToken();
            if (!currentToken || !refreshToken) return;
            try {
              const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: currentToken, refreshToken }),
              });
              if (res.ok) {
                const data = await res.json();
                setToken(data.token);
                if (data.refreshToken) setRefreshToken(data.refreshToken);
                scheduleExpiryWarning(data.token);
              }
            } catch {
              // Refresh failed — session will expire naturally
            }
          },
        },
      });
    }, msUntilWarning);
  }, []);  

  // Read token from localStorage after hydration to avoid SSR mismatch.
  // Server and client both render isLoading=true initially, then useEffect
  // populates the user on the client only.
  useEffect(() => {
    const token = getToken();
    startTransition(() => {
      if (token) {
        setUser(buildUserFromToken(token));
        scheduleExpiryWarning(token);
      }
      setIsLoading(false);
    });
  }, [scheduleExpiryWarning]);

  const applyAuthResponse = useCallback(
    (response: AuthResponse) => {
      setToken(response.token);
      if (response.refreshToken) setRefreshToken(response.refreshToken);
      const u = buildUserFromToken(response.token);
      setUser(u);
      scheduleExpiryWarning(response.token);

      if (u && posthog.__loaded) {
        const width = typeof window !== "undefined" ? window.innerWidth : undefined;
        posthog.identify(u.id, {
          email: u.email,
          name: u.name,
          tenant_id: u.tenantId,
          is_demo_user: u.isDemoUser ?? false,
          job_title: u.jobTitle,
          role_profile: u.roleProfile,
          identity_roles: u.roles,
        });
        posthog.register({
          role_profile: u.roleProfile,
          is_demo_user: u.isDemoUser ?? false,
          job_title: u.jobTitle,
        });
        if (width != null) {
          posthog.register({
            viewport_width: width,
            is_narrow_viewport: width <= 1023,
            viewport_class:
              width <= 640 ? "phone" : width <= 1023 ? "tablet" : "desktop",
          });
        }
      }
    },
    [scheduleExpiryWarning]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      applyAuthResponse(response);
      if (posthog.__loaded) {
        posthog.capture("user_login", {
          method: "password",
          is_narrow_viewport:
            typeof window !== "undefined" ? window.innerWidth <= 1023 : undefined,
        });
      }
    },
    [applyAuthResponse]
  );

  const loginAsDemoRole = useCallback(
    async (role: string) => {
      const response = await api<AuthResponse>("/api/auth/demo-role-login", {
        method: "POST",
        body: { role },
      });
      applyAuthResponse(response);
      if (posthog.__loaded) {
        const width = typeof window !== "undefined" ? window.innerWidth : undefined;
        posthog.capture("demo_role_login", {
          demo_role: role,
          viewport_width: width,
          is_narrow_viewport: width != null ? width <= 1023 : undefined,
          viewport_class:
            width == null
              ? undefined
              : width <= 640
                ? "phone"
                : width <= 1023
                  ? "tablet"
                  : "desktop",
        });
        posthog.register({ demo_role: role });
      }
    },
    [applyAuthResponse]
  );

  const register = useCallback(async (data: RegisterData) => {
    const response = await api<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: data,
    });

    setToken(response.token);
    if (response.refreshToken) setRefreshToken(response.refreshToken);
    setUser(buildUserFromToken(response.token));
    scheduleExpiryWarning(response.token);
  }, [scheduleExpiryWarning]);

  const logout = useCallback(() => {
    // Clear the expiry warning timer
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    // Revoke refresh token server-side (fire-and-forget)
    const token = getToken();
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {/* best-effort */});
    }

    removeToken();
    removeRefreshToken();
    setUser(null);

    // Reset PostHog identity on logout
    if (posthog.__loaded) {
      posthog.reset();
    }

    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  // Cross-tab logout sync: when another tab removes the token, log out here too
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "pitbull_token" && e.newValue === null) {
        setUser(null);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Re-validate token when tab regains focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const token = getToken();
        if (!token || isTokenExpired(token)) {
          setUser(null);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Role helper functions
  const hasRole = useCallback((role: string) => {
    return user?.roles?.includes(role) ?? false;
  }, [user]);

  const hasAnyRole = useCallback((roles: string[]) => {
    return roles.some(role => user?.roles?.includes(role));
  }, [user]);

  const isAdmin = user?.roles?.includes("Admin") ?? false;
  const isManager = user?.roles?.includes("Manager") ?? false;
  const isDemoUser = user?.isDemoUser ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isDemoUser,
        login,
        loginAsDemoRole,
        register,
        logout,
        hasRole,
        hasAnyRole,
        isAdmin,
        isManager,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
