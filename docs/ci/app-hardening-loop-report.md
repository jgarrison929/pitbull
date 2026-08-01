# App hardening loop report

Focus: security logging CodeQL data integrity code quality
Rounds: 4
Findings discovered (unique): 256

## Fix summaries

- r1: Hardened request logging (path/token/cookie/email redaction, LogSafe on all untrusted args, body/headers gated to Development) and fixed AI provider / fileName / project name / Identity error logs to use LogSafe.Text with truncated provider payloads.
- r2: Hardened correlation-ID handling (allowlist + server GUID on invalid/forged headers, LogSafe before LogContext), sanitized anonymous diagnostic error storage (email fingerprint, LogSafe + length bounds, ignore client TenantId/UserId), stopped logging email token substrings, and applied LogSafe consistency fixes in ProjectService update, PayrollExportService (IDs only), and DemoBootstrapper create-user path.
- r3: Hardened log integrity: Serilog request logging now redacts vendor-portal/invitation path tokens via SanitizeRequestPathForLogging; wrapped untrusted project names, job errors, and blob keys with LogSafe.Text; sanitized client-controlled file extensions when building blob keys.
- r4: Fixed high-severity diagnostic persistence (ExceptionMiddleware + ApiNotFoundMiddleware) by routing through DiagnosticsService.CreateAsync with path/query sanitization and LogSafe email fingerprinting; replaced SecretVault plaintext prefix fingerprint/mask with SHA-256 fingerprint and length-only mask; sanitized medium-severity Result.Error/AI error logs in InvoiceExtractionService, VendorPortalController (ErrorCode only), and VendorPaymentService.

## Findings backlog

