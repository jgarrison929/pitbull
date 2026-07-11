# Architecture Overview

Pitbull is a **modular monolith** built on .NET 10 and Next.js 16. It uses CQRS for command/query separation, PostgreSQL Row-Level Security for multi-tenancy, and a vertical-slice module structure.

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| API Host | ASP.NET Core 10 | REST API, middleware pipeline, DI composition |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | App Router SPA with shadcn/ui components |
| Database | PostgreSQL 17 | Multi-tenant with Row-Level Security |
| Cache | Redis 7 | Session and data caching |
| Auth | ASP.NET Identity + JWT | Token-based auth with role claims |
| Messaging | DotNetCore.CAP | Event bus (PostgreSQL outbox + Redis) |
| Email | Resend | Transactional email (optional; configure `Email:FromAddress` in settings) |
| AI | Anthropic Claude + OpenAI | Project health analysis, context-aware chat |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│              (App Router, React 19, shadcn/ui)           │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (JWT auth)
┌──────────────────────▼──────────────────────────────────┐
│                  ASP.NET Core Host                        │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ Middleware│ │  Controllers │ │  ExceptionMiddleware │  │
│  │ (Tenant, │ │  (REST API)  │ │  (global error       │  │
│  │  Auth)   │ │              │ │   handling)          │  │
│  └──────────┘ └──────┬───────┘ └─────────────────────┘  │
│                      │                                    │
│  ┌───────────────────▼────────────────────────────────┐  │
│  │              Module Layer (CQRS)                    │  │
│  │  Commands → Handlers → Result<T>                   │  │
│  │  Queries  → Handlers → Result<T>                   │  │
│  │  Validators (FluentValidation pipeline behavior)   │  │
│  └───────────────────┬────────────────────────────────┘  │
│                      │                                    │
│  ┌───────────────────▼────────────────────────────────┐  │
│  │           PitbullDbContext (EF Core 10)             │  │
│  │  • Audit fields (CreatedAt/By, UpdatedAt/By)       │  │
│  │  • Tenant filtering via RLS + app.current_tenant   │  │
│  │  • Compound isolation: TenantId + CompanyId        │  │
│  └───────────────────┬────────────────────────────────┘  │
└──────────────────────┼──────────────────────────────────┘
                       │
         ┌─────────────▼───────────────┐
         │    PostgreSQL 17 (RLS)      │
         │    Redis 7 (cache)          │
         └─────────────────────────────┘
