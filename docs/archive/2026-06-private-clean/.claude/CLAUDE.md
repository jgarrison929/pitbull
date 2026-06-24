# CLAUDE.md — AAI-ERP (Pitbull Construction Solutions)

> **Agentic AI ERP** — One platform, one cost per user. The entire construction lifecycle from design through operations, powered by AI agents that understand the domain.

## Project Identity

**Product:** Pitbull Construction Solutions (brand) / AAI-ERP (architecture philosophy)
**Target:** Commercial General Contractors ($50M–$500M annual revenue)
**Positioning:** Self-hosted alternative to Procore + Vista + Sage. One pane of glass for the entire org.
**Philosophy:** AI-enhanced construction ERP. AI modules (document intelligence, suggestions, chat) integrate with the core system of record (modular monolith + multi-tenant RLS). AI is a powerful feature, not the sole architecture.

## Architecture

**Pattern:** Modular monolith with CQRS, multi-tenant + multi-company PostgreSQL Row-Level Security
**Stack:** .NET 9 + Next.js 16 + PostgreSQL 17 + Redis (CAP event bus) + PostHog analytics
**Deploy:** Railway (auto-deploy from main), self-hosted target

## Codebase Stats (current)

- **~95 controllers**, **14 domain modules**, **~50+ entities** (via BaseEntity + module-specific), **~221 unit test files + ~44 integration**, **100+ frontend routes/pages**
- Build must be 0 warnings; follow CI.
- ~155 EF Core migrations, 25+ design specs/plans, 8 functional role docs in docs/roles/

Note: Exact test counts and "0 issues" are snapshots; always run `dotnet build` / `dotnet test` and `npm run build && npm run lint` to validate current state.

---

## ⚠️ Settled Decisions — Do NOT Relitigate

These decisions are final. Do not propose alternatives or revisit them.

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Architecture | Modular monolith | Microservices | Right for team size + stage. Module boundaries allow future extraction. |
| Data access | Direct DbContext injection | Repository pattern | Less abstraction, CQRS handles read/write separation. |
| Event bus | DotNetCore.CAP (MIT) | MassTransit | MassTransit v9 went commercial ($$$). CAP is MIT with PostgreSQL outbox. |
| Mediator | Removed from controllers (Feb) | MediatR | Direct service injection in controllers. MediatR remnants remain only for ValidationBehavior pipeline + domain event dispatch (IDomainEvent). |
| Frontend | Next.js App Router + shadcn/ui | MUI, Ant Design | Tailwind + shadcn = consistent, lightweight, accessible. |
| Enum storage | String conversion in EF | Integer storage | Readable in DB, survives reordering. Always `HasConversion<string>()`. |
| Time entries | UTC everywhere | Local time | Global fix in SaveChangesAsync. Npgsql 9.x requires strict UTC. |
| Branch strategy | main only (no develop) | GitFlow | Single-branch simplicity. Feature branches → PR → main. |
| Decimal precision | (18, 2) for money | (10, 2) | Construction contracts can be $100M+. Need headroom. |
| Testing | In-memory DB for unit, real PostgreSQL for integration | Mocking DbContext | In-memory is faster, integration catches real query issues. |

---

## Directory Structure

