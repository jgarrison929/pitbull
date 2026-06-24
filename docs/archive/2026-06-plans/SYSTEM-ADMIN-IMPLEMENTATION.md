# System Admin Module Implementation Spec

## Document Metadata
- Source plan: `docs/plans/SYSTEM-ADMIN-MODULE.md`
- Spec date: 2026-02-17
- Stack: .NET 9, ASP.NET Core, Next.js 16 App Router, PostgreSQL 17
- Architecture: Modular monolith, CQRS handlers + direct service injection, multi-tenant + multi-company isolation (RLS + query filters)

## 1. Scope and Goals
The System Admin module must provide tenant administrators a complete, secure management surface for:
- Users and role assignments
- Tenant-level organization settings and lifecycle state
- Company management and company-access mapping
- Immutable audit-log visibility

It must close the current planning gaps:
- Users created without usable roles
- Admin workflows split across partially overlapping APIs
- Missing role/data-integrity guarantees at migration and startup
- Unclear SuperAdmin versus tenant-admin boundaries

## 2. Architecture Rules to Enforce
- Every query must respect `TenantId` and `!IsDeleted`.
- Company-scoped resources must enforce `CompanyId` context where applicable.
- Controllers stay thin; business rules live in service/CQRS handlers.
- Continue using existing auth patterns (`[Authorize]`, role policies, claims-based context from `ITenantContext` + `ICompanyContext`).
- Keep DTO contracts stable for frontend where already in use, and version/break explicitly when changed.

## 3. Domain Model: Entities Required

### 3.1 Existing entities (already in codebase)
1. `AppUser` (`src/Modules/Pitbull.Core/Domain/AppUser.cs`)
- Key fields: `Id`, `TenantId`, `Email`, `FirstName`, `LastName`, `Status`, `Type`, `LastLoginAt`
- Purpose: user identity + tenant ownership

2. `AppRole` (`src/Modules/Pitbull.Core/Domain/AppUser.cs`)
- Key fields: `Id`, `TenantId`, `Name`, `Description`, `IsSystemRole`
- Purpose: tenant-scoped role catalog (with prefixed Identity role name)

3. `Tenant` (`src/Modules/Pitbull.Core/Domain/Tenant.cs`)
- Key fields: `Id`, `Name`, `Slug`, `Status`, `Plan`, `Settings`
- Purpose: top-level isolation boundary

4. `Company` (`src/Modules/Pitbull.Core/Domain/Company.cs`)
- Key fields: `Id`, `TenantId`, profile/settings fields, `IsActive`, `IsDefault`, JSON `Settings`
- Purpose: operational org/unit under tenant

5. `UserCompanyAccess` (`src/Modules/Pitbull.Core/Domain/UserCompanyAccess.cs`)
- Key fields: `TenantId`, `UserId`, `CompanyId`, `CompanyRole`, `IsDefault`, `IsDeleted`
- Purpose: maps users to accessible companies

6. `AuditLog` (`src/Modules/Pitbull.Core/Domain/AuditLog.cs`)
- Key fields: actor identity, action, resource, description, timestamp, success/failure metadata
- Purpose: immutable compliance and diagnostics log

7. Identity join entities (existing via EF Identity)
- `IdentityUserRole<Guid>`, claims/logins/tokens tables
- Purpose: role assignments and auth internals

### 3.2 New entities needed
No mandatory brand-new table is required to deliver MVP System Admin because core entities already exist.

Optional phase-2 additions (defer unless required by product decision):
- `RoleTemplate` per tenant (if custom role sets are approved)
- `TenantAdminPolicy` (if configurable default role / role hierarchy is required beyond constants)

## 4. Service Layer: Methods Required

### 4.1 Existing services to reuse
1. `RoleSeeder` (`src/Pitbull.Api/Infrastructure/RoleSeeder.cs`)
- `EnsureRolesForTenantAsync(Guid tenantId, CancellationToken ct)`
- `AssignRoleToUserAsync(AppUser user, string roleName, CancellationToken ct)`
- `GetUserRolesAsync(AppUser user)`
- `UserHasRoleAsync(AppUser user, string roleName)`
- `EnsureTenantHasAdminAsync(Guid tenantId, CancellationToken ct)`