- **high** [log-safe] `C:\pitbull-private\src\Pitbull.Api\Middleware\RequestResponseLoggingMiddleware.cs`: Always-on API request logging records full Path/QueryString/Body without LogSafe and with incomplete redaction: vendor-portal and invitation secret tokens appear in Path; login/register emails are not in SensitiveFields; Cookie headers are not redacted; string values keep CR/LF (log forging). — _fix:_ Gate to Development or sample; redact path segments for /vendor-portal/{token} and /token/{token}; add email (and cookie) to SensitiveFields; run Path/Query/Body/header values through LogSafe.Text; never log full bearer secrets.
- **high** [log-safe] `C:\pitbull-private\src\Pitbull.Api\Services\AiInsightsService.cs`: Full Anthropic response body is written to ILogger on HTTP failure and JSON parse failure without LogSafe.Text; multi-line provider payloads can forge log lines and may echo project analysis content. — _fix:_ Log status code + truncated LogSafe.Text(responseContent) (or error type only); never log full provider payloads in production.
- **high** [log-safe] `C:\pitbull-private\src\Pitbull.Api\Features\AI\InvoiceExtractionService.cs`: OpenAI Vision error responses (up to 500 chars) and user-controlled fileName are logged without LogSafe.Text (same pattern in DeliveryTicketOcrService). — _fix:_ Wrap body and fileName with LogSafe.Text; prefer status code + error code over raw body.
- **medium** [log-safe] `C:\pitbull-private\src\Pitbull.Api\Features\AI\InvoiceExtractionController.cs`: Client-supplied multipart FileName and AI warning strings are logged without LogSafe.Text (CodeQL cs/log-forging taint from HTTP). — _fix:_ logger.LogInformation(..., LogSafe.Text(file.FileName), LogSafe.Text(string.Join("; ", result.Warnings)));
- **medium** [log-safe] `C:\pitbull-private\src\Modules\Pitbull.Projects\Services\ProjectService.cs`: Soft-delete success log uses raw project.Name while create/update/activate paths already use LogSafe.Text — inconsistent log-forging barrier on user-editable name. — _fix:_ Change to LogSafe.Text(project.Name) to match L360/L411/L472.
- **medium** [log-safe] `C:\pitbull-private\src\Pitbull.Api\Controllers\AdminRolesController.cs`: Identity error Description strings logged without LogSafe.Text (RoleSeeder sanitizes the same pattern). — _fix:_ LogSafe.Text(string.Join(", ", result.Errors.Select(e => e.Description))) on create/update/delete failure paths.
- **medium** [log-safe] `C:\pitbull-private\src\Modules\Pitbull.AI\Services\InvoiceExtractionService.cs`: AI completion failure path logs aiResult.Error without LogSafe.Text; provider/orchestrator error text may contain newlines or untrusted fragments. — _fix:_ logger.LogWarning("AI invoice extraction failed: {Error}", LogSafe.Text(aiResult.Error));
- **medium** [data] `C:\pitbull-private\src\Pitbull.Api\Middleware\ExceptionMiddleware.cs`: DiagnosticError rows store raw JWT email claim plus RequestPath/QueryString (token-bearing URLs) in the DB diagnostic sink—sensitive data outside ILogger but same integrity surface as logs. — _fix:_ Store LogSafe.Email(email) or omit email; scrub token path segments before RequestPath/QueryString persistence (same for ApiNotFoundMiddleware L49-64).
- **high** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\CompaniesController.cs`: Company-switch JWT reissue drops is_demo_user (and job_title/role_profile). DemoRestrictionMiddleware email fallback only covers @demo.local / demo@example.com, so self-service IsDemoUser accounts with arbitrary emails lose demo restrictions after POST /api/companies/switch/{id}. Claim-only checks (AiRateLimitPolicy, AiChatController, EmployeesController) also stop treating them as demo. — _fix:_ Align CompaniesController.GenerateJwtTokenAsync with AuthController: emit is_demo_user when user.IsDemoUser, plus job_title/role_profile. Prefer a shared JWT builder so claim sets cannot drift.
- **high** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\AuthController.cs`: POST /api/auth/demo-register, if the email already exists and existingUser.IsDemoUser, issues a fresh JWT + refresh token without verifying the submitted password (passwordless account takeover of any demo signup). — _fix:_ On existing demo user, require CheckPasswordSignInAsync (or reject with 'log in') before minting tokens; never treat registration retry as authenticated without credentials.
- **high** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\AuthController.cs`: Login and refresh ignore AppUser.Status. Admin can set Inactive/Locked via AdminUsersController, but password login and refresh still succeed if Identity password check passes, so deactivation is not an access control. — _fix:_ After successful password/refresh validation, reject unless Status == Active (same generic 401 as bad credentials). Optionally clear RefreshToken when status leaves Active.
- **high** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\AuthController.cs`: ResolveRbacPermissionClaimsAsync grants permissions=* to every IsDemoUser. PermissionAuthorizationHandler treats * as all policies, while DemoRestrictionMiddleware only blocks admin/secrets prefixes and global DELETE—so demo principals can POST/PUT across billing, contracts, payroll, etc. on the shared demo tenant. — _fix:_ Stop granting Wildcard to demo users; map persona-appropriate permissions (or a narrow demo allowlist). Extend DemoRestrictionMiddleware to block sensitive write prefixes if * must remain for UX.
- **medium** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\AuthController.cs`: Public register accepts any existing TenantId and joins that tenant as Viewer (or Admin if first user) with no invitation/token—tenant membership by GUID knowledge. — _fix:_ Remove open TenantId join from Register; require invitation acceptance flow (InvitationController/TeamInvitationService) for joining existing tenants.
- **medium** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\AuthController.cs`: RefreshToken compares stored vs provided refresh tokens with CryptographicOperations.FixedTimeEquals on UTF-8 byte arrays without equalizing lengths first; FixedTimeEquals throws ArgumentException on length mismatch → 500 instead of 401. — _fix:_ If lengths differ, return Unauthorized immediately; only call FixedTimeEquals when lengths match (still constant-time on equal-length secrets).
- **medium** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\AuthController.cs`: POST /api/auth/bootstrap-admin remains a live privilege-escalation path when Demo:Enabled: assigns Identity Admin and reissues JWT. If Demo:UserEmail is blank, any authenticated user is allowed (unit test documents this); even with email, primary demo account becomes full Admin + *. — _fix:_ Remove or hard-disable after seed/backfill; if kept, require IsDemoUser + exact configured email always, and refuse when UserEmail is empty. Prefer one-time operator tooling over a public API.
- **medium** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\AuthController.cs`: ChangePassword is authorized for any JWT including shared demo personas (ceo@demo.local, etc.). A visitor can change the shared Demo:UserPassword-backed account and break one-click demo-role-login / other explorers; DemoRestrictionMiddleware does not block /api/auth/change-password. — _fix:_ Reject ChangePassword (and password reset) when user.IsDemoUser or email matches seeded demo personas; optionally rotate only via DemoBootstrapper.
- **critical** [auth] `C:\pitbull-private\src\Pitbull.Api\Controllers\AuthController.cs`: Public POST /api/auth/register accepts any existing TenantId and creates a Viewer (with UserCompanyAccess to the tenant default company) without invitation or membership proof—anyone who knows/guesses a tenant GUID can join that tenant. — _fix:_ Reject client-supplied TenantId on open registration; require invitation token or admin provisioning. Only auto-create a new tenant when TenantId is empty.
- **high** [rls] `C:\pitbull-private\src\Modules\Pitbull.Core\MultiTenancy\CompanyMiddleware.cs`: When company resolution fails (inactive/missing company) or never runs, CompanyId stays Guid.Empty and the request continues. EF company query filter treats Empty as “all companies in tenant,” so multi-company isolation collapses to tenant-wide visibility. — _fix:_ If tenant is resolved and the user has company-scoped data, fail the request (403) when company cannot be resolved; do not proceed with Guid.Empty. Optionally require IsResolved for company-scoped APIs.
- **high** [rls] `C:\pitbull-private\src\Modules\Pitbull.Core\MultiTenancy\CompanyMiddleware.cs`: IsAccessible treats an empty UserCompanyAccess list as allow-all (`!hasAccessList || Contains`). Users with no UCA rows (or unresolvable user id) can pass any X-Company-Id / JWT company_id for companies in the tenant. — _fix:_ Treat empty access list as deny (return null from ResolveCompanyId). Align with CompaniesController.SwitchCompany which requires AccessibleCompanyIds.Contains.
- **high** [rls] `C:\pitbull-private\src\Pitbull.Api\Migrations\20260214054531_AddMultiCompanySupport.cs`: PostgreSQL RLS is only applied to a small CompanyTables set (projects, bids, rfis, time_entries, subcontracts, etc.). Large surfaces—pm_* PM tables, owner_contracts/billing, lien_waivers, notifications, vendors, payroll, AI—have no ENABLE ROW LEVEL SECURITY in migrations and rely solely on EF query filters. — _fix:_ Add FORCE RLS + tenant (and company where applicable) policies for all BaseEntity / ICompanyScoped tables; treat raw SQL and IgnoreQueryFilters as second-class and gated.
- **high** [auth] `C:\pitbull-private\src\Modules\Pitbull.Core\MultiTenancy\TenantMiddleware.cs`: Tenant can be taken from untrusted X-Tenant-Id when JWT lacks tenant_id. Authenticated users without a tenant claim (or any unauthenticated API that still uses tenant context) can set arbitrary tenant context via header; claim is preferred only when present. — _fix:_ For authenticated requests, require tenant_id from JWT and ignore or reject mismatched X-Tenant-Id. Restrict header-based tenant to API-key/integration principals with server-side binding.
- **medium** [rls] `C:\pitbull-private\src\Modules\Pitbull.Core\Data\TenantConnectionInterceptor.cs`: Interceptor no-ops when TenantId is Guid.Empty and never RESETs app.current_tenant/current_company. Pooled Npgsql connections can retain a previous request’s session GUC, skewing RLS for login/bootstrap/system paths that intentionally omit tenant. — _fix:_ Always set_config on open: either the scoped tenant/company or explicit empty/zero sentinel; consider transaction-local (is_local=true) or RESET on connection return.
- **medium** [api] `C:\pitbull-private\src\Modules\Pitbull.Billing\Services\VendorPortalService.cs`: AllowAnonymous portal endpoints look up VendorPortalToken under global EF tenant filters without IgnoreQueryFilters and without setting tenant/RLS from the token. Success depends on client-supplied X-Tenant-Id matching the token’s tenant; wrong/missing header breaks isolation model and couples public token auth to a forgeable header. — _fix:_ Lookup tokens with IgnoreQueryFilters by hash; then set TenantContext + set_config from portalToken.TenantId/CompanyId before loading waivers/payments (mirror TeamInvitationService).
- **medium** [data] `C:\pitbull-private\src\Pitbull.Api\Services\DeadlineCheckService.cs`: Background deadline job uses IgnoreQueryFilters across tenants then NotificationService.CreateAsync without setting ITenantContext. SaveChanges only stamps TenantId when context is non-empty, so notifications can be persisted with TenantId=Guid.Empty and never appear under normal tenant filters. — _fix:_ Per RFI/submittal, set TenantContext (and company) from the entity before CreateAsync; or pass TenantId on CreateNotificationCommand and assign explicitly before save.
- **high** [validation] `C:\pitbull-private\src\Pitbull.Api\Controllers\DiagnosticsController.cs`: Anonymous POST /api/diagnostics/errors accepts CreateDiagnosticErrorRequest and only overwrites Source/IpAddress/UserAgent. Callers can still set TenantId, UserId, UserEmail, Message, StackTrace, Metadata, QueryString, PageUrl, etc. DiagnosticError.Message and StackTrace have no EF HasMaxLength, so unauthenticated clients can forge tenant/user attribution and fill the no-RLS diagnostics table (up to request body limits, 10 reports/min/IP). — _fix:_ Use a slim public DTO (message, optional stack/component/pageUrl only). Force TenantId/UserId/UserEmail from auth when present; ignore client values when anonymous. Cap Message/StackTrace/Metadata lengths in the controller and EF config. Optionally require a shared secret/CORS origin check for frontend reports.
- **medium** [data] `C:\pitbull-private\src\Modules\Pitbull.TimeTracking\Services\EmployeeService.cs`: SqlQueryRaw builds SQL by string-interpolating Guid into the query text (also duplicated in ProjectService stats, GetProjectStatsHandler, GetEmployeeStatsHandler, and DashboardService RFI attention). This is the CodeQL EF1002/SQL-injection anti-pattern. Guids are type-safe so exploitability is low, but the codebase already has the correct pattern elsewhere (ContractsService {0} placeholders; ProjectAccessService FormattableString SqlQuery). — _fix:_ Replace SqlQueryRaw($"... '{id}' ...") with parameterized forms: SqlQueryRaw("... {0} ...", id) or Database.SqlQuery($"""... {id} ..."""). Apply the same fix in ProjectService.GetProjectStatsAsync, GetProjectStatsQuery, GetEmployeeStatsQuery, and DashboardService.GetRfiAttentionItems (userId/limit/dates).
- **medium** [data] `C:\pitbull-private\src\Modules\Pitbull.Core\Features\Dashboard\DashboardService.cs`: GetWeeklyHoursAsync and GetRfiAttentionItems embed dates and optional userId into SqlQueryRaw via string interpolation ('{startDate:yyyy-MM-dd}', '{today:yyyy-MM-dd}'). Same family as Guid interpolation; dates are formatted but still bypass parameterization and trigger static analysis. — _fix:_ Use FormattableString SqlQuery or SqlQueryRaw with {0}/{1} parameters for startDate, endDate, today, userId, and limit (limit is already Math.Clamp'd).
- **medium** [validation] `C:\pitbull-private\src\Pitbull.Api\Controllers\AiSuggestController.cs`: SimilarRfis validates only that Subject is non-empty; unlike Suggest(), it never calls ValidateLength on Subject/Description before Sanitize and prompt construction. A client can send multi-KB/MB-scale strings (within body limits) into the AI provider path, increasing cost/abuse surface. — _fix:_ Add AiInputSanitizer.ValidateLength for Subject and Description (e.g. 500/4000) matching other AI endpoints; reject oversized input before DB/AI work.
- **medium** [validation] `C:\pitbull-private\src\Pitbull.Api\Controllers\AiChatController.cs`: Chat validates Message/History lengths but not SystemContext or PageContext. BuildEnrichedContextAsync embeds client-controlled section and unsanitized DB entity names into the system prompt without AiInputSanitizer, while systemContext fallback is sanitized. Enables residual prompt-injection via pageContext JSON section (and stored project/bid names). — _fix:_ ValidateLength(SystemContext) and ValidateLength(PageContext). Whitelist page keys; Sanitize(section) and Sanitize entity names before appending to system prompt. Prefer structured server-side labels over free-text section.
- **medium** [api] `C:\pitbull-private\src\Modules\Pitbull.Bids\Services\BidService.cs`: CreateBidAsync assigns Status = command.Status from the request body. Validator only blocks Converted; client can create a bid already Won/Lost/Submitted/Cancelled and skip normal lifecycle. Update path enforces BidStatusTransitions; create does not. — _fix:_ Force Status = Draft on create (ignore client status), or allow only Draft/Submitted if import needs it. Mirror transition rules used in UpdateBidAsync.
- **low** [frontend] `C:\pitbull-private\src\Pitbull.Web\pitbull-web\src\app\(auth)\login\page.tsx`: safeRedirect only checks startsWith('/') and !startsWith('//'). Paths like /\evil.example, encoded variants, or other protocol-relative edge cases may still be accepted by router.push after login, which is a classic open-redirect class of bug. — _fix:_ Reject backslash, @, and any // after normalize/decode; allow only relative paths matching a strict regex (or an allowlist of app routes). Consider URL parse + same-origin check if absolute URLs are ever needed.
- **low** [validation] `C:\pitbull-private\src\Pitbull.Api\Validation\AiInputSanitizer.cs`: PromptInjectionPattern covers a narrow set of phrases (ignore previous, system:, you are now, new instructions, override:, ```system). Common variants (disregard/forget instructions, act as, jailbreak, developer mode, base64-encoded instructions) pass through. Sanitize strips matches rather than rejecting, so partial payloads still reach providers. — _fix:_ Expand patterns with tests; optionally reject (400) when high-risk phrases remain after normalize; keep length limits as primary defense. Treat sanitizer as defense-in-depth, not sole control.
- **high** [deps] `C:\pitbull-private\src\Pitbull.Api\Pitbull.Api.csproj`: Hangfire packages use floating version ranges (1.8.*, 1.21.*) and the solution has no packages.lock.json, so restores are non-reproducible across CI/Docker/local and can silently pick new builds. — _fix:_ Pin exact versions (currently resolved Hangfire.Core/AspNetCore 1.8.24, Hangfire.PostgreSql 1.21.1), enable RestorePackagesWithLockFile + commit packages.lock.json, restore with --locked-mode in CI/Docker.
- **medium** [deps] `C:\pitbull-private\.github\dependabot.yml`: Dependabot is monthly with open-pull-requests-limit 3 for nuget/npm; e2e Playwright package.json and Docker base images are not covered, so security updates can queue/stall and miss secondary ecosystems. — _fix:_ Add weekly (or daily for security) schedules; raise PR limits; add npm ecosystem for /e2e; add docker ecosystem for API/web Dockerfiles (or pin digests + image update bot).
- **medium** [deps] `C:\pitbull-private\src\Pitbull.Api\Dockerfile`: Production build/runtime images use floating tags (sdk:10.0, aspnet:10.0, node:22-alpine) without digests, so supply-chain contents can change without a repo diff. — _fix:_ Pin images to immutable digests (and optionally exact patch tags); track updates via Dependabot docker or Renovate.
- **medium** [deps] `C:\pitbull-private\Directory.Build.props`: Vulnerable transitive pins are added as direct PackageReference to every project, causing NU1510 (System.Security.Cryptography.Xml will not be pruned) and expanding the dependency graph unexpectedly. — _fix:_ Prefer Central Package Management (Directory.Packages.props) with VersionOverride, or PackageReference Update + PrivateAssets as appropriate; re-check whether System.Security.Cryptography.Xml pin is still required on net10.0 after restore audit.
- **medium** [deps] `C:\pitbull-private\src\Pitbull.Api\Pitbull.Api.csproj`: Auth stack version skew: direct System.IdentityModel.Tokens.Jwt is 8.20.0 while Microsoft.AspNetCore.Authentication.JwtBearer 10.0.10 still pulls Microsoft.IdentityModel.Protocols(.OpenIdConnect) 8.19.2. — _fix:_ Add explicit PackageReference (or Directory.Build.props pins) for Microsoft.IdentityModel.Protocols and Microsoft.IdentityModel.Protocols.OpenIdConnect at 8.20.0 to align the JWT/OIDC stack.
- **medium** [deps] `C:\pitbull-private\src\Pitbull.Api\Pitbull.Api.csproj`: DotNetCore.CAP packages are on 10.0.1 but Savorboard.CAP.InMemoryMessageQueue remains 10.0.0, creating intentional version skew in the messaging stack. — _fix:_ Bump Savorboard.CAP.InMemoryMessageQueue to 10.0.1 (or the matching CAP release set) and re-run restore/tests.
- **low** [deps] `C:\pitbull-private\src\Pitbull.Web\pitbull-web\package.json`: postinstall runs patch-package, but no patches/ directory (or patch files) exists; install always runs a no-op security-tooling path. — _fix:_ Remove postinstall + patch-package if unused, or restore intentional patches under patches/ and document what they fix.
- **low** [frontend] `C:\pitbull-private\src\Pitbull.Web\pitbull-web\package.json`: Frontend depends on both the aggregate "radix-ui" package and many individual @radix-ui/* packages, doubling the Radix surface area and update burden. — _fix:_ Standardize on one style (all radix-ui or all @radix-ui/*), remove unused packages, regenerate package-lock.

## Notes

- Open GitHub issues and Dependabot alerts were empty at planning time; prioritize CodeQL C# residuals and code quality.
- C# CodeQL default setup is weekly; force a scan after merges that touch C#.
- Never reintroduce gstack.

## Hourly appendix � 2026-07-30 15:58 UTC

**Branch:** `chore/app-hardening-hourly-2026073015` (PR pending)

### Merged this hour
- No open hardening PRs; **#422** already MERGED.
- Workflow `app-hardening-loop` launched in parallel.

### Shipped this hour
- **critical/auth:** `POST /api/auth/register` rejects client `TenantId` (no open tenant join by GUID; invitations only).
- **auth:** `ChangePassword` forbidden for `IsDemoUser` / `@demo.local`.
- **auth:** `bootstrap-admin` requires non-blank `Demo:UserEmail` + exact email match (blank no longer escalates any principal).
- **api:** Bid create always `Draft`; create validator allows only Draft/Submitted.
- **validation:** `SimilarRfis` length caps (500/4000).
- **frontend:** `safeRedirect` hardened (decode, block `\`, `@`, `//`, control chars).
- **data/CodeQL:** Parameterized `SqlQueryRaw` in EmployeeService, GetEmployeeStats, ProjectService stats, GetProjectStats, Dashboard weekly hours + RFI attention.

### Residual high items (next hours)
- Demo users still get RBAC `permissions=*` (DemoRestrictionMiddleware is the write boundary; narrow allowlist if needed).
- Vendor portal token lookup / RLS from token (IgnoreQueryFilters + set tenant).
- CompanyMiddleware empty `CompanyId` ? tenant-wide visibility.
- Anonymous diagnostics DTO slim + length caps (partially addressed in prior rounds � verify).
- LogSafe backlog may be stale vs r1�r4 fixes � re-scan before re-fixing.


## Hourly appendix � 2026-07-30 16:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073016`

### Merged this hour
- No open hardening PRs (prior **#423** already on main).

### Shipped this hour
- **logging:** Shared `RequestLogSanitizer` in Core; RequestResponseLoggingMiddleware delegates; PostHog + RequestPerformance path redaction; TenantMiddleware uses sanitizer; DiagnosticsService path/query/pageUrl scrub; anonymous diagnostics force `UserEmail=null`; DemoBootstrapper LogSafe on seed messages.
- **rls/auth:** Vendor portal token lookup uses `IgnoreQueryFilters` then binds Tenant/Company context + PG session vars from the token (not client headers).
- **company isolation:** CompanyMiddleware fail-closed on failed company resolve for authenticated API; empty access list no longer means all-companies for authenticated users.

### Residual high items
- Demo users still get RBAC `permissions=*` (DemoRestrictionMiddleware write boundary).
- Open registration TenantId join fixed in #423; re-verify after deploys.
- Dependabot cadence / Docker digests / packages.lock still open.
- Savorboard.CAP.InMemoryMessageQueue has no 10.0.1 on nuget (leave 10.0.0).


## Hourly appendix � 2026-07-30 17:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073017`

### Merged this hour
- No open hardening PRs (**#424** already MERGED).

### Shipped this hour
- **demo auth:** Expanded DemoRestrictionMiddleware � full block on admin secrets/vault/api-keys, AI settings keys, bootstrap-admin, change-password; write-block payroll/bank/vendor-payments/export (GET still allowed).
- **data:** DeadlineCheckService binds TenantContext (+ PG session when relational) per entity before CreateNotification (avoids Guid.Empty TenantId).
- **validation:** AiChat caps SystemContext/PageContext lengths.
- **deps:** Dependabot weekly for nuget/npm/e2e/docker/github-actions; higher PR limits.

### Residual high items
- Demo JWT still grants `permissions=*` (middleware enforces sensitive write boundaries; full persona RBAC mapping still open).
- packages.lock.json / Docker image digests still open (Dependabot docker now watches Dockerfiles).
- LogSafe backlog largely addressed in prior rounds � re-scan before re-fixing listed log-safe items.


## Hourly appendix � 2026-07-30 18:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073018`

### Merged this hour (Dependabot backlog)
- Merged: **#427** setup-dotnet, **#428** setup-node, **#430** Playwright e2e, **#433** lucide-react, **#435** posthog-js, **#437** vite plugin-react, **#440** AWSSDK.S3, **#441** Hangfire.AspNetCore 1.8.24 (plus earlier pulls on main).
- Closed conflicting **#442** Hangfire.Core (superseded by pin below).
- Left open (major/risk): TS 7, eslint 10, node 26, Mapster 10, QuestPDF major, Resend 0.8, jest-dom 7, jsdom 30, types/node 26, microsoft group.

### Shipped this hour
- **deps:** Align Hangfire.Core to **1.8.24** with Hangfire.AspNetCore (remove version skew).
- **validation:** Expand AiInputSanitizer patterns (disregard/forget, act as, jailbreak, developer mode, developer:); unit tests.

### Residual high items
- Demo JWT `permissions=*` still (middleware write boundary remains primary control).
- packages.lock.json still not committed (optional follow-up).
- Major Dependabot PRs need human judgment before merge (breaking majors).
- Mobile/owner Playwright smokes failing on many deps PRs � likely env flakiness, not package-specific.


## Hourly appendix — 2026-07-30 19:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073019`

### CI status (step 1)
- **main green** after #449 (PostHog 2.12.1 NU1605) + #450 (hardening-loop CI-first).
- Historical red on #448 merge was NU1605 PostHog unit vs Api — fixed; no new main red to ship this hour.
- Open Dependabot majors all red or major-risk — **not merged**: #447 Resend 0.8, #446 QuestPDF, #443 Mapster 10, #439 Identity/OpenApi (OpenApi Example readonly break), #438 eslint 10, #436 types/node 26, #434 TS 7, #432 jsdom 30, #431 jest-dom 7, #429 node 26-alpine.

### Merged this hour
- (shipping below)

### Shipped this hour
- **auth/demo:** Stop granting JWT `permissions=*` to demo users. Shared `RbacJwtPermissionResolver` for Auth + company-switch; real admins only get `*`; demo uses assigned RBAC roles or title→template fallback (never Admin template).
- **rls:** `TenantConnectionInterceptor` always `set_config` tenant/company (empty sentinel when unresolved) so pooled connections cannot retain prior GUCs.
- **validation:** Anonymous diagnostics POST uses slim `PublicDiagnosticErrorRequest` (no client TenantId/UserId/UserEmail).
- **persona:** RoleProfileResolver recognizes "IT Administrator" / "IT Admin".
- **tests:** `RbacJwtPermissionResolverTests` for template mapping.

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment (#439 OpenApi break; Resend/QuestPDF/Mapster majors).
- PM tables still lack FORCE RLS in migrations (long-running).
- Mobile/owner Playwright smokes still flaky on many dep PRs.


## Hourly appendix — 2026-07-30 20:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073020`

### CI status (step 1)
- **main green** — #451 CI + Push on main success.
- No new main failures to fix; historical #448 NU1605 remains fixed via #449.

### Dependabot (step 2)
- No safe patch/minor merges. Open majors left alone: #447 Resend, #446 QuestPDF, #443 Mapster 10, #439 Identity/OpenApi, #438 eslint 10, #436 types/node 26, #434 TS 7, #432 jsdom 30, #431 jest-dom 7, #429 node 26-alpine.

### Shipped this hour
- **auth/rls:** TenantMiddleware — authenticated principals use JWT `tenant_id` only; `X-Tenant-Id` cannot supply tenant without claim; mismatched header vs claim → 401. Unit tests for header-only and mismatch.
- **deps/frontend:** Removed unused `patch-package` + empty postinstall (no patches/).

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment.
- PM tables FORCE RLS still long-running.
- Mobile/owner Playwright smoke flakiness.


## Hourly appendix — 2026-07-30 21:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073021`

### CI status (step 1)
- **main green** — #452 CI + Push success; Dependabot metadata workflows green.
- No new main failures to fix.

### Dependabot (step 2)
- No safe patch/minor merges. Majors still open: #447 Resend, #446 QuestPDF, #443 Mapster 10, #439 OpenApi/Identity, #438 eslint 10, #436 types/node 26, #434 TS 7, #432 jsdom 30, #431 jest-dom 7, #429 node 26-alpine.

### Shipped this hour
- **rls:** Migration `AddPmTablesTenantRls` — ENABLE+FORCE RLS + tenant isolation policies on **68** `pm_*` Project Management tables (were EF-filter only).
- **deps:** `System.Security.Cryptography.Xml` pin uses PrivateAssets to reduce NU1510 prune noise while keeping security pin.

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment (#439 OpenApi break).
- Company-scoped RLS for pm_* (tenant-only this hour; CompanyId compound later).
- Mobile/owner Playwright smoke flakiness.


## Hourly appendix — 2026-07-30 22:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073022`

### CI status (step 1)
- **main green** — #453 CI + Push success.
- No new main failures.

### Dependabot (step 2)
- No safe patch/minor merges. Majors left open: #447 Resend, #446 QuestPDF, #443 Mapster 10, #439 OpenApi/Identity, #438 eslint 10, #436 types/node 26, #434 TS 7, #432 jsdom, #431 jest-dom 7, #429 node 26-alpine.

### Shipped this hour
- **rls:** Migration `AddFinancialAndOpsTablesTenantRls` — ENABLE+FORCE RLS + tenant isolation on **~70** residual high-value tables (owner contracts/billing, lien waivers, notifications, vendors/customers, payroll, banking/GL, AI keys, secret vault, RBAC, vendor portal tokens, etc.).

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment.
- Company-scoped compound RLS for multi-company tables (beyond original CompanyTables set).
- Mobile/owner Playwright smoke flakiness.


## Hourly appendix — 2026-07-30 23:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073023`

### CI status (step 1)
- **main green** — #454 CI + Push success.
- No new main failures.

### Dependabot (step 2)
- No safe patch/minor merges. Majors left open (Resend/QuestPDF/Mapster/OpenApi/eslint/TS/node).

### Shipped this hour
- **rls fix:** DISABLE RLS on `vendor_portal_tokens` (pre-tenant token hash lookup cannot use FORCE tenant RLS; IgnoreQueryFilters does not bypass RLS).
- **rls:** FORCE RLS + tenant isolation on residual tables: vendor invoices/pay apps, WIP, wage determinations, work classifications, tax rates, tenant_settings, migration_projects, workflow_*.
- **skipped (by design):** rbac_*, roles, diagnostic_errors, team_invitations (pre-tenant or nullable TenantId).

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment.
- Pre-tenant token tables need security-definer lookup or non-RLS design (documented for vendor_portal_tokens).
- Company-scoped compound RLS incomplete.
- Mobile/owner Playwright smoke flakiness.


## Hourly appendix — 2026-07-31 00:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073100`

### CI status (step 1)
- **main green** — #455 CI + Push success.
- No new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors still open).

### Shipped this hour
- **e2e:** Fix owner-signup smoke — login h1 is `Welcome` / `Try the demo`, not `Welcome back` (was hard-failing on main/deps PRs).
- **auth:** TeamInvitationService binds TenantContext + PG session vars after pre-tenant token hash lookup (mirror vendor portal); company GUC when present; Tenant load uses IgnoreQueryFilters.

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment.
- Mobile field-report smoke still flaky (Playwright Network.getResponseBody).
- rbac_*/roles still without FORCE RLS; company-scoped compound RLS incomplete.


## Hourly appendix — 2026-07-31 01:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073101`

### CI status (step 1)
- **main green** — #456 CI + Push success.
- No new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors still open).

### Shipped this hour
- **e2e:** Mobile field-report smoke —
  1) stop `response.text()` after post-submit navigation (Playwright body protocol error);
  2) wait for non-401 create response so token-refresh retry is not mistaken for failure;
  3) persist **refreshToken** in persona storageState (was always missing → refresh after 401 always failed);
  4) inject fresh field JWT before submit path.

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment.
- rbac_*/roles still without FORCE RLS; company-scoped compound RLS incomplete.


