# FRONTEND REVIEW — Feb 21, 2026

## Commit `b778248` Verification (Architecture Fixes)

Reviewed `src/Pitbull.Api/Program.cs`.

1. **Auth before rate limiter**: ✅ Confirmed
   - `app.UseAuthentication();` at `src/Pitbull.Api/Program.cs:660`
   - `app.UseAuthorization();` at `src/Pitbull.Api/Program.cs:661`
   - `app.UseRateLimiter();` at `src/Pitbull.Api/Program.cs:662`

2. **Redis health check conditional**: ✅ Confirmed
   - Redis conn string loaded once: `src/Pitbull.Api/Program.cs:347`
   - Redis health check only added when configured: `src/Pitbull.Api/Program.cs:567`

3. **Swagger + CAP dashboard gated to development**: ✅ Confirmed
   - CAP dashboard only in dev: `src/Pitbull.Api/Program.cs:367`
   - Swagger/SwaggerUI only in dev: `src/Pitbull.Api/Program.cs:646`

---

## Frontend Security / Reliability Scan

Scope:
- `src/Pitbull.Web/pitbull-web/src/`
- Focused on hardcoded API URLs, token handling/leakage, and API error states.

### Findings

### 1. HIGH — Access and refresh tokens are stored in browser-accessible storage
- `src/Pitbull.Web/pitbull-web/src/lib/auth.ts:11`
- `src/Pitbull.Web/pitbull-web/src/lib/auth.ts:29`

`pitbull_token` and `pitbull_refresh_token` are stored in `localStorage`. Any XSS can exfiltrate both tokens.

### 2. HIGH — Access token is also written to a non-HttpOnly cookie
- `src/Pitbull.Web/pitbull-web/src/lib/auth.ts:13`
- `src/Pitbull.Web/pitbull-web/src/middleware.ts:18`

The JWT is copied to `document.cookie` for middleware checks, but this cookie is JavaScript-readable by design (cannot be HttpOnly when set client-side), increasing token theft surface.

### 3. MEDIUM — Auth cookie missing `Secure` flag
- `src/Pitbull.Web/pitbull-web/src/lib/auth.ts:13`

Cookie is set with `SameSite=Lax` but not `Secure`, so it is not explicitly restricted to HTTPS transport.

### 4. MEDIUM — Hardcoded API fallback URL
- `src/Pitbull.Web/pitbull-web/src/lib/config.ts:2`

`API_BASE_URL` falls back to `http://localhost:5000` when `NEXT_PUBLIC_API_BASE_URL` is missing. This is a brittle production default and can cause wrong-target requests in misconfigured environments.

### 5. MEDIUM — Inconsistent API error states due silent fallback patterns
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/employees/page.tsx:237`
- `src/Pitbull.Web/pitbull-web/src/components/layout/quick-add-time-entry.tsx:86`

Multiple pages intentionally swallow API failures via `.catch(() => null)` / `.catch(() => [])`, which can render partial/stale UI without clear error state. This hurts operability and can mask backend regressions.

### 6. LOW — Manual fetch paths send empty `Authorization` header when token missing
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/data-import/page.tsx:202`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/integrations/page.tsx:191`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/reports/vista-export/page.tsx:138`

Pattern `Authorization: token ? \`Bearer ${token}\` : ""` sends an empty header instead of omitting the header entirely.

---

## Hardcoded URLs / Token Leakage / Error Boundaries Summary

- **Hardcoded API URLs**: No direct hardcoded production API endpoints found in components. One fallback exists in config (`http://localhost:5000`).
- **Leaked tokens in logs/source**: No obvious token logging found (no `console.log(token)` patterns).
- **Missing error boundaries**: No systemic gap found. Global boundaries are present:
  - `src/Pitbull.Web/pitbull-web/src/app/error.tsx`
  - `src/Pitbull.Web/pitbull-web/src/app/global-error.tsx`
  - `src/Pitbull.Web/pitbull-web/src/components/root-error-boundary.tsx`
  - `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/layout.tsx:50`

