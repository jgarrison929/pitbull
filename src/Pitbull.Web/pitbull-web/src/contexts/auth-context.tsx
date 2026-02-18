"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import api from "@/lib/api";
import { getToken, setToken, removeToken, decodeToken, isTokenExpired } from "@/lib/auth";
import { posthog } from "@/lib/posthog";

function buildUserFromToken(token: string): User | null {
  if (!token || isTokenExpired(token)) return null;
  const payload = decodeToken(token);
  if (!payload) return null;

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    roles: payload.roles,
    tenantId: payload.tenantId,
  };
}

function identifyPostHogUser(user: User) {
  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
    roles: user.roles,
    tenant_id: user.tenantId,
  });
}

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
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
}

interface AuthResponse {
  token: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const token = getToken();
    const restored = token ? buildUserFromToken(token) : null;
    if (restored) identifyPostHogUser(restored);
    return restored;
  });

  // We initialize from localStorage in the lazy initializer, so no effect needed.
  const [isLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });

    setToken(response.token);
    const loggedInUser = buildUserFromToken(response.token);
    setUser(loggedInUser);
    if (loggedInUser) identifyPostHogUser(loggedInUser);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const response = await api<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: data,
    });

    setToken(response.token);
    const registeredUser = buildUserFromToken(response.token);
    setUser(registeredUser);
    if (registeredUser) identifyPostHogUser(registeredUser);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    posthog.reset();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
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