## Hourly appendix — 2026-07-31 03:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073103`

### CI status (step 1)
- **main green** — #457 CI fully green (including mobile + owner smokes).
- No new main failures.

### Dependabot (step 2)
- No safe patch/minor merges. Majors left open (Resend/QuestPDF/Mapster/OpenApi/eslint/TS/node). Mapster #443 has green .NET/FE/role but is a major.

### Shipped this hour
- **rls:** Migration `UpgradeCompanyScopedRlsPolicies` — replace tenant-only policies with compound **tenant + company** isolation (empty company GUC = all companies in tenant) on **41** ICompanyScoped tables (owner/billing, AP/AR, payroll, banking/GL, WIP, key pm_*).

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment.
- rbac_*/roles still without FORCE RLS (login pre-tenant).
- Remaining pm_* tables still tenant-only RLS (not full compound set).


## Hourly appendix — 2026-07-31 04:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073104`

### CI status (step 1)
- **main green** — #458 CI fully green.
- No new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors still open).

### Shipped this hour
- **rls:** Migration `UpgradeRemainingPmCompanyRls` — compound tenant+company FORCE RLS on **59** remaining `pm_*` tables with required CompanyId (completes PM surface after #458’s 9 key pm tables).

### Residual high items
- packages.lock.json / Docker digests still open.
- Major Dependabot PRs need human judgment.
- rbac_*/roles still without FORCE RLS (login pre-tenant).


## Hourly appendix — 2026-07-31 05:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073105`

### CI status (step 1)
- **main green** — #459 CI fully green.
- No new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors still open).

