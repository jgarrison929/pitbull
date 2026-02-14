# Multi-Company Architecture Design

**Author:** Architecture Agent  
**Date:** February 13, 2026  
**Status:** PROPOSED — awaiting review before implementation  
**Audience:** Backend Agent, Frontend Agent, Josh (owner)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Industry Research & Precedent](#2-industry-research--precedent)
3. [Current State Analysis](#3-current-state-analysis)
4. [Core Concepts & Terminology](#4-core-concepts--terminology)
5. [Data Model Design](#5-data-model-design)
6. [Entity Classification: Shared vs Company-Scoped](#6-entity-classification-shared-vs-company-scoped)
7. [Database & RLS Changes](#7-database--rls-changes)
8. [Backend Architecture Changes](#8-backend-architecture-changes)
9. [Authentication & Session Management](#9-authentication--session-management)
10. [Frontend Architecture Changes](#10-frontend-architecture-changes)
11. [Inter-Company Transactions](#11-inter-company-transactions)
12. [Onboarding Flow](#12-onboarding-flow)
13. [Migration Strategy](#13-migration-strategy)
14. [API Changes](#14-api-changes)
15. [Security Considerations](#15-security-considerations)
16. [Future Considerations](#16-future-considerations)
17. [Implementation Plan](#17-implementation-plan)
18. [Decision Log](#18-decision-log)
19. [Appendix: Entity Inventory](#19-appendix-entity-inventory)

---

## 1. Executive Summary

Pitbull currently operates with a **Tenant = Company** model. Each tenant (e.g., "Garrison Construction Enterprises") is a single company. But real construction businesses operate multiple legal entities — a GC, a concrete sub, an equipment company, a holding company — all managed by the same people from the same office.

This design introduces a **Company** entity within each Tenant, transforming the hierarchy to:

```
Tenant (organization/parent)
 └── Company 1 (legal entity, EIN, books)
 └── Company 2
 └── Company 3
 └── ...up to N companies
```

**The key insight from industry ERPs:** Transactional data (projects, bids, time entries, contracts) belongs to a Company. Master data (employees, cost codes, vendors) can be shared across companies within a Tenant. Users belong to the Tenant and are granted access to specific companies.

This is exactly how Vista/Viewpoint, Sage 300 CRE, and NetSuite OneWorld work.

---

## 2. Industry Research & Precedent

### Vista by Viewpoint (Trimble)
- **Company as a first-class dimension** on every transaction (called "HQCo" / "JCCo" etc.)
- Every job (project) belongs to one company
- Employees can work across companies (shared master)
- Users are granted access to specific company numbers
- Company switcher in the UI — user selects which company they're working in
- Inter-company entries handled via due-to/due-from GL accounts

### Sage 300 CRE
- **Data folders per company** within one installation, or multiple companies in one GL data file
- Inter-company accounting creates automatic entries between companies in the same GL
- Shared vendor/subcontractor master across companies
- Roll-up financials for consolidated reporting
- Due-to/due-from accounts for inter-company balances

### NetSuite OneWorld
- **Subsidiaries** as the company equivalent — a subsidiary tree under one account
- Entities (customers, vendors, employees) can be shared across subsidiaries or subsidiary-specific
- Each transaction posts to one subsidiary
- Inter-company transactions generate automatic elimination entries
- Users restricted by subsidiary access (role-based)
- Subsidiaries share inventory items but have unique items too
- Single chart of accounts with subsidiary-specific accounts

### Common Patterns Across All Three

| Concept | Industry Standard |
|---------|------------------|
| Company/Subsidiary entity | First-class entity in the data model |
| Transactional data | Always scoped to one company |
| Master data (employees, vendors) | Shared at tenant level, accessible across companies |
| Cost codes | Shared library with optional company overrides |
| Chart of accounts | Per-company (each is a separate legal entity for tax) |
| User access | Tenant-level users with per-company permissions |
| Company switching | In-session context switch (no re-login) |
| Inter-company | Due-to/due-from accounts, automatic offsetting entries |

---

## 3. Current State Analysis

### Existing Hierarchy
```
Tenant (via tenant_id JWT claim + RLS)
 └── All data (projects, bids, employees, etc.)
```

### Key Infrastructure
- **BaseEntity**: All entities inherit this; has `TenantId`, audit fields, soft delete
- **PitbullDbContext**: Global query filter on `TenantId` + `IsDeleted` for every `BaseEntity`
- **TenantMiddleware**: Resolves `tenant_id` from JWT claims and sets PostgreSQL session var
- **TenantConnectionInterceptor**: Sets `app.current_tenant` session var on connection open
- **RLS policies**: PostgreSQL row-level security on all tables using `app.current_tenant`
- **CompanySettings**: Exists as a domain entity but is NOT in the database yet (commented out in DbContext)

### Tables with RLS Policies
Batch 1: `projects`, `bids`, `project_phases`, `project_budgets`, `project_projections`, `bid_items`  
Batch 2: `employees`, `time_entries`, `project_assignments`, `rfis`, `CostCodes`  
Batch 3: `subcontracts`, `change_orders`, `payment_applications`  
Plus: `pay_periods`

### Current Entity Count (inheriting BaseEntity)
17 entities across 6 modules — see [Appendix](#19-appendix-entity-inventory) for full list.

---

## 4. Core Concepts & Terminology

| Term | Definition |
|------|-----------|
| **Tenant** | The parent organization/account. "Garrison Construction Enterprises." Billing, users, and licensing live here. |
| **Company** | A legal entity within the tenant. Has its own EIN, bank accounts, GL. "Garrison General Contractors LLC", "Garrison Concrete Inc." |
| **Active Company** | The company the user is currently working in (session context). |
| **Company-Scoped Entity** | Data that belongs to exactly one company (projects, bids, contracts, time entries). |
| **Tenant-Scoped Entity** | Data shared across all companies within a tenant (employees, users, cost code library). |
| **Inter-Company Transaction** | A transaction that crosses company boundaries (e.g., employee from Company A works on Company B's project). |

---

## 5. Data Model Design

### 5.1 The Company Entity

```csharp
namespace Pitbull.Core.Domain;

/// <summary>
/// A legal entity/company within a tenant.
/// Each company has its own financials, projects, and reporting.
/// </summary>
public class Company : BaseEntity
{
    /// <summary>
    /// Short numeric or alpha code for the company (e.g., "01", "GGC", "CONC")
    /// Used in project numbering, reports, and company switcher.
    /// </summary>
    public string Code { get; set; } = string.Empty;
    
    /// <summary>
    /// Full legal name (e.g., "Garrison General Contractors LLC")
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Short display name for UI (e.g., "Garrison GC")
    /// </summary>
    public string? ShortName { get; set; }
    
    /// <summary>
    /// Federal Tax ID / EIN
    /// </summary>
    public string? TaxId { get; set; }
    
    // Address
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
    
    // Contact
    public string? Phone { get; set; }
    public string? Website { get; set; }
    public string? Email { get; set; }
    
    // Branding
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }
    
    // Financial settings
    public string Currency { get; set; } = "USD";
    public string Timezone { get; set; } = "America/Los_Angeles";
    public string DateFormat { get; set; } = "MM/dd/yyyy";
    public int FiscalYearStartMonth { get; set; } = 1;
    
    /// <summary>
    /// Whether this company is active and accessible
    /// </summary>
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// Sort order in company switcher
    /// </summary>
    public int SortOrder { get; set; }
    
    /// <summary>
    /// Whether this is the default company for new users in this tenant
    /// </summary>
    public bool IsDefault { get; set; }
    
    /// <summary>
    /// JSONB column for company-specific settings
    /// </summary>
    public string Settings { get; set; } = "{}";
}
```

**Key design decisions:**
- Company inherits `BaseEntity`, so it has `TenantId` — it's tenant-scoped
- `Code` is a short identifier (like Vista's HQCo number) — unique within a tenant
- Absorbs everything from the current `CompanySettings` entity (which was never persisted)
- `IsDefault` flag marks which company loads on first login

### 5.2 User-Company Access

```csharp
namespace Pitbull.Core.Domain;

/// <summary>
/// Maps which companies a user can access within their tenant.
/// If a user has no entries, they can access NO companies (locked out of data).
/// </summary>
public class UserCompanyAccess : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid CompanyId { get; set; }
    
    /// <summary>
    /// Role within this specific company (optional override).
    /// Null = inherit tenant-level role.
    /// </summary>
    public string? CompanyRole { get; set; }
    
    /// <summary>
    /// Whether this is the user's default company (loaded on login)
    /// </summary>
    public bool IsDefault { get; set; }
    
    // Navigation
    public AppUser User { get; set; } = null!;
    public Company Company { get; set; } = null!;
}
```

### 5.3 Updated BaseEntity (NO CHANGE)

**Critical decision: `BaseEntity` does NOT change.** We do NOT add `CompanyId` to `BaseEntity`.

Rationale:
- Not all entities are company-scoped (employees, cost codes are tenant-scoped)
- Adding a nullable `CompanyId` to `BaseEntity` pollutes tenant-scoped entities
- A required `CompanyId` on `BaseEntity` would break shared entities

Instead, we introduce a marker interface:

### 5.4 Company-Scoped Interface

```csharp
namespace Pitbull.Core.Domain;

/// <summary>
/// Marker interface for entities that belong to a specific company.
/// Entities implementing this have a CompanyId column and participate
/// in company-level RLS filtering.
/// </summary>
public interface ICompanyScoped
{
    Guid CompanyId { get; set; }
}
```

Each company-scoped entity adds this interface and the `CompanyId` property. Example:

```csharp
public class Project : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    // ... rest unchanged
}
```

### 5.5 Company Context (Parallel to Tenant Context)

```csharp
namespace Pitbull.Core.MultiTenancy;

/// <summary>
/// Provides the current company context for the request.
/// Set by middleware from session/header/JWT.
/// </summary>
public interface ICompanyContext
{
    Guid CompanyId { get; }
    string CompanyCode { get; }
    bool IsResolved { get; }
}

public class CompanyContext : ICompanyContext
{
    public Guid CompanyId { get; set; }
    public string CompanyCode { get; set; } = string.Empty;
    public bool IsResolved => CompanyId != Guid.Empty;
}
```

---

## 6. Entity Classification: Shared vs Company-Scoped

This is the most critical architectural decision. Each entity falls into one of three categories:

### Category A: Company-Scoped (add `CompanyId`, implement `ICompanyScoped`)

These entities have transactions/data that belongs to exactly one company:

| Entity | Module | Rationale |
|--------|--------|-----------|
| **Project** | Projects | A project is a contract with a specific legal entity |
| **Phase** | Projects | Child of project → inherits company from project |
| **ProjectBudget** | Projects | Child of project |
| **Projection** | Projects | Child of project |
| **Bid** | Bids | A bid is issued by a specific company |
| **BidItem** | Bids | Child of bid |
| **Subcontract** | Contracts | Contract between a specific company and a sub |
| **ChangeOrder** | Contracts | Child of subcontract |
| **PaymentApplication** | Contracts | Child of subcontract |
| **Rfi** | RFIs | Belongs to a project → belongs to that company |
| **TimeEntry** | TimeTracking | Work on a project → company of that project |
| **PayPeriod** | TimeTracking | Pay periods are per-company (different companies may have different pay schedules) |

### Category B: Tenant-Scoped / Shared (NO `CompanyId`)

These entities are shared across all companies within a tenant:

| Entity | Module | Rationale |
|--------|--------|-----------|
| **Employee** | TimeTracking | Employees work across companies (carpenter works on GC project Monday, concrete project Tuesday) |
| **CostCode** | Core | Standard cost code library shared across companies (CSI codes don't change by company) |
| **AuditLog** | Core | Audit trail spans all companies |
| **Company** | Core | The company entity itself is tenant-scoped |
| **UserCompanyAccess** | Core | Access mapping is tenant-scoped |

### Category C: Special Cases

| Entity | Module | Decision | Rationale |
|--------|--------|----------|-----------|
| **ProjectAssignment** | TimeTracking | **Company-Scoped** (inherits from Project) | Assignment is to a company's project |
| **AppUser** | Core | Tenant-scoped (no change) | Users belong to the tenant, access companies via UserCompanyAccess |
| **CompanySettings** | Core | **DEPRECATED** — replaced by Company entity | Company entity absorbs all settings |

### Why Employees Are Shared (Not Company-Scoped)

This is the biggest departure from naive "just add CompanyId everywhere." In construction:

- A concrete finisher works on Garrison GC's hospital project Mon-Wed, then Garrison Concrete's warehouse project Thu-Fri
- The employee has ONE employee record, ONE employee number, ONE hourly rate
- Their **time entries** are company-scoped (through the project), but the **employee master** is shared
- This matches Vista, Sage, and NetSuite — all share employee master data at the parent level
- Payroll may be issued by one specific company (the "home company"), but that's a property on the Employee, not a scope restriction

**We add a `HomeCompanyId` (nullable) to Employee** to indicate which company "owns" them for payroll purposes, but do NOT add `ICompanyScoped`:

```csharp
public class Employee : BaseEntity
{
    // NEW: Which company issues this employee's paycheck
    public Guid? HomeCompanyId { get; set; }
    
    // ... rest unchanged
}
```

---

## 7. Database & RLS Changes

### 7.1 New Tables

```sql
-- Companies table
CREATE TABLE companies (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "TenantId" uuid NOT NULL REFERENCES tenants("Id"),
    "Code" varchar(20) NOT NULL,
    "Name" varchar(200) NOT NULL,
    "ShortName" varchar(50),
    "TaxId" varchar(50),
    "Address" varchar(500),
    "City" varchar(100),
    "State" varchar(50),
    "ZipCode" varchar(20),
    "Phone" varchar(50),
    "Website" varchar(200),
    "Email" varchar(200),
    "LogoUrl" varchar(500),
    "PrimaryColor" varchar(20),
    "Currency" varchar(10) NOT NULL DEFAULT 'USD',
    "Timezone" varchar(50) NOT NULL DEFAULT 'America/Los_Angeles',
    "DateFormat" varchar(20) NOT NULL DEFAULT 'MM/dd/yyyy',
    "FiscalYearStartMonth" int NOT NULL DEFAULT 1,
    "IsActive" boolean NOT NULL DEFAULT true,
    "SortOrder" int NOT NULL DEFAULT 0,
    "IsDefault" boolean NOT NULL DEFAULT false,
    "Settings" jsonb NOT NULL DEFAULT '{}',
    -- BaseEntity audit fields
    "CreatedAt" timestamp NOT NULL,
    "CreatedBy" varchar(200),
    "UpdatedAt" timestamp,
    "UpdatedBy" varchar(200),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "DeletedAt" timestamp,
    "DeletedBy" varchar(200),
    UNIQUE ("TenantId", "Code")
);

-- User-Company access mapping
CREATE TABLE user_company_access (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "TenantId" uuid NOT NULL,
    "UserId" uuid NOT NULL REFERENCES users("Id"),
    "CompanyId" uuid NOT NULL REFERENCES companies("Id"),
    "CompanyRole" varchar(50),
    "IsDefault" boolean NOT NULL DEFAULT false,
    -- BaseEntity fields
    "CreatedAt" timestamp NOT NULL,
    "CreatedBy" varchar(200),
    "UpdatedAt" timestamp,
    "UpdatedBy" varchar(200),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "DeletedAt" timestamp,
    "DeletedBy" varchar(200),
    UNIQUE ("TenantId", "UserId", "CompanyId")
);
```

### 7.2 Schema Changes to Existing Tables

Add `CompanyId` column to all Category A entities:

```sql
-- Add CompanyId to all company-scoped tables
ALTER TABLE projects ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE bids ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE subcontracts ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE rfis ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE time_entries ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE pay_periods ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE project_phases ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE project_budgets ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE project_projections ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE bid_items ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE change_orders ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE payment_applications ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
ALTER TABLE project_assignments ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");

-- Add HomeCompanyId to employees (shared, but with a home company for payroll)
ALTER TABLE employees ADD COLUMN "HomeCompanyId" uuid REFERENCES companies("Id");

-- Indexes on CompanyId
CREATE INDEX IX_projects_company ON projects("CompanyId");
CREATE INDEX IX_bids_company ON bids("CompanyId");
CREATE INDEX IX_subcontracts_company ON subcontracts("CompanyId");
CREATE INDEX IX_time_entries_company ON time_entries("CompanyId");
-- (etc. for all company-scoped tables)
```

### 7.3 RLS Policy Evolution

**Phase 1: Tenant-only RLS (current)**
```sql
-- Current: Filter by TenantId only
USING ("TenantId"::text = current_setting('app.current_tenant', true))
```

**Phase 2: Tenant + Company RLS (new)**

For **company-scoped tables**, we add a compound policy:

```sql
-- New session variable for active company
-- Set alongside app.current_tenant in middleware

-- New policy for company-scoped tables
CREATE POLICY projects_company_isolation ON projects
FOR ALL
USING (
    "TenantId"::text = current_setting('app.current_tenant', true)
    AND (
        -- If no company filter set, allow all companies in tenant (cross-company queries)
        current_setting('app.current_company', true) IS NULL
        OR current_setting('app.current_company', true) = ''
        OR "CompanyId"::text = current_setting('app.current_company', true)
    )
);
```

**Important: The tenant filter ALWAYS applies. The company filter is additive.**

For **tenant-scoped tables** (employees, cost codes), the existing RLS policies remain unchanged — they only filter by `TenantId`.

### 7.4 PostgreSQL Session Variable Updates

The middleware will set TWO session variables:

```sql
SELECT set_config('app.current_tenant', '{tenantId}', false);
SELECT set_config('app.current_company', '{companyId}', false);
```

When `companyId` is empty/null (cross-company context), `app.current_company` is set to empty string, and the RLS policy allows all companies within the tenant.

---

## 8. Backend Architecture Changes

### 8.1 Updated TenantContext → TenantCompanyContext

Extend (not replace) the existing tenant context:

```csharp
public interface ITenantContext
{
    Guid TenantId { get; }
    string TenantName { get; }
    bool IsResolved { get; }
}

// NEW interface
public interface ICompanyContext
{
    Guid CompanyId { get; }
    string CompanyCode { get; }
    string CompanyName { get; }
    bool IsResolved { get; }
    
    /// <summary>
    /// All companies the current user has access to (cached per request).
    /// Used for cross-company queries and validation.
    /// </summary>
    IReadOnlyList<Guid> AccessibleCompanyIds { get; }
}
```

### 8.2 Updated Middleware

```csharp
public class CompanyMiddleware
{
    // Runs AFTER TenantMiddleware
    // 1. Reads active company from: X-Company-Id header, or company_id JWT claim, 
    //    or user's default company
    // 2. Validates user has access to that company (via UserCompanyAccess)
    // 3. Sets CompanyContext
    // 4. Sets PostgreSQL session variable: app.current_company
}
```

### 8.3 Updated DbContext SaveChanges

```csharp
// In SaveChangesAsync, for added entities:
case EntityState.Added:
    entry.Entity.TenantId = tenantContext.TenantId;
    
    // Auto-set CompanyId for company-scoped entities
    if (entry.Entity is ICompanyScoped companyScoped 
        && companyScoped.CompanyId == Guid.Empty
        && companyContext.IsResolved)
    {
        companyScoped.CompanyId = companyContext.CompanyId;
    }
    break;
```

### 8.4 Updated Global Query Filters

```csharp
// For ICompanyScoped entities, add compound filter:
if (typeof(ICompanyScoped).IsAssignableFrom(entityType.ClrType))
{
    // TenantId + IsDeleted + CompanyId filter
    builder.Entity(entityType.ClrType)
        .HasQueryFilter(CreateTenantCompanyAndSoftDeleteFilter(entityType.ClrType));
}
else if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
{
    // TenantId + IsDeleted filter (existing)
    builder.Entity(entityType.ClrType)
        .HasQueryFilter(CreateTenantAndSoftDeleteFilter(entityType.ClrType));
}
```

The company filter in EF only applies when `CompanyContext.IsResolved` is true, allowing cross-company queries when needed (dashboards, reports, consolidated views).

### 8.5 Service Layer Changes

**Commands (writes):** Always require a resolved company context. The active company is set on creation.

```csharp
// CreateProjectCommand handler:
var project = new Project
{
    Name = request.Name,
    Number = request.Number,
    CompanyId = companyContext.CompanyId,  // NEW: from session
    // ... rest unchanged
};
```

**Queries (reads):** Typically scoped to active company. Cross-company queries require explicit opt-in:

```csharp
// ListProjectsQuery - scoped to active company (default via global filter)
var projects = await db.Projects.Where(p => p.Status == status).ToListAsync();

// Cross-company dashboard - explicitly ignore company filter
var allProjects = await db.Projects
    .IgnoreQueryFilters()
    .Where(p => p.TenantId == tenantContext.TenantId && !p.IsDeleted)
    .Where(p => accessibleCompanyIds.Contains(p.CompanyId))
    .ToListAsync();
```

---

## 9. Authentication & Session Management

### 9.1 Login Flow

```
1. User logs in (email + password) → JWT issued
2. JWT contains: sub, email, tenant_id, full_name, user_type, roles
3. NEW: JWT also contains: default_company_id, company_ids[] (list of accessible company IDs)
4. Frontend reads default_company_id → sets as active company
5. Active company is sent via X-Company-Id header on every API request
```

### 9.2 Company Switching (No Re-Login)

```
1. User clicks company switcher in UI
2. Frontend calls: POST /api/companies/switch/{companyId}
3. Backend validates user has access to that company
4. Backend issues a NEW JWT with updated default_company_id
5. Frontend stores new token, updates header, refreshes current view
6. All subsequent API calls include new X-Company-Id header
```

**Why a new JWT instead of just a header?** The JWT claim serves as the server-side record of the user's current context, used for audit logs and as a fallback when the header is missing.

### 9.3 JWT Claims (Updated)

```csharp
var claims = new List<Claim>
{
    new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
    new(JwtRegisteredClaimNames.Email, user.Email!),
    new("tenant_id", user.TenantId.ToString()),
    new("full_name", user.FullName),
    new("user_type", user.Type.ToString()),
    // NEW:
    new("company_id", activeCompanyId.ToString()),         // Active company
    new("company_ids", string.Join(",", companyIds)),       // All accessible companies
};
```

### 9.4 Company Resolution Priority

```
1. X-Company-Id request header (explicit per-request override)
2. company_id JWT claim (session default)
3. User's default company (from UserCompanyAccess.IsDefault)
4. Tenant's default company (from Company.IsDefault)
5. First company in tenant (fallback)
```

---

## 10. Frontend Architecture Changes

### 10.1 Company Switcher Component

Located in the top nav bar / sidebar header:

```
┌──────────────────────────────────────────────┐
│ 🏗️ Garrison Construction Enterprises         │ ← Tenant name
│ ┌──────────────────────────────────────────┐ │
│ │ Garrison General Contractors  ▼          │ │ ← Company switcher dropdown
│ └──────────────────────────────────────────┘ │
│                                              │
│ 📊 Dashboard                                 │
│ 📋 Projects                                  │
│ 💰 Bids                                      │
│ ...                                          │
└──────────────────────────────────────────────┘
```

### 10.2 State Management

```typescript
// Company context in global state (React context or Zustand)
interface CompanyState {
  activeCompanyId: string;
  activeCompanyCode: string;
  activeCompanyName: string;
  accessibleCompanies: Company[];
  switchCompany: (companyId: string) => Promise<void>;
}
```

### 10.3 API Client Updates

```typescript
// Axios/fetch interceptor adds X-Company-Id to every request
api.interceptors.request.use((config) => {
  const companyId = getActiveCompanyId();
  if (companyId) {
    config.headers['X-Company-Id'] = companyId;
  }
  return config;
});
```

### 10.4 URL Strategy

**Option A (recommended): Company in context, not in URL**

```
/projects
/projects/123
/bids
```

Company is contextual (like Vista). When you switch companies, the project list refreshes. This is simpler and matches how construction users think — they're "in" a company.

**Option B: Company in URL** (not recommended for now)

```
/company/garrison-gc/projects
/company/garrison-concrete/projects
```

This adds complexity and makes deep linking harder. Can be added later if needed for multi-tab cross-company work.

---

## 11. Inter-Company Transactions

### 11.1 Employee Cross-Company Time

The most common inter-company scenario in construction:

```
Employee: Mike (home company: Garrison GC)
Monday-Wednesday: Works on Garrison GC's hospital project
Thursday-Friday: Works on Garrison Concrete's warehouse project

TimeEntry(Mon): CompanyId = Garrison GC, ProjectId = Hospital
TimeEntry(Thu): CompanyId = Garrison Concrete, ProjectId = Warehouse
```

**This works naturally** because:
- Employee is tenant-scoped (shared)
- TimeEntry is company-scoped (through the project's company)
- When Mike enters time for the warehouse project, the CompanyId is automatically set to Garrison Concrete's company ID (inherited from the project)

### 11.2 Inter-Company Billing (Future)

When Company A's employee works on Company B's project:

```
InterCompanyTransaction:
  SourceCompanyId: Garrison Concrete (where employee is "home")
  TargetCompanyId: Garrison GC (where work was performed)
  Amount: 40 hours × $45/hr = $1,800
  Type: LaborTransfer
```

**This is a FUTURE feature** — not in the initial implementation. For now, the time entry simply lives under the project's company. The inter-company billing reconciliation is a Phase 2 concern (and requires GL/accounting module).

### 11.3 Inter-Company Subcontracts (Future)

When Garrison Concrete is a sub on Garrison GC's project:

```
Subcontract:
  CompanyId: Garrison GC (the GC on the project)
  SubcontractorName: "Garrison Concrete Inc."
  IsInterCompany: true
  InterCompanyId: {guid of Garrison Concrete}
```

**Also future** — but the data model supports it with a simple flag and reference.

---

## 12. Onboarding Flow

### 12.1 New Tenant Registration (Current Flow + Enhancement)

```
1. User registers: POST /api/auth/register
   - email, password, firstName, lastName, companyName
   
2. Backend creates:
   a. Tenant: "Garrison Construction Enterprises" (slug: garrison-construction-enterprises)
   b. Company: Code="01", Name="Garrison Construction Enterprises" (default company, same as tenant name)
   c. AppUser: josh@garrison.com, TenantId = tenant.Id
   d. UserCompanyAccess: UserId = user.Id, CompanyId = company.Id, IsDefault = true
   e. Roles: Admin
   
3. User lands in the app with Company 01 active
```

**The key change: registration now also creates a default Company.** Single-company tenants just have one company — they may never notice the multi-company feature exists.

### 12.2 Adding Subsidiaries (Admin Flow)

```
1. Admin navigates to: Settings → Companies → Add Company

2. POST /api/admin/companies
   {
     "code": "02",
     "name": "Garrison Concrete Inc.",
     "shortName": "Garrison Concrete",
     "taxId": "87-1234568",
     "address": "456 Concrete Dr",
     ...
   }

3. Backend creates Company entity (TenantId auto-set)

4. Admin grants user access:
   POST /api/admin/companies/{companyId}/users
   {
     "userId": "{userId}",
     "isDefault": false
   }

5. User can now see Company 02 in their company switcher
```

### 12.3 Garrison Construction Enterprises — Full Setup Example

```
Tenant: "Garrison Construction Enterprises"

Companies:
  01 - Garrison General Contractors LLC (default)
  02 - Garrison Concrete Inc.
  03 - Garrison Electrical Services LLC
  04 - Garrison Plumbing & Mechanical Inc.
  05 - Garrison Equipment Rentals LLC
  06 - Garrison Development Corp.
  07 - Garrison Steel Fabricators Inc.
  08 - Garrison Environmental Services LLC

Users:
  Josh Garrison (Admin) → Access to: ALL companies, default = 01
  Sarah PM (Manager) → Access to: 01, 02, 03
  Mike Superintendent (User) → Access to: 01, 02
  Field Worker (User) → Access to: 01

Employees (shared across all companies):
  EMP-001 Mike Carpenter (HomeCompany: 01)
  EMP-002 Dave Finisher (HomeCompany: 02)
  EMP-003 Lisa Electrician (HomeCompany: 03)
  
Projects:
  PRJ-01-2026-001 "City Hospital" (Company 01 - Garrison GC)
  PRJ-02-2026-001 "Warehouse Foundation" (Company 02 - Garrison Concrete)
  PRJ-01-2026-002 "Office Tower" (Company 01 - Garrison GC)
```

---

## 13. Migration Strategy

### 13.1 Backward Compatibility

**Every existing tenant gets a default company auto-created.** Zero data loss, zero user disruption.

### 13.2 Migration Steps

```
EF Migration: AddMultiCompanySupport

Step 1: Create companies table
Step 2: Create user_company_access table

Step 3: For each existing tenant, create a default company:
  INSERT INTO companies ("Id", "TenantId", "Code", "Name", "IsDefault", "IsActive", ...)
  SELECT gen_random_uuid(), t."Id", '01', t."Name", true, true, ...
  FROM tenants t;

Step 4: Add CompanyId column (nullable initially) to all company-scoped tables:
  ALTER TABLE projects ADD COLUMN "CompanyId" uuid REFERENCES companies("Id");
  -- ... for each table

Step 5: Backfill CompanyId from the default company:
  UPDATE projects p 
  SET "CompanyId" = c."Id" 
  FROM companies c 
  WHERE c."TenantId" = p."TenantId" AND c."IsDefault" = true;
  -- ... for each table

Step 6: Make CompanyId NOT NULL:
  ALTER TABLE projects ALTER COLUMN "CompanyId" SET NOT NULL;
  -- ... for each table

Step 7: Add HomeCompanyId to employees:
  ALTER TABLE employees ADD COLUMN "HomeCompanyId" uuid REFERENCES companies("Id");
  UPDATE employees e 
  SET "HomeCompanyId" = c."Id" 
  FROM companies c 
  WHERE c."TenantId" = e."TenantId" AND c."IsDefault" = true;

Step 8: Create UserCompanyAccess for all existing users:
  INSERT INTO user_company_access ("Id", "TenantId", "UserId", "CompanyId", "IsDefault", ...)
  SELECT gen_random_uuid(), u."TenantId", u."Id", c."Id", true, ...
  FROM users u
  JOIN companies c ON c."TenantId" = u."TenantId" AND c."IsDefault" = true;

Step 9: Add RLS policies for new tables + update existing policies
Step 10: Add indexes on CompanyId columns
```

### 13.3 Migration Safety

- Steps 4-6 are split so existing data is preserved (nullable → backfill → NOT NULL)
- All done in a single EF migration but using raw SQL for data backfill
- Rollback: drop the CompanyId columns and new tables

---

## 14. API Changes

### 14.1 New Endpoints

```
# Company Management (Admin)
GET    /api/admin/companies              - List companies in tenant
POST   /api/admin/companies              - Create new company
GET    /api/admin/companies/{id}         - Get company details
PUT    /api/admin/companies/{id}         - Update company
DELETE /api/admin/companies/{id}         - Deactivate company

# Company User Access (Admin)
GET    /api/admin/companies/{id}/users   - List users with access
POST   /api/admin/companies/{id}/users   - Grant user access
DELETE /api/admin/companies/{id}/users/{userId} - Revoke access

# Company Switching (User)
POST   /api/companies/switch/{companyId} - Switch active company (returns new JWT)
GET    /api/companies/accessible         - List companies user can access
GET    /api/companies/active             - Get active company details
```

### 14.2 Modified Endpoints

All existing endpoints continue to work unchanged. They're automatically scoped to the active company via the middleware + global query filter.

```
GET /api/projects          ← Now returns projects for active company only
POST /api/projects         ← CompanyId auto-set from active company context
GET /api/bids              ← Scoped to active company
```

### 14.3 Request Headers

```
Authorization: Bearer {jwt}
X-Company-Id: {guid}        ← NEW: Active company ID (optional, defaults to JWT claim)
```

### 14.4 Response Changes

The `/api/auth/me` response gains company information:

```json
{
  "id": "...",
  "email": "josh@garrison.com",
  "fullName": "Josh Garrison",
  "roles": ["Admin"],
  "tenantId": "...",
  "tenantName": "Garrison Construction Enterprises",
  "activeCompany": {
    "id": "...",
    "code": "01",
    "name": "Garrison General Contractors LLC"
  },
  "accessibleCompanies": [
    { "id": "...", "code": "01", "name": "Garrison General Contractors LLC" },
    { "id": "...", "code": "02", "name": "Garrison Concrete Inc." }
  ]
}
```

---

## 15. Security Considerations

### 15.1 Defense in Depth (Unchanged Principle)

The existing three-layer security model extends naturally:

| Layer | Tenant Isolation | Company Isolation |
|-------|-----------------|-------------------|
| **1. JWT Claims** | `tenant_id` claim | `company_id` claim + `company_ids` |
| **2. EF Query Filters** | `TenantId == context.TenantId` | `CompanyId == context.CompanyId` (for ICompanyScoped) |
| **3. PostgreSQL RLS** | `app.current_tenant` | `app.current_company` |

### 15.2 Threat Model

| Threat | Mitigation |
|--------|-----------|
| User accesses company they shouldn't | `UserCompanyAccess` check in CompanyMiddleware; RLS as backup |
| Tampered X-Company-Id header | Middleware validates against user's accessible companies |
| Cross-company data leak in queries | EF global filter + RLS double-filter |
| Company switching without permission | `/api/companies/switch` validates access before issuing new JWT |
| Stale JWT after access revoked | Short JWT expiry (60 min) + check UserCompanyAccess on each request |

### 15.3 Audit Trail

All company switches are logged:

```csharp
AuditLog.Create(
    tenantId, userId, email, name,
    AuditAction.CompanySwitch,
    "Company", companyId,
    $"Switched to company: {companyCode} - {companyName}");
```

---

## 16. Future Considerations

### 16.1 Cross-Company Reporting
- Consolidated dashboards showing all companies
- Roll-up financials (tenant-wide P&L)
- Cross-company employee utilization reports
- Requires `IgnoreQueryFilters()` with explicit company access checking

### 16.2 GL / Chart of Accounts (Per-Company)
- Each company will have its own chart of accounts
- Inter-company transactions create due-to/due-from entries
- Financial statements are per-company with consolidated option
- This is a prerequisite for the Accounting module

### 16.3 Inter-Company Billing
- Automated labor transfer billing
- Inter-company subcontract tracking
- Equipment rental between companies
- Requires the Billing and Accounting modules

### 16.4 Company-Scoped Cost Code Overrides
- Shared cost code library at tenant level
- Companies can override descriptions, add custom codes
- Uses a `CompanyCostCodeOverride` table (future)

### 16.5 Multi-Company Payroll
- Employee has HomeCompanyId for payroll
- Time worked on other companies creates inter-company labor charges
- Pay periods may differ by company
- Payroll export grouped by company

---

## 17. Implementation Plan

### Phase 1: Foundation (Backend Agent)
1. Create `Company` entity and `UserCompanyAccess` entity
2. Create `ICompanyScoped` interface
3. Add `CompanyId` to all Category A entities
4. Add `HomeCompanyId` to Employee
5. Write EF migration (create tables + backfill)
6. Create `ICompanyContext` / `CompanyContext`
7. Create `CompanyMiddleware`
8. Update `PitbullDbContext` (query filters for `ICompanyScoped`)
9. Update `TenantConnectionInterceptor` (set `app.current_company`)
10. Update `SaveChangesAsync` (auto-set `CompanyId`)
11. Update RLS policies (compound tenant + company filter)

### Phase 2: API Layer (Backend Agent)
1. Create `AdminCompaniesController` (replace `AdminCompanyController`)
2. Create company switching endpoint
3. Update `AuthController` (add company claims to JWT)
4. Update `/api/auth/me` response
5. Update registration flow (auto-create default company)
6. Update seed data service
7. Add company access validation to all command handlers

### Phase 3: Frontend (Frontend Agent)
1. Create company switcher component
2. Add `X-Company-Id` header to API client
3. Create company management admin page
4. Update user management to include company access
5. Update sidebar/nav to show active company
6. Handle company switch (token refresh + data reload)

### Phase 4: Cleanup
1. Deprecate and remove old `CompanySettings` entity
2. Update all existing tests
3. Integration tests for multi-company scenarios
4. Update API documentation

---

## 18. Decision Log

| # | Decision | Rationale | Alternatives Considered |
|---|----------|-----------|------------------------|
| D1 | `CompanyId` on specific entities, NOT on `BaseEntity` | Not all entities are company-scoped. A nullable CompanyId on BaseEntity is a code smell and makes queries ambiguous. | Add nullable CompanyId to BaseEntity |
| D2 | `ICompanyScoped` marker interface | Clean separation between company-scoped and tenant-scoped entities. EF can detect and apply appropriate filters. | Attribute-based, or convention-based |
| D3 | Employees are tenant-scoped (shared) | Matches industry ERPs. Employees work across companies. HomeCompanyId handles payroll association. | Company-scope employees (rejected: would require duplicate employee records) |
| D4 | Cost Codes are tenant-scoped (shared) | CSI codes don't change by company. Shared library reduces maintenance. Company overrides can be added later. | Company-scope cost codes (rejected: massive duplication) |
| D5 | Company switching via new JWT | Ensures server-side audit trail and session consistency. Token refresh is a clean mechanism. | Header-only (no JWT update) — harder to audit |
| D6 | `X-Company-Id` header for active company | Explicit, debuggable, works with any HTTP client. JWT claim as fallback. | Query parameter, cookie, URL path segment |
| D7 | RLS compound filter (tenant AND optional company) | Defense in depth at database level. Empty company = all companies in tenant. | Application-level only (rejected: RLS is a security boundary) |
| D8 | Auto-create default company on registration | Zero-friction for single-company tenants. They never need to know about multi-company. | Require company setup as separate step (rejected: bad UX) |
| D9 | Company in context, NOT in URL | Matches Vista/NetSuite UX. Simpler routing. Company is a session-level concern. | URL-based routing (rejected: complexity, deep-linking issues) |
| D10 | Child entities (Phase, BidItem, ChangeOrder) get their own CompanyId | Denormalization for query performance and RLS enforcement. Avoids joins to parent tables for every filter. | Inherit CompanyId via join (rejected: RLS can't do joins) |

---

## 19. Appendix: Entity Inventory

### Complete Entity List with Classification

| # | Entity | Module | Table | Inherits BaseEntity | Classification | Gets CompanyId |
|---|--------|--------|-------|--------------------|----|----------------|
| 1 | Company | Core | companies | Yes | Tenant-scoped | N/A (IS the company) |
| 2 | UserCompanyAccess | Core | user_company_access | Yes | Tenant-scoped | Has CompanyId as FK (not ICompanyScoped) |
| 3 | CostCode | Core | CostCodes | Yes | Tenant-scoped | No |
| 4 | AuditLog | Core | audit_logs | No (own schema) | Tenant-scoped | No (but may log CompanyId in details) |
| 5 | CompanySettings | Core | _(deprecated)_ | Yes | **REMOVED** → merged into Company | N/A |
| 6 | Project | Projects | projects | Yes | **Company-scoped** | ✅ |
| 7 | Phase | Projects | project_phases | Yes | **Company-scoped** | ✅ |
| 8 | ProjectBudget | Projects | project_budgets | Yes | **Company-scoped** | ✅ |
| 9 | Projection | Projects | project_projections | Yes | **Company-scoped** | ✅ |
| 10 | Bid | Bids | bids | Yes | **Company-scoped** | ✅ |
| 11 | BidItem | Bids | bid_items | Yes | **Company-scoped** | ✅ |
| 12 | Subcontract | Contracts | subcontracts | Yes | **Company-scoped** | ✅ |
| 13 | ChangeOrder | Contracts | change_orders | Yes | **Company-scoped** | ✅ |
| 14 | PaymentApplication | Contracts | payment_applications | Yes | **Company-scoped** | ✅ |
| 15 | Rfi | RFIs | rfis | Yes | **Company-scoped** | ✅ |
| 16 | Employee | TimeTracking | employees | Yes | Tenant-scoped (shared) | No (gets HomeCompanyId) |
| 17 | TimeEntry | TimeTracking | time_entries | Yes | **Company-scoped** | ✅ |
| 18 | ProjectAssignment | TimeTracking | project_assignments | Yes | **Company-scoped** | ✅ |
| 19 | PayPeriod | TimeTracking | pay_periods | Yes | **Company-scoped** | ✅ |
| 20 | AppUser | Core (Identity) | users | No (IdentityUser) | Tenant-scoped | No |
| 21 | AppRole | Core (Identity) | roles | No (IdentityRole) | Tenant-scoped | No |

**Summary:** 13 entities get `CompanyId` (implement `ICompanyScoped`). 8 remain tenant-scoped only.

---

## Addendum: FAQ for Implementing Agents

**Q: Do I need to update every existing command handler?**
A: No. The `SaveChangesAsync` override auto-sets `CompanyId` on `ICompanyScoped` entities from the `CompanyContext`. Handlers that create entities don't need explicit CompanyId assignment (though they can override it). Handlers that query will automatically be filtered by the global query filter.

**Q: What about child entities like Phase, BidItem, ChangeOrder?**
A: They each get their own `CompanyId` (denormalized from parent). This is necessary because PostgreSQL RLS policies can't join to parent tables. Set in `SaveChangesAsync` or explicitly in the handler.

**Q: How do I do a cross-company query (e.g., tenant-wide dashboard)?**
A: Use `db.Projects.IgnoreQueryFilters()` and manually filter by `TenantId` and `accessibleCompanyIds`. This is an explicit opt-in for security reasons.

**Q: What happens to existing data?**
A: The migration creates a default company per tenant and backfills all existing records. Zero data loss. Existing single-company tenants will work exactly as before.

**Q: What if a tenant only has one company?**
A: It works transparently. The company switcher only shows if there are 2+ companies. The default company is auto-selected. Single-company tenants never need to interact with multi-company features.

**Q: How do project numbers work across companies?**
A: Project numbers include the company code prefix: `PRJ-01-2026-001` (Company 01, year 2026, sequence 001). This ensures uniqueness across companies and makes it obvious which company a project belongs to. The unique constraint changes from `(TenantId, Number)` to `(TenantId, CompanyId, Number)` or we can enforce the prefix convention.
