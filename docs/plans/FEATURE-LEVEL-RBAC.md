# Feature-Level RBAC — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.Core` (extends existing) + all controllers
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-20
> **Sponsor:** CISO (Rachel Kim), Head of Product (Lisa Tran)
> **Executive Review Reference:** "Admin/Manager/User is too coarse. Feature-level permissions needed for SOC 2."

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

## 3. Expanded Permission Catalog (45 permissions, 12 categories)

Projects (4), Time Tracking (5), Bids (4), Contracts (4), Financial/Billing (5), Financial/AP-AR (5), Accounting (4), Payroll (4), Project Management (6), Employees (3), Equipment (2), Reports (3), Admin (5), AI (2) = 45 total.

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