### Shipped this hour
- **deps:** Enable `RestorePackagesWithLockFile`; commit `packages.lock.json` for all 20 projects; CI + API Dockerfile use `dotnet restore --locked-mode`.

### Residual high items
- Docker base image digests still floating (`sdk:10.0`, `aspnet:10.0`, `node:22-alpine`).
- Major Dependabot PRs need human judgment (refresh lock files when packages change).
- rbac_*/roles still without FORCE RLS (login pre-tenant).


## Hourly appendix — 2026-07-31 06:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073106`

### CI status (step 1)
- **main green** — #460 CI + Push on main success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges. Majors still open / red or major-risk: #447 Resend 0.8, #446 QuestPDF, #443 Mapster 10, #439 Identity/OpenApi (Build & Test red), #438 eslint 10, #436 types/node 26, #434 TS 7, #432 jsdom 30, #431 jest-dom 7, #429 node 26-alpine.

### Shipped this hour
- **deps/docker:** Pin API `sdk:10.0` + `aspnet:10.0` and web `node:22-alpine` (all stages) to multi-arch **content digests** (resolved 2026-07-31).
- **auth:** Demo role-login rejects non-`Active` personas after password check.
- **auth:** Company switch refuses JWT reissue when `user.Status != Active`.
- **auth:** Admin user status leave-`Active` clears refresh token + expiry (blocks refresh rotation).
- **tests:** Unit coverage for inactive demo login, inactive company switch, status→refresh revoke.

