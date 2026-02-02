"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { getToken, setToken, removeToken, decodeToken, isTokenExpired } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  tenantId?: string;
}

interface AuthResponse {
  token: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token && !isTokenExpired(token)) {
      const payload = decodeToken(token);
      if (payload) {
        setUser({
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          tenantId: payload.tenantId,
        });
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(response.token);
    const payload = decodeToken(response.token);
    if (payload) {
      setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        tenantId: payload.tenantId,
      });
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const response = await api<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: data,
    });
    setToken(response.token);
    const payload = decodeToken(response.token);
    if (payload) {
      setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        tenantId: payload.tenantId,
      });
    }
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
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
