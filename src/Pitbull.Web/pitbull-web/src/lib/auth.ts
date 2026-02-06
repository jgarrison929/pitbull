const TOKEN_KEY = "pitbull_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  // Also set as cookie so middleware can read it
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
  exp: number;
  [key: string]: unknown;
}

// Standard claim URIs for roles
const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

export function decodeToken(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const raw = JSON.parse(decoded);
    
    // Extract roles from the standard role claim
    // Can be a string (single role) or array (multiple roles)
    let roles: string[] = [];
    const roleClaim = raw[ROLE_CLAIM];
    if (roleClaim) {
      roles = Array.isArray(roleClaim) ? roleClaim : [roleClaim];
    }
    
    // Map API claim names to frontend expected names
    return {
      ...raw,
      name: raw.full_name ?? raw.name ?? "",
      roles,
      tenantId: raw.tenant_id ?? raw.tenantId ?? "",
    } as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  return Date.now() >= payload.exp * 1000;
}
