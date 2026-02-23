"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import api from "@/lib/api";
import { getToken, setToken, removeToken, setRefreshToken, removeRefreshToken, decodeToken, isTokenExpired } from "@/lib/auth";
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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoUser: boolean;
  login: (email: string, password: string) => Promise<void>;
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
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const token = getToken();
    return token ? buildUserFromToken(token) : null;
  });

  // We initialize from localStorage in the lazy initializer, so no effect needed.
  const [isLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });

    setToken(response.token);
    if (response.refreshToken) setRefreshToken(response.refreshToken);
    const u = buildUserFromToken(response.token);
    setUser(u);

    // Identify user in PostHog
    if (u && posthog.__loaded) {
      posthog.identify(u.id, {
        email: u.email,
        name: u.name,
        tenant_id: u.tenantId,
      });
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const response = await api<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: data,
    });

    setToken(response.token);
    if (response.refreshToken) setRefreshToken(response.refreshToken);
    setUser(buildUserFromToken(response.token));
  }, []);

  const logout = useCallback(() => {
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
