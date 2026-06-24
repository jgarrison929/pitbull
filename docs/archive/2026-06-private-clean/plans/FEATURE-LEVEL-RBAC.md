# Feature-Level RBAC — Design Specification (HISTORICAL)

> **Status:** Implemented in 0.14.0 (see CHANGELOG)
> **Module:** `Pitbull.Core` + RBAC policies across controllers (actual: Pitbull.Core, Billing, Contracts, etc.)
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-20 (implemented ~Feb 2026)
> **Note:** This document is historical design spec. Feature-level RBAC with 45 permissions and 8 role templates was delivered. See current code in Core RBAC entities/services + [Authorize(Policy=...)] usages. Do not treat as current spec.

**Implemented as of June 2026 (verified):**
- 64 permissions defined in Pitbull.Core.Constants.PermissionConstants.All (expanded from planned 45; categories: Projects(4), TimeTracking(5), Bids(4), Contracts(4), Billing(5), AP(5), AR(4), Accounting(5), Payroll(4), PM(6), Equipment(2), Documents(3), Employees(3), Reports(3), Admin(5), SystemAdmin(3), AI(2) + Wildcard "*").
- Entities: Permission, Role (in Core.Entities or seeded via RoleService), RolePermission, UserRole? (actually uses UserCompanyAccess + tenant roles, but Permission/Role/RolePermission).
- PermissionAuthorizationHandler registered in Program.cs:402; policies for every permission.
- Role templates in PermissionConstants.RoleTemplates (Admin with *, others like Executive, Controller, ProjectManager, Foreman, etc. matching doc's 8).
- Seeding in TenantProvisioningService + RoleService using ByCategory and RoleTemplates.
- Usage: [Authorize] + policy checks on controllers (e.g. RBAC added to Jobs, PaymentApplications etc per changelog).
- Frontend: rbac-api.ts, usePermissions? (contexts), role matrix in /admin/roles.
- JWT claims include permissions (wildcard for admin).
- Verified: doc's catalog largely present (some renames like AP/AR separate); 8 roles + wildcard delivered. Numbers grew beyond 45. See PermissionConstants.cs and RoleService.cs for current. (Cross-ref CHANGELOG 0.15 RBAC policy fixes.)
Always verify actual permission list and controller attributes in live code.

---

## 1. Purpose & Scope

Expand existing RBAC foundation (Permission, Role, RolePermission, UserRole entities + RoleService + admin UI all already exist!) to cover all 57+ controllers with granular permissions.

## 2. What Already Exists

| Component | Status |
|-----------|--------|
| Permission entity (Name, Category, Description) | ✅ |
| Role entity (Name, Description, IsSystem) | ✅ |
| RolePermission + UserRole join tables (tenant-scoped) | ✅ |
| IRoleService (full CRUD, assign/remove permissions) | ✅ |
| RolesController (management API) | ✅ |
| 20 permissions in 7 categories | ✅ |
| 4 role seeds (Admin, PM, Foreman, Viewer) | ✅ |

**What's missing:** Expanded permissions (20→45), policy-based authorization on controllers, JWT permission claims, frontend enforcement.

## 3. Expanded Permission Catalog (64+ permissions as of mid-2026, see PermissionConstants.cs for exact single source of truth)

Code now defines 64 permissions (All list excludes wildcard) across categories including Projects, TimeTracking, Bids, Contracts, Billing, AP, AR, Accounting, Payroll, PM, Equipment, Documents, Employees, Reports, Admin, SystemAdmin, AI.

See src/Modules/Pitbull.Core/Constants/PermissionConstants.cs for current list (e.g. 4 Projects, 5 TimeTracking incl. ViewRates, etc.). The 45 was the target at design time (Feb 2026); it has grown with features like Documents, more Admin/SystemAdmin, AI.

Key additions: `TimeTracking.ViewRates`, `Billing.ReleaseRetention`, `AP.Approve`, `Accounting.PostJournals`, `Accounting.ManagePeriods`, `Payroll.ViewRates`, `Payroll.Process`, `Employees.ViewSensitive`, `Bids.ConvertToProject`, `Contracts.ApproveChangeOrders`.

## 4. Role Templates (8 predefined)

| Role | Focus | Key Permissions |
|------|-------|----------------|
| Admin | Everything | Wildcard `*` |
| Executive | Read-only all data | All View + Reports + Financial views |
| Controller | Financial management | AP, AR, GL, WIP, Payroll, Billing |
| ProjectManager | Project + field ops | Projects, Contracts, PM, Bids, Time Approve |
| Foreman | Field operations | Time Create, Daily Reports, Projects View |
| Estimator | Bid management | Bids CRUD, Projects View, Contracts View |
| PayrollSpecialist | HR + Payroll | Employees, Payroll, Time Rates |
| Viewer | Read-only non-sensitive | All View permissions except sensitive data |

## 5. Authorization Pipeline

```csharp
// PermissionAuthorizationHandler
// Checks JWT "permissions" claims against required permission
// Supports: exact match, wildcard (*), category wildcard (Projects.*)
```

**Controller migration:** Replace `[Authorize(Roles = "Admin")]` with `[Authorize(Policy = "Accounting.ManagePeriods")]`. Read endpoints get View policies, write endpoints get action-specific policies.

## 6. JWT Integration

Load user's effective permissions (via role → permissions) into JWT claims at login/refresh. Admin gets single `*` claim. Typical user: 15-25 permission claims (~500 bytes).

## 7. Frontend Enforcement

```typescript
const { can } = usePermissions();
// Sidebar: only show nav items user can access
// Buttons: disable actions user can't perform  
// Pages: redirect if no permission
{can('Accounting.ViewGL') && <SidebarItem ... />}
```

## 8. Backward Compatibility

- Existing Admin → Admin role (wildcard, no behavior change)
- Existing Manager → ProjectManager role
- Existing User → Viewer role
- Old `[Authorize(Roles = "Admin")]` still works (Admin has `*`)
- Gradual controller migration in 5 batches

## 9. Implementation Phases

Phase 1: Expand seeds (20→45 permissions, 4→8 roles) + PermissionAuthorizationHandler + JWT claims + admin controllers migrated
Phase 2: Migrate all controllers + frontend usePermissions hook + sidebar filtering + permission matrix UI
Phase 3: Per-project roles, data-level permissions, permission delegation

---

*Addresses Executive Review concern X1 (CISO, Head of Product).*