```
pitbull-private/
├── src/
│   ├── Pitbull.Api/                    # ASP.NET Core host
│   │   ├── Controllers/               # ~95 REST API controllers (direct service injection)
│   │   ├── Middleware/                 # Tenant, Company, Exception, RateLimit
│   │   ├── Migrations/                # ~155 EF Core migrations
│   │   ├── Services/                  # Cross-cutting services
│   │   └── Program.cs                 # DI composition root (AddPitbullModule + AddPitbullModuleServices)
│   │
│   ├── Modules/
│   │   ├── Pitbull.Core/              # Shared kernel: DbContext, entities, multi-tenancy
│   │   ├── Pitbull.Projects/          # Project CRUD, phases, cost codes
│   │   ├── Pitbull.Bids/             # Bid management + bid-to-project conversion
│   │   ├── Pitbull.Contracts/         # Subcontracts, SOV, change orders
│   │   ├── Pitbull.Billing/           # AIA G702/G703, retention, lien waivers, AP/AR, vendors, customers, PO/invoice matching
│   │   ├── Pitbull.TimeTracking/      # Time entries, crew entry, approval workflow, payroll
│   │   ├── Pitbull.ProjectManagement/ # Schedule, RFIs, submittals, daily reports, meetings, tasks, documents
│   │   ├── Pitbull.AI/               # AI chat, smart fields, document intelligence
│   │   ├── Pitbull.Reports/          # Labor cost, profitability, equipment, CSV/PDF exports
│   │   ├── Pitbull.Notifications/     # Email (Resend), in-app notifications
│   │   ├── Pitbull.SystemAdmin/       # API keys, settings, compliance
│   │   ├── Pitbull.Documents/         # File storage abstraction
│   │   ├── Pitbull.RFIs/             # RFI-specific domain (legacy, merging into PM)
│   │   └── Pitbull.Portal/           # External user portal (stub)
│   │
│   └── Pitbull.Web/pitbull-web/       # Next.js 16 frontend
│       └── src/
│           ├── app/(auth)/            # Login, signup, verify, reset
│           ├── app/(dashboard)/       # 100+ protected pages
│           ├── components/            # UI components (ui/, layout/, dashboard/, skeletons/)
│           ├── contexts/              # Auth, Company, Theme, KeyboardShortcuts
│           └── lib/                   # api.ts, auth.ts, nav-utils.ts, types
│
├── tests/
│   ├── Pitbull.Tests.Unit/            # ~221 test files (XUnit + in-memory for fast unit)
│   └── Pitbull.Tests.Integration/     # ~44 test files (real PostgreSQL via Testcontainers)
│
├── docs/
│   ├── plans/                         # 25 design specs
│   ├── roles/                         # 8 functional role docs (CFO, PM, HR, etc.)
│   ├── solutions/                     # Compound learning: past bugs, patterns, lessons
│   ├── ARCHITECTURE.md
│   ├── EXECUTIVE-REVIEW-FEB19.md      # 8-persona product review with prioritized roadmap
│   └── EXECUTIVE-ROADMAP-COMPREHENSIVE.md
│
├── .claude/
│   ├── settings.local.json            # Agent teams enabled, permissions
│   └── skills/                        # Domain expertise for agent teams
│       ├── erp-accounting/            # GAAP, GL, journal entries, WIP, cost allocation
│       ├── erp-architecture/          # Module boundaries, CQRS (direct services), event bus, patterns
│       ├── erp-contracts/             # Change orders, retention, lien waivers, AIA billing
│       ├── erp-hr-payroll/            # Certified payroll, prevailing wage, Davis-Bacon, time tracking
│       ├── erp-project-management/    # Schedule, RFIs, submittals, daily reports, punch lists
│       └── nextjs-shadcn/             # Component patterns, theming, responsive (no erp-postgres skill exists)
│
└── CLAUDE.md                          # This file
```

---

## Module Boundaries — ENFORCED

Modules communicate through **well-defined interfaces only**. Do NOT create cross-module references.

| Module | Owns | Can Reference |
|--------|------|---------------|
| Pitbull.Core | DbContext, BaseEntity, multi-tenancy, shared entities | Nothing (root) |
| Pitbull.Projects | Project, CostCode, Phase | Core |
| Pitbull.Bids | Bid, BidItem | Core, Projects |
| Pitbull.Contracts | Subcontract, SOV, ChangeOrder | Core, Projects |
| Pitbull.Billing | PaymentApp, Vendor, Customer, GL, WIP, Retention, LienWaiver, PO | Core, Projects, Contracts |
| Pitbull.TimeTracking | TimeEntry, PayPeriod, PayrollRun, CrewAssignment | Core, Projects |
| Pitbull.ProjectManagement | Schedule, RFI, Submittal, DailyReport, Meeting, Task | Core, Projects |
| Pitbull.AI | AiService, providers | Core (query-only access to other modules via DbContext) |
| Pitbull.Reports | Report generation | Core (read-only access) |