2. Multi-tenant context services
- `ITenantContext` / `TenantContext`
- `ICompanyContext` / `CompanyContext`

### 4.2 New/standardized admin service contracts to build
Create `Pitbull.SystemAdmin/Services` with:

1. `IAdminUserService`
- `Task<PagedResult<AdminUserDto>> ListUsersAsync(AdminUserListQuery, CancellationToken)`
- `Task<AdminUserDto?> GetUserAsync(Guid userId, CancellationToken)`
- `Task<AdminUserDto> CreateUserAsync(CreateAdminUserCommand, CancellationToken)`
- `Task<AdminUserDto> UpdateUserAsync(Guid userId, UpdateAdminUserCommand, CancellationToken)`
- `Task DisableUserAsync(Guid userId, DisableUserCommand, CancellationToken)`
- `Task<IReadOnlyList<RoleInfoDto>> ListAssignableRolesAsync(CancellationToken)`
- `Task AssignRolesAsync(Guid userId, IReadOnlyList<string> roles, CancellationToken)`

2. `IAdminTenantService`
- `Task<TenantDto> GetCurrentTenantAsync(CancellationToken)`
- `Task<TenantDto> UpdateTenantAsync(UpdateTenantCommand, CancellationToken)`
- `Task<IReadOnlyList<TenantDto>> ListTenantsAsync(TenantListQuery, CancellationToken)` (SuperAdmin-only)
- `Task SetTenantStatusAsync(Guid tenantId, SetTenantStatusCommand, CancellationToken)` (SuperAdmin-only)

3. `IAdminCompanyService`
- `Task<IReadOnlyList<CompanyDto>> ListCompaniesAsync(CancellationToken)`
- `Task<CompanyDto?> GetCompanyAsync(Guid companyId, CancellationToken)`
- `Task<CompanyDto> CreateCompanyAsync(CreateCompanyCommand, CancellationToken)`
- `Task<CompanyDto> UpdateCompanyAsync(Guid companyId, UpdateCompanyCommand, CancellationToken)`
- `Task DeactivateCompanyAsync(Guid companyId, CancellationToken)`
- `Task<IReadOnlyList<CompanyUserAccessDto>> ListCompanyUsersAsync(Guid companyId, CancellationToken)`
- `Task GrantCompanyAccessAsync(Guid companyId, GrantCompanyAccessCommand, CancellationToken)`
- `Task RevokeCompanyAccessAsync(Guid companyId, Guid userId, CancellationToken)`

4. `IAdminAuditService`
- `Task<PagedResult<AuditLogDto>> ListAuditLogsAsync(AuditLogFilter, CancellationToken)`
- `Task<IReadOnlyList<string>> ListAuditResourceTypesAsync(CancellationToken)`
- `IReadOnlyList<string> ListAuditActions()`

5. `IRoleIntegrityService`
- `Task EnsureAllUsersHaveAtLeastOneRoleAsync(Guid tenantId, CancellationToken)`
- `Task<RoleIntegrityReport> ValidateTenantRoleIntegrityAsync(Guid tenantId, CancellationToken)`

## 5. Controller/API Endpoints Required

### 5.1 Existing endpoints already present
1. Users/Admin users
- `GET /api/admin/users`
- `GET /api/admin/users/{id}`
- `PUT /api/admin/users/{id}`
- `GET /api/admin/users/roles`
- `POST /api/admin/users/bootstrap-admin`
- `GET /api/users`
- `GET /api/users/{id}`
- `POST /api/users/{id}/roles`
- `DELETE /api/users/{id}/roles/{role}`
- `GET /api/users/roles`

2. Companies
- `GET /api/companies/active`
- `GET /api/companies/accessible`
- `POST /api/companies/switch/{companyId}`
- `GET /api/admin/companies`
- `GET /api/admin/companies/{id}`
- `POST /api/admin/companies`
- `PUT /api/admin/companies/{id}`
- `DELETE /api/admin/companies/{id}`
- `GET /api/admin/companies/{companyId}/users`
- `POST /api/admin/companies/{companyId}/users`
- `DELETE /api/admin/companies/{companyId}/users/{userId}`

3. Tenant
- `POST /api/tenants`
- `GET /api/tenants/{id}`
- `GET /api/tenants`

