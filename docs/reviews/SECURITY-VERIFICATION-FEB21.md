# Security Verification — Feb 21, 2026

## Scope Reviewed
- Commit `73b6e13` (open redirect, CSPRNG tokens, constant-time compare, headers)
- Commit `0b35709` (JWT key validation, admin seed gate, pageSize clamp, CORS)

Files were reviewed directly from commit diffs and current source.

## Findings (Ordered by Severity)

### HIGH: Admin user listing can still load the entire tenant user set when `role` filter is present
- **File:** `src/Pitbull.Api/Controllers/AdminUsersController.cs:60`
- **Issue:** The new logic paginates at DB level only when `role` is not provided. When `role` is provided, it still executes `ToListAsync()` over the full filtered tenant user query (`:63`) and only then applies paging in memory (`:72`).
- **Why this matters:** A caller can still trigger high memory/CPU cost on large tenants by sending `role=<value>`, which defeats the intended OOM/load-protection objective in this commit.
- **Recommendation:** Query user-role relationships at DB level (join on `AspNetUserRoles`/`AspNetRoles` with tenant-prefixed role name) so `totalCount`, `Skip`, and `Take` remain database-driven even with role filtering.

## Verified Fixes That Are Sound

### Commit `73b6e13`
- Password reset token entropy increased to 32 CSPRNG bytes (`src/Modules/Pitbull.Core/Domain/PasswordResetToken.cs:28`).
- Refresh token compare now uses `CryptographicOperations.FixedTimeEquals` (`src/Pitbull.Api/Controllers/AuthController.cs:363`).
- Tenant context SQL switched to interpolated execution for consistency (`src/Pitbull.Api/Controllers/AuthController.cs:145`, `src/Pitbull.Api/Services/TeamInvitationService.cs:183`).
- Monitoring endpoint restricted to admin role and machine name removed from response (`src/Pitbull.Api/Controllers/MonitoringController.cs:15`, `src/Pitbull.Api/Controllers/MonitoringController.cs:144`).
- Login redirect now constrained to local paths only (prevents open redirect to external origins) (`src/Pitbull.Web/pitbull-web/src/app/(auth)/login/page.tsx:55`).
- Error detail rendering is development-only (`src/Pitbull.Web/pitbull-web/src/components/error-boundary.tsx:128`, `src/Pitbull.Web/pitbull-web/src/components/ui/error-boundary.tsx:58`).
- Security response headers added in Next config (`src/Pitbull.Web/pitbull-web/next.config.ts:10`).

### Commit `0b35709`
- Startup config validation now rejects default `Jwt:Key` outside development (`src/Pitbull.Api/Configuration/EnvironmentValidator.cs:68`, wired in `src/Pitbull.Api/Program.cs:51`).
- Dev admin seed now gated to development environment only (`src/Pitbull.Api/Program.cs:619`).
- Global `pageSize` clamp filter added and registered (`src/Pitbull.Api/Infrastructure/ClampPageSizeFilter.cs:15`, `src/Pitbull.Api/Program.cs:382`).
- Diagnostics in-memory rate limiter now evicts stale entries (`src/Pitbull.Api/Controllers/DiagnosticsController.cs:103`).
- Production CORS list no longer includes localhost (`src/Pitbull.Api/appsettings.json`).
- Payroll export download now sends bearer token for authenticated file download (`src/Pitbull.Web/pitbull-web/src/app/(dashboard)/payroll/exports/page.tsx:99`).
- Environment validator tests added for default JWT-key behavior (`tests/Pitbull.Tests.Unit/Configuration/EnvironmentValidatorTests.cs`).

## ApiKeyService / TenantSettingsService Test Compatibility Check

Searched all unit tests for references to old behavior:
- `tests/Pitbull.Tests.Unit/Modules/SystemAdmin/ApiKeyServiceTests.cs`
- `tests/Pitbull.Tests.Unit/Modules/SystemAdmin/TenantSettingsServiceTests.cs`

Result:
- No additional/stale unit tests were found that depend on removed/old behavior for `ApiKeyService` or `TenantSettingsService`.
- No breakage surfaced from these commits in those areas.

## Overall Assessment
- Most security fixes in both commits are correctly implemented and materially improve posture.
- One high-priority gap remains: role-filtered admin user listing is still unbounded in memory and should be completed with DB-level pagination/filtering.
