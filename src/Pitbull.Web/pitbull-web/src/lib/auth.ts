const TOKEN_KEY = "pitbull_token";
const REFRESH_TOKEN_KEY = "pitbull_refresh_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Cookie attributes for pitbull_token — Secure only on HTTPS so localhost dev works. */
export function buildAuthCookie(token: string): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  return `${TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = buildAuthCookie(token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeRefreshToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
  companyId?: string;
  companyIds?: string[];
  isDemoUser?: boolean;
  /** Job title from seed/profile (e.g. Chief Executive Officer) */
  jobTitle?: string;
  /** Persona key: executive | cfo | projectManager | field | estimator | … */
  roleProfile?: string;
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
    
    // Extract permissions claim (can be string or string[])
    let permissions: string[] = [];
    const permClaim = raw.permissions;
    if (permClaim) {
      permissions = Array.isArray(permClaim) ? permClaim : [permClaim];
    }

    // Parse company_ids if present (comma-separated string)
    let companyIds: string[] = [];
    if (raw.company_ids) {
      companyIds = typeof raw.company_ids === "string"
        ? raw.company_ids.split(",").filter(Boolean)
        : Array.isArray(raw.company_ids) ? raw.company_ids : [];
    }

    // Map API claim names to frontend expected names
    return {
      ...raw,
      name: raw.full_name ?? raw.name ?? "",
      roles,
      permissions,
      tenantId: raw.tenant_id ?? raw.tenantId ?? "",
      companyId: raw.company_id ?? raw.companyId ?? undefined,
      companyIds,
      isDemoUser: raw.is_demo_user === "true",
      jobTitle: raw.job_title ?? raw.jobTitle ?? undefined,
      roleProfile: raw.role_profile ?? raw.roleProfile ?? undefined,
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