4. Audit
- `GET /api/admin/audit-logs`
- `GET /api/admin/audit-logs/resource-types`
- `GET /api/admin/audit-logs/actions`

5. Company settings (legacy/incomplete persistence)
- `GET /api/admin/company`
- `PUT /api/admin/company`

### 5.2 Endpoints still required for full plan coverage
1. User lifecycle
- `POST /api/admin/users` (create user with default role assignment)
- `PATCH /api/admin/users/{id}/status` (activate/disable/lock)

2. Tenant management hardening
- `PUT /api/admin/tenant` (tenant admins update own tenant profile)
- `GET /api/system-admin/tenants` (SuperAdmin listing)
- `PATCH /api/system-admin/tenants/{id}/status` (SuperAdmin lifecycle changes)

3. Role integrity/diagnostics
- `POST /api/system-admin/roles/backfill-missing` (SuperAdmin or startup task endpoint)
- `GET /api/system-admin/roles/integrity-report` (admin diagnostics)

4. Company settings persistence alignment
- Keep route `GET/PUT /api/admin/company`, but back it with persisted data in `Company` (or dedicated tenant settings aggregate) instead of in-memory dictionary.

## 6. Frontend Pages Required

### 6.1 Existing pages already present
Under `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/`:
- `users/page.tsx`
- `companies/page.tsx`
- `company/page.tsx`
- `audit-logs/page.tsx`
- `pay-periods/page.tsx` (adjacent admin utility page)
- corresponding loading pages exist

### 6.2 Pages/features still needed
1. `admin/users`
- Add create-user flow with role picker
- Add disable/activate actions
- Display explicit role hierarchy guidance and guardrails

2. `admin/tenant` (new page)
- Tenant profile edit (name, slug constraints, plan/status read-only for tenant admins)

3. `system-admin/tenants` (new page, SuperAdmin only)
- List/search tenants
- Set tenant status (Active/Suspended/Deactivated)

4. `admin/roles` (new page or section)
- Show role hierarchy
- Optional: default-role config per tenant if approved
- Trigger integrity check/backfill action (admin-visible status)

5. `admin/company`
- Remove localStorage-only and in-memory fallback assumptions; use persisted server model only

## 7. Relationships to Existing Modules

1. Users
- System Admin depends on ASP.NET Identity (`AppUser`, `AppRole`, user-role joins).
- Role assignment must always pass through tenant-prefixed role names and `RoleSeeder` logic.

2. Tenants
- Tenant is the isolation root; all admin operations must target current `ITenantContext.TenantId` unless endpoint is explicitly SuperAdmin scope.

3. Companies
- Company records are tenant-owned.
- User-to-company relationships via `UserCompanyAccess` must be maintained when users are created/updated/disabled.

4. Audit
- All admin writes must create audit events with actor, action, resource, success/failure.

## 8. Existing vs Build Matrix

### 8.1 Already exists and usable
- Core entities/tables for tenant, user, role, company, user-company access, audit.
- RLS/session-context middleware pattern (`TenantMiddleware`, `CompanyMiddleware`, `PitbullDbContext` filters).
- Baseline admin pages and endpoints for users/companies/audit.
- Role seeding helper with tenant-scoped role conventions.

### 8.2 Exists but needs refactor/hardening
1. Duplicate/overlapping user-admin APIs
- `UsersController` and `AdminUsersController` overlap and return different contract shapes.
- Action: standardize on one admin user contract and align frontend types.

2. Company settings API persistence gap
- `AdminCompanyController` stores settings in static in-memory dictionary.
- Action: persist to DB-backed model and remove volatile storage.

3. Role naming consistency
- Some paths query roles without consistent tenant-prefix handling.
- Action: centralize role lookup/assignment via shared service.

4. Integrity checks not fully formalized
- No enforced migration/startup guarantee that every active user has >=1 role.
- Action: add migration/backfill + startup validator.

### 8.3 Net-new implementation required
- Create-user endpoint with enforced default role assignment.
- Tenant admin profile edit endpoint/page.
- SuperAdmin tenant management surface.
- Role integrity diagnostic/reporting endpoint + optional UI.
- Formal authorization policies for `SuperAdmin` scope.