```

## Module Structure

Each module is a separate .NET project under `src/Modules/`. 

**Current implementation (verified mid-2026 / v2.3+):** 14 modules, ~99 controllers, EF Core **10**, Hangfire jobs, CAP messaging. Direct `I*Service` injection in controllers. `AddPitbullModule<T>` + `AddPitbullModuleServices<T>` for registration. **No MediatR in controllers.** Role-native home UX: `RoleProfileResolver` + `GET /api/dashboard/role-summary` + KPI drill-through contracts (`roleKpiDrillHref` / `ROLE_KPI_DRILL_CONTRACTS` — see `docs/ROLE-EXPERIENCE.md`). Project management soft-delete for tasks, daily reports, job-cost budgets, submittals, meetings, narratives, communications, and monthly projections (status-guarded where needed). In-app release notes: `GET /api/changelog` from root `CHANGELOG.md` (version headers carry **published date+time**). Live Railway docs: `deploy/RAILWAY-SETUP.md`.

> **Note:** Files under `docs/architecture/` are **frozen Alpha design notes** (Feb 2026). They are not the living architecture. See [`docs/architecture/README.md`](architecture/README.md). Prefer this file + module source for current truth.

### Implemented Modules (current)

| Module | Responsibility |
|--------|---------------|
| **Core** | Shared kernel, multi-tenancy (RLS + company scoping), base entities, `PitbullDbContext`, audit, Result<T> |
| **Projects** | Projects, cost codes (job-cost classes: Labor/Material/Equipment/Sub*/Overhead + optional CSI division), phases, budgets |
| **Bids** | Bid tracking, items, conversion to project |
| **Contracts** | Subcontracts, SOV, change orders |
| **TimeTracking** | TimeEntry, crew timecards, pay periods, payroll workflow, employees |
| **ProjectManagement** | Schedule, RFIs, submittals, daily reports, punch lists, meetings, tasks |
| **Billing** | Vendors, customers, payment apps (AIA G702/G703), GL/journal, WIP, AP/AR, retention, lien waivers, POs/invoices, bank rec |
| **Reports** | Labor cost, profitability, exports (PDF/CSV), financial statements (trial balance etc.) |
| **AI** | Provider abstraction (Anthropic + OpenAI), orchestrator, usage tracking, extraction handlers (invoice, delivery ticket) |
| **SystemAdmin** | Users/roles/RBAC, API keys, secrets vault, settings, health |
| **Notifications** | In-app + Resend email |
| **Documents** | File attachments, storage abstraction (local/S3) |
| **Portal** | External vendor/owner access (limited) |
| **RFIs** | Legacy RFI support (largely merged into ProjectManagement) |

**Notes:** Prefer this document, `CHANGELOG.md`, and `src/Modules` for current state. Portal remains limited. Dual-book accounting and some advanced financial workflows continue to expand.

### Infrastructure Layer

| Project | Purpose |
|---------|---------|
| **Pitbull.Email** | Resend integration for transactional email |
| **Pitbull.Storage** | File storage abstraction |
| **Pitbull.Messaging** | CAP event bus for domain events |

## Key Patterns (Grounded in Current Code)

**Controllers:** Primary ctor injection of `I*Service`. Direct calls. No `IMediator`. `[Authorize]`, rate limiting, `PagedResult<T>`.

**Services:** Interface + impl injected with `PitbullDbContext`, `ITenantContext`, `ICompanyContext`. Always `AsNoTracking()` for reads, `!IsDeleted` filter, `CancellationToken`.

**CQRS remnants:** `ICommand`/`IQuery` + `AddPitbullModule` exist for module registration/FluentValidation pipeline in some areas. New logic favors services. `Result<T>` pattern used internally.

**Multi-tenancy:** TenantMiddleware + `set_config('app.current_tenant', ...)` + RLS policies. Company scoping for `ICompanyScoped`.

**Soft-delete + UTC:** Global filters + SaveChanges UTC normalization.

See the source code, tests, and docs/ARCHITECTURE.md (this file) for current patterns and anti-patterns. Cross-reference live code.

### Multi-Tenancy

Two enforcement layers ensure data isolation:

1. **Application layer:** `TenantMiddleware` resolves tenant from JWT `tenant_id` claim
2. **Database layer:** PostgreSQL RLS policies filter rows by `app.current_tenant` session variable

Compound isolation adds `CompanyId` for multi-company tenants (single tenant, multiple legal entities).

### Vertical Slices

Each feature is self-contained:

```
Features/
  CreateProject/
    CreateProjectCommand.cs    # Request DTO
    CreateProjectHandler.cs    # Business logic
    CreateProjectValidator.cs  # FluentValidation rules
```

## Deployment

### Railway (Production)

- **API:** Docker container from `src/Pitbull.Api/Dockerfile`
- **Frontend:** Docker container from `src/Pitbull.Web/pitbull-web/Dockerfile`
- **Database:** Railway-managed PostgreSQL 17
- **Cache:** Railway-managed Redis 7
- Auto-deploy on push to `main`

### Self-Hosted (Docker Compose)

```bash
docker compose -f docker-compose.prod.yml up -d
```

See [deployment docs](deployment/) for detailed instructions:
- [Railway Deployment](deployment/RAILWAY-DEPLOYMENT.md)
- [Demo Environment Setup](deployment/DEMO-ENVIRONMENT-SETUP.md)

## Testing Strategy

| Type | Count | Framework | Database |
|------|-------|-----------|----------|
| Unit | 1,686 | XUnit + FluentAssertions + Moq | In-memory (EF Core) |
| Integration | 263 | XUnit + FluentAssertions | Real PostgreSQL (Docker) |

CI runs all tests on every push/PR via GitHub Actions.

## Further Reading

- [Best Practices](BEST-PRACTICES.md) — Comprehensive development patterns guide
- [Adding a Module](ADDING-A-MODULE.md) — How to create a new module
- [AI Architecture](architecture/AI-ARCHITECTURE-REQUIREMENTS.md) — AI integration design
- [Cost Code Design](architecture/COST-CODE-DESIGN.md) — CSI MasterFormat implementation
- [Time Tracking Design](architecture/TIME-TRACKING-DESIGN.md) — Labor tracking architecture