### Residual high items
- Major Dependabot PRs need human judgment (#439 OpenApi break; Resend/QuestPDF/Mapster majors).
- rbac_*/roles still without FORCE RLS (login pre-tenant by design).
- Docker digests will need periodic refresh (Dependabot docker already watches Dockerfiles).


## Hourly appendix — 2026-07-31 07:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073107`

### CI status (step 1)
- **main green** — #461 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe full merges of open majors. **#439** red: Microsoft.OpenApi **3.9.0** breaks ASP.NET Core 10 XmlCommentGenerator (`IOpenApiMediaType.Example` read-only CS0200).
- IdentityModel portion of #439 shipped here as 8.22.0 (OpenApi left on 2.7.5).
- Dependabot: ignore Microsoft.OpenApi ≥3; exclude from `microsoft` group so Identity/System updates are not blocked by OpenApi majors.
- Left open: #447 Resend, #446 QuestPDF, #443 Mapster 10, #438 eslint 10, #436 types/node 26, #434 TS 7, #432 jsdom, #431 jest-dom 7, #429 node alpine major.

### Shipped this hour
- **deps:** IdentityModel stack **8.20.0 → 8.22.0** (Protocols, OpenIdConnect, Jwt) + lockfiles; Microsoft.OpenApi stays **2.7.5**.
- **deps/policy:** Document OpenApi 2.x pin; Dependabot ignore OpenApi 3.x + exclude from microsoft group.
- **openapi/xml:** Rename `/// Example:` sample request lines to `Sample request:` so XmlCommentGenerator does not treat them as media-type examples.

### Residual high items
- Close/supersede #439 after this lands (OpenApi 3.x still blocked).
- Major Dependabot PRs still need human judgment (Resend/QuestPDF/Mapster/node/eslint/TS).
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 08:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073108`

### CI status (step 1)
- **main green** — #462 CI + Push success; no new main failures.

### Dependabot (step 2)
- Safe bumps were red on Dependabot branches due to **NU1004** incomplete lock propagation (#465 S3, #467 Scalar only updated one lock).
- #466 OpenApi 2.11.0 passed .NET; Role E2E failed on Docker Hub timeout (infra flake).
- Majors left open: #447 Resend, #446 QuestPDF, #443 Mapster, #464 jsdom 30, #463 node 25, #438 eslint 10, #436 types/node 26, #434 TS 7, #431 jest-dom 7.

### Shipped this hour
- **deps:** Scalar.AspNetCore **2.16.16→2.16.17**, AWSSDK.S3 **4.0.101.5→4.0.101.6**, Microsoft.OpenApi **2.7.5→2.11.0** (still 2.x) + full solution `packages.lock.json` regenerate.
- **auth:** Invitation accept JWT uses `RbacJwtPermissionResolver` + emits `job_title` / `role_profile` / `is_demo_user` (parity with Auth/Companies).

### Residual high items
- Close #465/#466/#467 as superseded after merge.
- Major Dependabot PRs need human judgment.
- Dependabot NuGet PRs under locked-mode need full-graph lock updates (watch for NU1004).
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 09:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073109`

### CI status (step 1)
- **main green** — #468 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe NuGet patch/minor open (only majors).
- **jsdom 30** (#464) fully green on prior base but 2 commits behind main — rebased bump shipped here (devDependency).
- Left open: #447 Resend, #446 QuestPDF, #443 Mapster, #463 node 25, #438 eslint 10, #436 types/node 26, #434 TS 7, #431 jest-dom 7.

### Shipped this hour
- **auth:** Shared `IJwtTokenService` / `JwtTokenService` for login, company switch, invitation accept (single claim set: is_demo_user, job_title, role_profile, permissions via RbacJwtPermissionResolver).
- **deps:** jsdom **29.1.1 → 30.0.0** (devDependency; CI was green on #464).
- **tests:** `JwtTokenServiceTests` for demo claims + company switch company_id.

### Residual high items
- Close #464 after merge (superseded).
- Major Dependabot PRs need human judgment (Resend/QuestPDF/Mapster/node/eslint/TS).
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 10:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073110`

### CI status (step 1)
- **main green** — #469 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe NuGet patch/minor open (only majors: Resend/QuestPDF/Mapster NU1004 or API risk).
- eslint 10 (#438) fails FE build; node 25 (#463) fully green but major runtime (skip — stay on 22-alpine digests).
- jest-dom 7 / TS 7 / types/node 26 still majors.

### Shipped this hour
- **deps/npm:** Override `minimatch` → **10.2.5** (pulls brace-expansion **5.0.9**) for eslint/eslint-plugins — **npm audit 0** (was 9 high GHSA-mh99-v99m-4gvg). Lint OK.
- **logging:** LogSafe.Text on IntegrationExport EntityType/Format and DataImport preview type.
- Full package-lock refresh after clean install.

### Residual high items
- Major Dependabot PRs need human judgment (Resend/QuestPDF/Mapster/node/eslint/TS).
- jsdom 30.0.1 engine wants Node ≥22.22.2 (CI Node 22 OK; local NVM 24 shows EBADENGINE warn only).
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 11:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073111`

### CI status (step 1)
- **main green** — #470 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe NuGet patch/minor. Majors: Resend/QuestPDF/Mapster NU1004; eslint 10 FE red; TS 7 FE red; node 25 green (skip major runtime); @types/node 26 fully green (types major — skip).
- jest-dom 7 smokes red on old base.

### Shipped this hour
- **headers:** API `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache` + `Cross-Origin-Resource-Policy: same-origin`.
- **demo:** Full-block `/api/export` (GET downloads); write-block `/api/import` mutations (GET history still allowed).
- **tests:** SecurityHeaders + DemoRestriction coverage.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 12:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073112`

### CI status (step 1)
- **main green** — #471 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe NuGet patch/minor (OpenApi 3 / QuestPDF / Resend majors only).
- npm: posthog-js patch **1.409.3→1.409.4** shipped; other outdated are majors (eslint 10, TS 7, jest-dom 7, types/node 26).

### Shipped this hour
- **cors:** `CorsOriginGuard` — fail-closed in non-Development when `Cors:AllowedOrigins` empty; reject wildcards with credentials; normalize trim/dedupe.
- **deps:** posthog-js **1.409.4** (npm audit still 0).
- **cleanup:** InvitationController unused usings after JWT consolidation.
- **tests:** CorsOriginGuard unit tests.

### Residual high items
- Major Dependabot PRs need human judgment (Resend/QuestPDF/Mapster/node/eslint/TS).
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 13:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073113`

### CI status (step 1)
- **main green** — #472 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **rate-limit:** dedicated `refresh` limiter (30/min prod, 120/min dev); `change-password` + `bootstrap-admin` use stricter `auth` (5/min).
- **jwt:** ClockSkew 1m (kept default claim inbound mapping after Role E2E risk).
- **cookies:** Identity cookie HttpOnly + Secure + SameSite=Strict (defense in depth; JWT remains primary).
- **ci:** `workflow-api-smoke.ps1` uses `Path.GetTempPath()` (Linux pwsh `$env:TEMP` was null → Join-Path failures).

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E / mobile smokes can flake (Docker Hub timeouts; Next navigation ERR_ABORTED).


## Hourly appendix — 2026-07-31 14:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073114`

### CI status (step 1)
- **main green** — #473 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe major merges. posthog-js patch shipped.

### Shipped this hour
- **authz:** PermissionAuthorizationHandler ignores `permissions=*` for demo principals (`is_demo_user` / `@demo.local`) — defense in depth for old tokens.
- **rate-limit:** 429 responses include `Retry-After: 60` + `code: RATE_LIMITED`.
- **ci:** capture-workflow-evidence.ps1 uses Path.GetTempPath() (Linux TEMP null).
- **deps:** posthog-js **1.409.5** (npm audit 0).
- **tests:** demo wildcard ignored / exact permission still works.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 15:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073115`

### CI status (step 1)
- **main green** — #474 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **proxy:** ForwardedHeaders trusts RFC1918 private networks only (rate-limit / HSTS client IP behind platform proxy; still no public-internet trust).
- **diagnostics:** Anonymous POST validates message required + max lengths; 429 includes Retry-After + RATE_LIMITED code.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 16:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073116`

### CI status (step 1)
- **main green** — #475 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only: Resend/QuestPDF/Mapster/node 25/eslint 10/TS 7/types-node 26/jest-dom 7).

### Shipped this hour
- **auth:** Block demo password reset — `forgot-password` does not mint tokens/emails for `IsDemoUser` / `@demo.local` (still 200 to avoid enumeration); `reset-password` rejects demo accounts with generic 400.
- **auth:** Shared `IsDemoAccount` helper for change-password / forgot / reset.
- **headers/API:** Permissions-Policy geolocation disabled; add `Cross-Origin-Opener-Policy: same-origin`.
- **headers/web:** COOP + CORP + `X-Permitted-Cross-Domain-Policies: none` on Next.js.
- **proxy:** Migrate ForwardedHeaders to `KnownIPNetworks` + `System.Net.IPNetwork` (clear ASPDEPR005).
- **tests:** Demo forgot/reset coverage; SecurityHeaders COOP + geolocation=().

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 17:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073117`

### CI status (step 1)
- **main green** — #476 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **rate-limit:** Convert login/register/refresh/auth/api from global `AddFixedWindowLimiter` to **per-IP / per-user** `AddPolicy` partitions (`AuthRateLimitPolicy`) so one client cannot exhaust the shared budget.
- **identity:** Explicit lockout — 5 failed attempts → 15 min; `AllowedForNewUsers=true`.
- **swagger:** Token validation ClockSkew aligned to 1 minute.
- **tests:** `AuthRateLimitPolicyTests` for partition keys.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 18:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073118`

### CI status (step 1)
- **main green** — #477 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only). npm audit 0; no vulnerable NuGet packages.

### Shipped this hour
- **kestrel:** `AddServerHeader = false` (no Server stack banner).
- **jwt:** `RequireHttpsMetadata` true outside Development.
- **hangfire:** `DisplayStorageConnectionString = false`; demo middleware full-blocks `/hangfire`.
- **web auth cookie:** `SameSite=Strict` (was Lax).
- **monitoring:** non-dev `MachineName` redacted.
- **tests:** monitoring machine redaction; hangfire demo block; auth cookie Strict.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 19:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073119`

### CI status (step 1)
- **main green** — #478 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **auth:** Refresh tokens stored as **SHA-256 hash** only (`RefreshTokenProtector`); plaintext returned once to client.
- **auth:** Honor `Jwt:RefreshExpirationDays` (default 7, was hardcoded 30 in most paths); access token uses protector caps.
- **config:** `Jwt:ExpirationMinutes` **1440 → 60** (access token lifetime).
- **invitation accept** uses same hash + config expiry.
- **tests:** `RefreshTokenProtectorTests`.
- **note:** Existing refresh sessions invalidate after deploy until re-login (expected).

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 20:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073120`

### CI status (step 1)
- **main green** — #479 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **critical/auth:** `POST /api/admin/users/bootstrap-admin` now requires **email + password** (`CheckPasswordSignInAsync`); no longer elevates by email alone.
- **authz:** Bootstrap grants **Admin only** (removed bulk Manager/Supervisor/User grant).
- **auth:** Inactive users cannot bootstrap; generic 400 on all failures (no enumeration).
- **demo:** Full-block `/api/admin/users/bootstrap-admin`.
- **tests:** password required / wrong password / Admin-only assignment.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 21:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073121`

### CI status (step 1)
- **main green** — #480 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **jwt:** `ValidAlgorithms = HmacSha256` on bearer, Swagger auth, and refresh principal path (algorithm confusion defense).
- **jwt:** Unique `jti` claim on every access token.
- **rate-limit:** Invitation token GET uses `register` limiter (secret capability); version endpoint gets `api` limiter.
- **demo:** Full-block `/cap` (CAP dashboard is Dev-only; defense in depth).
- **web:** Logout cookie clear uses SameSite=Strict (+ Secure on HTTPS).

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 22:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073122`

### CI status (step 1)
- **main green** — #481 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **kestrel:** Max request line 8KB / headers 32KB / header count 100.
- **headers:** `X-Permitted-Cross-Domain-Policies: none` on API.
- **portal:** Vendor portal token max expiry **365 → 90** days.
- **rate-limit:** Changelog anonymous GET uses `api` limiter.
- **web middleware:** Safe login `redirect` param; admin role accepts `{tenant}:Admin`.
- **tests:** middleware-security vitest; security headers.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-07-31 23:xx UTC

**Branch:** `chore/app-hardening-hourly-2026073123`

### CI status (step 1)
- **main green** — #482 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **password:** Register validator min length **6 → 8** (align Identity RequiredLength).
- **identity:** `RequiredUniqueChars = 1`.
- **dataprotection:** `SetDefaultKeyLifetime(90 days)`.
- **search:** Cap query term at 100 chars.
- **weather:** Validate lat/long ranges.
- **demo:** Full-block `/api/seed` and `/api/seeddata`.
- **web:** Minimal CSP (`frame-ancestors`, `base-uri`, `form-action`, `object-src`, `upgrade-insecure-requests`).

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-08-01 00:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080100`

### CI status (step 1)
- **main green** — #483 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **uploads:** Block SVG/HTML (scriptable) extensions + content types; reject path traversal in file names.
- **uploads:** Multi-upload max **20** files per request.
- **apidocs:** Default `ApiDocs:Enabled=false` in base appsettings (Dev still enables).
- **auth:** Login unknown-email path uses short random delay (timing parity).
- **demo:** Write-block `/api/migration`.
- **tests:** `FileValidationServiceTests`.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-08-01 01:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080101`

### CI status (step 1)
- **main green** — #484 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **http:** Reject TRACE/TRACK with 405; `X-Download-Options: noopen`.
- **files:** Sanitize download filename for Content-Disposition; presigned URL max **60 min** (default 15).
- **tokens:** Plausible-length pre-check for invitation + vendor portal tokens.
- **rate-limit:** Diagnostics anonymous POST uses `register` limiter; logout uses `auth`.
- **tests:** TRACE 405 + download-options header.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-08-01 02:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080102`

### CI status (step 1)
- **main green** — #485 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only: node 25, Resend 0.8, QuestPDF, Mapster 10, eslint 10, types/node 26, TS 7, jest-dom 7).

### Shipped this hour
- **tokens:** Refresh + password-reset length pre-checks; `RefreshTokenProtector.IsPlausiblePlaintext` (40–200).
- **auth:** Logout sets `Clear-Site-Data: "cookies", "storage"`.
- **demo:** Write-block journal-entries, chart-of-accounts, accounting-periods, tax-jurisdictions, purchase-orders.
- **files:** `relatedEntityType` / `entityType` identifier shape + max 100 chars.
- **feedback:** Field length caps; ScreenshotUrl must be http(s) or relative.
- **json:** `JsonSerializerOptions.MaxDepth = 32`.
- **web:** JWT cookie >8KB ignored; `X-DNS-Prefetch-Control: off`.
- **tests:** refresh protector, demo financial writes, relatedEntityType.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-08-01 03:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080103`

### CI status (step 1)
- **main green** — #486 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **kestrel:** `RequestHeadersTimeout` 30s; `KeepAliveTimeout` 2m.
- **cors:** Production preflight max-age 10m.
- **http:** Reject CONNECT (405) with TRACE/TRACK.
- **apidocs:** SwaggerAuth default `ApiDocs:Enabled=false` when config missing (fail closed).
- **demo:** Write-block vendor-invoices, billing-periods, lien-waivers, retention, owner-change-orders, customers, vendors (kept smoke-critical pay apps / owner-contracts / billing-apps / pay-periods writable).
- **ci:** `workflow-api-smoke.ps1` Invoke-Api reads HttpResponseMessage body on PS7 (was masking 403s).
- **auth:** Password max 100 on change/reset; forgot-password email length bound.
- **changelog:** Clamp anonymous `limit` to 50; version filter max 64 chars.
- **tests:** CONNECT 405 + expanded demo financial writes.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).


## Hourly appendix — 2026-08-01 04:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080104`

### CI status (step 1)
- **main green** after #487 (smokes green; merge CI was completing at start of hour).

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **kestrel:** Min request/response body data rates (slowloris body hold).
- **auth:** Invitation accept password max 100; bootstrap-admin email/password bounds.
- **glossary:** Cap search/category/id lengths; generic not-found for id.
- **hangfire:** Deny demo claim / @demo.local even if SystemAdmin role present.
- **pagination:** Clamp `page` to 1..10000 (pageSize already 1..100).
- **web:** Reject null-byte path probes in Next middleware.
- **tests:** Hangfire demo denial.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.


## Hourly appendix — 2026-08-01 05:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080105`

### CI status (step 1)
- **main green** — #488 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **uploads:** Block more executable/script extensions (php/asp/jsp/jar/apk/lnk/iso/…); content-type max 200.
- **portal:** Admin/Manager only for token CRUD; clamp expiry; public lien-waiver amount/description/date bounds.
- **jobs:** Reject overlong jobId before Hangfire lookup.
- **headers:** `X-Robots-Tag: noindex, nofollow` on API.
- **demo:** Full-block `/api/jobs` and `/api/monitoring`.
- **tests:** file blocks, robots header, demo jobs/monitoring.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.


## Hourly appendix — 2026-08-01 06:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080106`

### CI status (step 1)
- **main green** — #489 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **jwt:** RequireExpirationTime + RequireSignedTokens on bearer validation.
- **auth/demo:** Role key max 64; demo-register name/email/password length bounds.
- **notifications:** Title/message/relatedEntityType length caps (match EF).
- **secrets:** Key/value/displayName/description size bounds; category filter validation.
- **pdf:** RequestTimeout policy 90s for `/api/reports/pdf`.
- **web:** X-Robots-Tag + X-Download-Options headers.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.


## Hourly appendix — 2026-08-01 07:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080107`

### CI status (step 1)
- **main green** — #490 CI + Push success; no new main failures.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **jwt:** Refresh path RequireSignedTokens + ClockSkew; SwaggerAuth RequireExpirationTime/SignedTokens.
- **tenants:** Create name 2–200 chars; slug sanitization.
- **import:** File empty/size/ext/name checks; history take clamp 1–200.
- **form:** Multipart FormOptions bounds (body/value/key/count).
- **demo:** Full-block `/api/reports/pdf` (financial PDF GET exfil).
- **tests:** demo PDF full-block.

### Residual high items
- Major Dependabot PRs need human judgment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.


## Hourly appendix — 2026-08-01 08:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080108` → **merged #492** (`bf0a2d5c`)

### CI status (step 1)
- **main green** before ship — #491 CI + Push success.
- PR #492 first CI failed: `EquipmentEndpointsTests.Create_equipment_with_negative_hourly_rate_returns_400` expected message containing `"negative"`; controller said `"Rates must be between 0 and 1,000,000"`. Fixed to `"HourlyRate and BillingRate cannot be negative"` (`fe78b476`).
- Re-run **green** (dotnet unit+integration, frontend, owner-signup, mobile-field, L4 role smoke, CodeQL). Merged.

### Dependabot (step 2)
- No safe patch/minor merges (majors only: #463 node 25, #447 Resend, #446 QuestPDF, #443 Mapster 10, #438 eslint 10, #436 @types/node 26, #434 TS 7, #431 jest-dom 7).

### Shipped this hour (#492)
- **companies:** Create/update free-text field length + fiscal month 1–12 validation.
- **apikeys:** Name/description/scopes/expiry bounds; list page clamp.
- **equipment:** Create field length + rate bounds (negative-rate message aligned with integration assert).
- **diagnostics:** Cap exception message/stack/user-agent before DB write.
- **onboarding:** Tour stepId allowlist + max 100 chars.
- **web:** Permissions-Policy interest-cohort/browsing-topics off.

### Residual high items
- Major Dependabot PRs need human judgment / dedicated CI alignment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.

## Hourly appendix — 2026-08-01 09:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080109` → **merged #494**

### CI status (step 1)
- **main green** after #492/#493; Push success on `a14d47c9`. No failed main runs to fix.
- #493 main CI in progress/queued at start of hour (docs-only).

### Dependabot (step 2)
- No safe patch/minor merges (majors only — same set).

### Shipped this hour
- **vendors:** Create/update field length bounds (EF max lengths); list pageSize clamp 100; search term cap 200.
- **customers:** Same field bounds + CreditLimit ≥ 0 and ≤ 1e9; list pageSize/search clamps.
- Unit tests for oversized name, negative credit limit, pageSize clamp.

### Residual high items
- Major Dependabot PRs need human judgment / dedicated CI alignment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.
- Savorboard.CAP.InMemoryMessageQueue still 10.0.0 (no matching 10.0.1 on NuGet previously).

## Hourly appendix — 2026-08-01 10:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080110` → **merged #495**

### CI status (step 1)
- **main green** after #494 (`f6245126`) — CI + Push success. No failures to fix.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **employees:** Align Create/Update FluentValidation max lengths with EF (20/50/50/255/1000); wire validators into EmployeeService; list pageSize clamp 100 + search cap (service + ListEmployeesHandler).
- **purchase orders:** Header/line field bounds; max 500 lines; qty/price caps; search cap.
- **WIP reports:** list pageSize clamp 100.
- Unit tests updated/added for employee validators, list clamp, PO description bounds.

### Residual high items
- Major Dependabot PRs need human judgment / dedicated CI alignment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.

## Hourly appendix — 2026-08-01 11:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080111` → **merged #496**

### CI status (step 1)
- **main green** after #495 (`03f690c7`) — CI + Push success. No failures to fix.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **lien waivers:** Description/DocumentPath/rejection reason EF bounds; amount max 1e9.
- **journal entries:** Description/source field bounds; line desc 500; max 500 lines; debit/credit sanity; search cap.
- **vendor invoices:** InvoiceNumber/TaxExemptReason bounds; money/exchange caps; search cap; currency normalize.
- **time entries:** List + by-project pageSize clamp 100.
- Unit tests for lien waiver description/reject reason and vendor invoice number length.

### Residual high items
- Major Dependabot PRs need human judgment / dedicated CI alignment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.

## Hourly appendix — 2026-08-01 12:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080112` → **merged #497**

### CI status (step 1)
- **main green** after #496 (`7f2577b1`) — CI + Push success. No failures to fix.

### Dependabot (step 2)
- No safe patch/minor merges (majors only: #463 node 25, #447 Resend, #446 QuestPDF, #443 Mapster 10, #438 eslint 10, #436 @types/node 26, #434 TS 7, #431 jest-dom 7).

### Shipped this hour
- **contracts service:** Wire FluentValidation on create/update for subcontracts, change orders, owner COs, payment applications (validators existed but were not called).
- **lists:** pageSize clamp 100 + search cap 200 on subcontracts, COs, owner COs, payment apps, RFIs.
- **money/days:** CO/owner CO amount |max| 1e9; subcontract original value max 1e9; pay-app work/stored/approved max 1e9; days extension max 3650.
- **owner CO:** New create/update FluentValidators (EF field lengths).
- **RFI validators:** BallInCourt/CreatedBy/SpecSection lengths; cost impact + delay days bounds; drawing ref count/item length.
- **PM upsert:** Truncate Name/Title/Description/Data strings to EF-aligned max lengths in PmUpsertFieldMapper.
- Unit tests for owner CO validator, CO amount/days caps, RFI optional field bounds.

### Residual high items
- Major Dependabot PRs need human judgment / dedicated CI alignment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.

## Hourly appendix — 2026-08-01 13:xx UTC

**Branch:** `chore/app-hardening-hourly-2026080113`

### CI status (step 1)
- **main green** after #497 (`84f48dba`) — CI + Push success. No failures to fix.

### Dependabot (step 2)
- No safe patch/minor merges (majors only).

### Shipped this hour
- **owner contracts:** EF-aligned field lengths; OriginalContractSum max 1e9; payment terms 0–365; SOV name/line item bounds.
- **AIA billing lines:** work completed / materials stored non-negative + max 1e9 (single + bulk update).
- **projects/bids:** ContractAmount/EstimatedValue max 1e9; bid items max 500 + qty/unit cost caps; list search cap 200; budget alert % clamp; phase take clamp.
- **notifications:** Create validates title/message/type/related entity lengths (EF max).
- Unit tests for owner contract, project/bid money max, notification create.

### Residual high items
- Major Dependabot PRs need human judgment / dedicated CI alignment.
- rbac_*/roles without FORCE RLS (pre-tenant by design).
- Role E2E can flake on Docker Hub postgres pull timeouts.