## 9. Security and Authorization Model

1. Role hierarchy to implement
- `SuperAdmin` (cross-tenant)
- `Admin` (tenant scope)
- `Manager`
- `Supervisor`
- `User`

2. Policy model
- `RequireTenantAdmin`: Admin in current tenant
- `RequireSuperAdmin`: global ops only
- `RequireTenantAccess`: tenant claim must match target tenant

3. Guardrails
- Prevent self-demotion from last required admin role in tenant.
- Prevent disabling/removing last active admin in tenant.
- Enforce tenant/company scope checks on all IDs in route and payload.
- Use JWT-derived actor identity; never trust actor IDs from request body.

## 10. Data Integrity and Migrations

Implement migration package with:
1. Backfill roles for role-less users
- Assign default role (`User`) for any user with zero tenant roles.

2. Startup validation
- Verify each active tenant has required system roles.
- Verify each active tenant has at least one active admin (or emit blocking health signal).

3. Constraints/indexes
- Keep unique indexes already defined (`TenantId+Code`, `TenantId+UserId+CompanyId`).
- Add/verify indexes supporting admin list filters (users by status/email/name, audit timestamp/action/resource).

4. Safe rollout
- Run backfill migration before enabling stricter runtime checks.

## 11. CQRS/Module Structure Proposal

Create module `src/Modules/Pitbull.SystemAdmin/`:
- `Domain/` (only if new aggregates emerge)
- `Features/Users/*` (List, Get, Create, Update, Disable, AssignRoles)
- `Features/Tenants/*` (GetCurrent, UpdateCurrent, ListAll, SetStatus)
- `Features/Companies/*` (delegate/reuse existing company admin handlers where possible)
- `Features/Audit/*` (list/filter metadata)
- `Services/*` (interfaces + orchestration)
- `Data/*` (config if new entities are introduced)

Controller placement options:
- Keep controllers under `src/Pitbull.Api/Controllers/` and switch internals to CQRS handlers/services.
- Do not move routes initially; preserve existing public contracts where possible.

## 12. API Contract Alignment Tasks

1. Align admin user response envelope
- Frontend expects paged structure for admin users (`items`, `totalCount`, `page`, `pageSize`).
- Ensure backend contract matches consistently.

2. Align admin company settings DTO
- Frontend uses `CompanySettings` with fields (`name`, `legalName`, `defaultRetainagePercent`, `timeZone`, etc.).
- Backend currently serves different shape (`CompanyName`, `Timezone`, etc.).
- Define canonical DTO and update both sides together.

3. Audit filter params consistency
- Frontend currently sends `startDate`/`endDate`; backend expects `from`/`to`.
- Standardize naming on one contract and document it.

## 13. Frontend Implementation Notes

1. Use existing `api<T>()` helper for all requests.
2. Keep loading/error/empty states consistent with current dashboard patterns.
3. Add explicit role descriptions and impact text in role-edit UIs.
4. Display tenant/company scope context in admin pages to reduce operator mistakes.

## 14. Testing Requirements

Backend unit/integration:
- User create/update/disable role edge cases
- Last-admin protection
- Tenant-scope and company-scope access checks
- Role backfill logic and startup integrity validator
- Audit logging for admin writes

Frontend tests:
- Admin page loading/error/empty states
- Form validation for user and tenant edits
- Permission-based rendering (Admin vs SuperAdmin)

## 15. Delivery Phases

Phase 1 (core stabilization)
- Unify admin user API contract
- Persist company settings
- Add default-role assignment + role backfill migration
- Add role integrity startup validation

Phase 2 (capability completion)
- Add tenant profile admin page/API
- Add SuperAdmin tenant management API/UI
- Add role integrity diagnostics endpoint/UI

Phase 3 (optional)
- Tenant-configurable default role and customizable role model (if product approves)

## 16. Open Decisions
1. Approve `SuperAdmin` as explicit cross-tenant role (recommended: yes, policy-gated, no tenant context writes without explicit target).
2. Default role for user creation (recommended: `User`, tenant-configurable later).
3. Role model flexibility (recommended: fixed hierarchy now, extensibility later).
4. Demo/bootstrap flow ownership (recommended: keep bootstrap endpoint but restrict with explicit environment/one-time guard).
