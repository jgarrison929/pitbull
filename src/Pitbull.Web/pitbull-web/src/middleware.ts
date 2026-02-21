import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/signup", "/invite", "/forgot-password", "/reset-password", "/verify-email"];
const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

/**
 * Decode JWT payload without signature verification (Edge Runtime can't access signing key).
 * Returns null if the token is malformed or expired.
 */
function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

function hasAdminRole(payload: Record<string, unknown>): boolean {
  const roles = payload[ROLE_CLAIM];
  if (Array.isArray(roles)) return roles.includes("Admin");
  return roles === "Admin";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and portal paths
  if (publicPaths.some((p) => pathname.startsWith(p)) || pathname.startsWith("/portal")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("pitbull_token")?.value;

  // No token → redirect to login
  if (!token && pathname !== "/login" && pathname !== "/register") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route guard: decode token and check role claim
  if (token && pathname.startsWith("/admin")) {
    const payload = decodeTokenPayload(token);

    // Expired or malformed token → redirect to login
    if (!payload) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Non-admin users → redirect to dashboard
    if (!hasAdminRole(payload)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