**Cross-module communication:** Use CAP events (PostgreSQL outbox + Redis Streams) for async. For sync, a module may query entities from another module's tables through the shared DbContext — but never import another module's services.

---

## Backend Patterns

### Controllers
```csharp
[ApiController]
[Route("api/resource-name")]   // kebab-case
[Authorize]                    // Most require auth; exceptions: AuthController, VersionController, some demo/portal
[EnableRateLimiting("api")]    // Rate limiting on all endpoints
[Produces("application/json")]
[Tags("Module Name")]          // Swagger grouping
public class ResourceController(IResourceService service) : ControllerBase
```
Primary constructor + direct service injection. Use `Result<T>` from Pitbull.Core.CQRS for service outcomes.

### Services (Direct Injection — No MediatR)
```csharp
public interface IResourceService
{
    Task<ResourceDto?> GetAsync(Guid id, CancellationToken ct);
    Task<ResourceDto> CreateAsync(CreateResourceDto dto, CancellationToken ct);
}

public class ResourceService(PitbullDbContext db, ITenantContext tenant, ICompanyContext company) : IResourceService
{
    // Always filter by tenant + company
    // Always use .AsNoTracking() for reads
    // Always pass CancellationToken
}
```

### Entity Configuration
```csharp
// Table names: snake_case
builder.ToTable("resource_items");

// Enums: ALWAYS string conversion
builder.Property(x => x.Status).HasConversion<string>();

// Money: ALWAYS (18, 2)
builder.Property(x => x.Amount).HasPrecision(18, 2);

// Unique indexes: ALWAYS include TenantId
builder.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();

// Soft delete + tenant/company: Global filters in PitbullDbContext (not always per-entity)
builder.HasQueryFilter(x => !x.IsDeleted && x.TenantId == tenantId);
```
Access via `db.Set<YourEntity>()` or centralized DbSet<T> in Core for many billing/project entities. EF configs discovered via RegisterModuleAssembly.

### Multi-Tenancy (Two Layers)
1. **Application:** TenantMiddleware + CompanyMiddleware resolve from JWT claims
2. **Database:** PostgreSQL RLS policies: `set_config('app.current_tenant', ...)` and `set_config('app.current_company', ...)`

### DateTime: UTC Everywhere
```csharp
// Global fix in SaveChangesAsync — converts all DateTimeKind.Unspecified to UTC
// Npgsql 9.x strict UTC requirement
// NEVER store or compare local times
```

### Error Responses
```csharp
return BadRequest(new { error = "Human-readable message" });  // Client
logger.LogError(ex, "Detailed server error");                  // Server (Serilog JSON)
// NEVER expose stack traces or internal details to clients
```

---

## Frontend Patterns

### API Calls — Always use typed wrapper
```typescript
const data = await api<ProjectDto>("/api/projects/" + id);
const result = await api<ProjectDto>("/api/projects", { method: "POST", body: dto });
// api() handles auth token, error responses, base URL
```

### Auth
```typescript
const { user, isAuthenticated, login, logout } = useAuth();
// JWT with refresh token. Token stored in memory, refresh in httpOnly cookie.
```

### Component Patterns
- shadcn/ui base components in `components/ui/`
- Feature components in `components/{feature}/`
- Loading skeletons via `loading.tsx` per route
- Empty states with call-to-action for list pages
- Inline validation on forms
- Breadcrumbs on every page (22+ pages)
- Toast notifications for success/error
- Dark mode support via `theme-context`

### Styling
- Tailwind CSS 4, mobile-first (`sm:`, `md:`, `lg:`)
- Min viewport: 375px (iPhone SE)
- Touch targets: 44px minimum
- **NO markdown tables** in Discord/WhatsApp outputs

