# ARCHITECTURE REVIEW — Feb 21, 2026

Scope reviewed:
- `src/Pitbull.Api/Program.cs`
- Related config files for startup behavior

## Findings

### 1. HIGH — Startup path does blocking DB migration + seed work on every boot
- `src/Pitbull.Api/Program.cs:586`
- `src/Pitbull.Api/Program.cs:591`
- `src/Pitbull.Api/Program.cs:597`
- `src/Pitbull.Api/Program.cs:606`

`MigrateAsync`, demo bootstrap, and role seeding run inline before the app begins serving. This can increase cold start time and can block readiness under DB contention/network blips.

Recommendation:
- Move migrations/seeding to deployment job or gated startup task.
- If kept in-process, add strict timeout/retry policy and environment gating.

### 2. HIGH — Middleware ordering breaks claim-based rate limit partitioning
- `src/Pitbull.Api/Program.cs:502`
- `src/Pitbull.Api/Program.cs:650`
- `src/Pitbull.Api/Program.cs:651`

Rate limiter runs before authentication. Policies like `ai-chat`, `ai-document`, and `ai-suggest` partition by authenticated user claim, but at limiter time `HttpContext.User` is not yet populated, so partitions fall back to IP. This defeats intended per-user limits.

Recommendation:
- Move `app.UseAuthentication()` before `app.UseRateLimiter()`.

### 3. MEDIUM — Environment-sensitive operational endpoints are enabled unconditionally
- `src/Pitbull.Api/Program.cs:367` (`CAP` dashboard)
- `src/Pitbull.Api/Program.cs:639` (`Swagger`)

Both CAP dashboard and Swagger UI are enabled in all environments with no explicit environment/authorization gating in `Program.cs`.

Recommendation:
- Restrict by environment and/or require auth policy (especially CAP dashboard).

### 4. MEDIUM — Hardcoded admin seed is environment-agnostic
- `src/Pitbull.Api/Program.cs:606`

Dev admin bootstrap runs via `DEV_ADMIN_EMAIL` when set in Development. Keep unset in shared/public environments.

Recommendation:
- Gate to development/staging or controlled via config flag and configured email list.

### 5. LOW — Missing centralized handling for non-exception error responses
- `src/Pitbull.Api/Program.cs:610`
- `src/Pitbull.Api/Program.cs:657`

`ExceptionMiddleware` covers thrown exceptions, but there is no `UseStatusCodePages`/equivalent unified handling for framework-generated 401/403/404 responses. This may produce inconsistent error payloads.

Recommendation:
- Add standardized status-code response handling if API contract requires uniform error shape.

## Redis / CAP Connection Status Check

### Result: **No explicit startup log confirms Redis/CAP connection success**
- CAP config chooses Redis if connection string exists: `src/Pitbull.Api/Program.cs:357`
- No explicit `LogInformation`/health probe/ping of Redis/CAP connectivity at startup in `Program.cs`.

Implication:
- Josh cannot reliably verify “Redis is actually connected” from deterministic application startup logs today.

Recommendation:
- Add explicit startup logging around transport selection and a connectivity check (e.g., Redis ping / CAP storage+transport health check) with success/failure log lines.
- Optionally add Redis health check endpoint and include it in `/health/ready`.

## Notes
- This was a static review; no runtime load/startup timing tests were run in this pass.