---

## Construction Domain — Critical Context

This is not generic SaaS. These domain concepts MUST be understood:

### Financial
- **Retainage/Retention:** Withholding (typically 5-10%) from each payment until project completion. Not optional — required by law in most states.
- **AIA G702/G703:** Standard billing documents. G702 = Application for Payment, G703 = Continuation Sheet with line items. Every GC uses these.
- **Schedule of Values (SOV):** Line-item breakdown of contract value. Each billing cycle, contractor reports % complete per line.
- **WIP (Work in Progress):** Cost-to-cost calculation: (costs-to-date / estimated-total-cost) × contract-value. Determines overbilling/underbilling. Required for ASC 606 compliance.
- **Lien Waiver:** Legal document waiving the right to file a mechanic's lien. Required before releasing retention or final payment.
- **Journal Entry:** Double-entry accounting. Debits must equal credits. Period must be open.

### Project Management
- **RFI (Request for Information):** Formal question to architect/engineer. Tracked with response time, cost/schedule impact. PMs spend 30% of their day on these.
- **Submittal:** Product data, shop drawings, samples sent to architect for approval. Ball-in-court tracking (who has it right now?).
- **Change Order:** Modification to the contract scope/price. Must track cost impact and approval status.
- **Punch List:** Close-out deficiency list. PM walks building with architect, documents items by location, assigns to responsible sub.
- **Daily Report:** Field documentation: weather, manpower, activities, safety. Referenced in claims/disputes.

### Labor & Payroll
- **Prevailing Wage:** Government-mandated minimum pay rates for public works projects. Varies by trade and jurisdiction.
- **Davis-Bacon Act:** Federal prevailing wage law. Certified payroll reports (WH-347) required weekly.
- **Cost Code:** Numeric code categorizing work (CSI MasterFormat). Used for job costing and budget tracking.
- **Phase Code:** Project phase (mobilization, foundation, structure, finishes, closeout). Combined with cost code for granular tracking.
- **Crew Entry:** Foreman enters time for entire crew at once. Must be fast (< 30 seconds per entry).

### Key Workflows
1. **Bid → Project → Subcontracts → SOV → Monthly Billing (G702/G703) → Retention → Final Payment + Lien Waivers**
2. **Time Entry → Supervisor Approval → Payroll Processing → Certified Payroll Reports**
3. **RFI → Response → Schedule/Cost Impact → Change Order → Contract Amendment**

---

## Agent Team Configuration

### Team Composition for Feature Work

When building features, create teams with these roles:

```
Make a team that has:

1. **Backend Architect** — .NET 9, C#, EF Core, PostgreSQL expert. Owns entities, services, 
   controllers, migrations. Knows CQRS patterns, multi-tenancy, RLS.
   Load skill: erp-architecture

2. **Frontend Specialist** — React 19, Next.js 16, TypeScript, Tailwind, shadcn/ui expert. 
   Owns pages, components, API integration. Knows the design system.
   Load skill: nextjs-shadcn

3. **Domain Expert** — Understands construction business workflows. Validates that entities, 
   field names, and status flows match how GCs actually work.
   Load skill: [relevant domain skill for the module]

4. **Reviewer** — Reviews all output for patterns compliance, test coverage, security, 
   and construction domain accuracy. References docs/solutions/ for past lessons.

Message each other for handoffs and coordination:
- Frontend needs to know what endpoints Backend is creating
- Backend needs to know what data Frontend needs
- Domain Expert validates business logic BEFORE implementation starts
- Reviewer checks against docs/solutions/ for known issues
```

### Domain Skills (load based on module being built)

| Module | Primary Skill | Secondary |
|--------|--------------|-----------|
| Billing, GL, WIP, AP/AR, Payroll, Vendors | erp-accounting | erp-contracts |
| Contracts, Retention, Lien Waivers, SOV, Change Orders | erp-contracts | erp-accounting |
| Time Tracking, Employees, Certified Payroll | erp-hr-payroll | erp-architecture |
| Schedule, RFIs, Submittals, Daily Reports, Punch List, PM | erp-project-management | erp-architecture |
| Any new module/entity, architecture decisions | erp-architecture | (none; check AGENTS.md) |
| UI / pages / components | nextjs-shadcn | erp-architecture |

### Coordination Rules for Agent Teams

1. **Domain Expert speaks first.** Before any code is written, the domain expert defines the business rules, entity relationships, and workflow states.
2. **Backend and Frontend communicate.** When Backend creates an endpoint, they message Frontend with the DTO shape. When Frontend needs data, they message Backend with requirements.
3. **Reviewer checks docs/solutions/.** Before approving, review past lessons for related patterns.
4. **Single branch per team.** Create `feature/<name>` from main. All team members work on same branch.
5. **Build verification is the last task.** `dotnet build` (0 warnings) + `npx next build` must both pass.

---

## Compound Learning — docs/solutions/

After each feature ships, capture lessons in `docs/solutions/`:

```markdown
# docs/solutions/YYYY-MM-DD-feature-name.md

## Problem
What we were building and what went wrong / what we learned.

## Solution
What fixed it / what pattern emerged.

## Pattern
Reusable pattern for future work.

## Files Affected
List of files for future reference.
```

**Current known patterns:**
- Migration duplication: When agents scaffold multiple migrations in same session, EF captures full model delta each time → duplicate AddColumn calls. **Always diff new migrations against recent ones.**
- Service constructor changes: Adding new validation that touches service constructors breaks all test files that create that service. **Always check ALL test files.**
- MassTransit → CAP: MassTransit v9 went commercial. **Always check licenses on major upgrades.**
- DateTime UTC: Global SaveChangesAsync fix converts Unspecified → UTC. Don't add manual conversion.
- Turbopack + worktrees: node_modules symlinks in worktrees break Turbopack. Avoid worktrees.

---

## Commands

### Backend (from repo root)
```bash
dotnet build Pitbull.sln --configuration Release     # 0 warnings required
dotnet test tests/Pitbull.Tests.Unit --configuration Release
dotnet test tests/Pitbull.Tests.Integration --configuration Release  # needs Docker/Testcontainers
cd src/Pitbull.Api && dotnet ef migrations add YourName -p ../Modules/Pitbull.Core -s .
```

### Frontend
```bash
cd src/Pitbull.Web/pitbull-web
npm ci
npm run build   # must succeed
npm run lint    # 0 warnings
npm run dev
```

### Git / PR
```bash
git checkout -b feature/<name>
# ... work ...
# Before commit/PR:
dotnet build Pitbull.sln --configuration Release
cd src/Pitbull.Web/pitbull-web && npm run build && npm run lint
git add -A && git commit -m "feat: ..."
```
See root AGENTS.md for full "Validate Everything Before Committing".

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ConnectionStrings__PitbullDb` | PostgreSQL connection |
| `Jwt__Key` | JWT signing key (min 32 chars) |
| `RESEND_API_KEY` | Resend email service |
| `Email__BaseUrl` | Frontend URL for email links |
| `NEXT_PUBLIC_API_BASE_URL` | API URL for frontend |
| `POSTHOG_API_KEY` | PostHog analytics |

---

## Key Reference Docs

| Doc | Purpose | Notes |
|-----|---------|-------|
| `docs/ARCHITECTURE.md` | System architecture overview | Primary |
| `docs/roles/*.md` | 8 functional role perspectives | Useful domain |
| `docs/solutions/*.md` | Compound learning / past lessons | High value |
| `docs/plans/*.md`, `docs/specs/*.md` | Design specs | Many aspirational/outdated — always verify against src/ code |
| `docs/EXECUTIVE-*.md` | Old reviews/roadmaps | Historical; do not treat as current spec |
