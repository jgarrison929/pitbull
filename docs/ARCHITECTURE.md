# Architecture Overview

Pitbull is a **modular monolith** built on .NET 9 and Next.js 16. It uses CQRS for command/query separation, PostgreSQL Row-Level Security for multi-tenancy, and a vertical-slice module structure.

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| API Host | ASP.NET Core 9 | REST API, middleware pipeline, DI composition |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | App Router SPA with shadcn/ui components |
| Database | PostgreSQL 17 | Multi-tenant with Row-Level Security |
| Cache | Redis 7 | Session and data caching |
| Auth | ASP.NET Identity + JWT | Token-based auth with role claims |
| Messaging | DotNetCore.CAP | Event bus (MIT-licensed, replaced MassTransit) |
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
│  │           PitbullDbContext (EF Core 9)              │  │
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

Each module is a separate .NET project under `src/Modules/`. Modules follow vertical slice architecture — each feature contains its command/query, handler, and validator in a single folder.

### Shipped Modules

| Module | Responsibility |
|--------|---------------|
| **Core** | Shared kernel, multi-tenancy, employees, equipment, `PitbullDbContext` |
| **Projects** | Project management, cost codes (CSI MasterFormat), budgets, phases |
| **ProjectManagement** | Submittals, daily reports, meetings, tasks, documents, communications |
| **Bids** | Opportunity tracking, bid management, win/loss analytics, bid-to-project conversion |
| **TimeTracking** | Labor hours, phase/equipment tracking, crew entry, approval workflow, pay periods |
| **RFIs** | RFI tracking, cost impact analysis |
| **Contracts** | Subcontracts, change orders, AIA G702/G703 payment applications |
| **Reports** | Labor cost, profitability, equipment reports, CSV exports, Vista/Viewpoint export |
| **AI** | Provider abstraction (Claude + OpenAI), context-aware chat, smart fields |
| **SystemAdmin** | RBAC admin, audit log, system health monitoring, API keys, user invitations |
| **Notifications** | In-app + email (Resend), notification preferences per user |

### Planned Modules

| Module | Target |
|--------|--------|
| **Documents** | Document management and compliance tracking |
| **Portal** | Subcontractor self-service portal |
| **Billing** | Owner billing, invoicing, retainage release |

### Infrastructure Layer

| Project | Purpose |
|---------|---------|
| **Pitbull.Email** | Resend integration for transactional email |
| **Pitbull.Storage** | File storage abstraction |
| **Pitbull.Messaging** | CAP event bus for domain events |

## Key Patterns

### CQRS + Result Pattern

All commands and queries return `Result<T>` — never throw exceptions for business logic:

```csharp
// Command
public record CreateProjectCommand(string Name, string Number) : ICommand<ProjectDto>;

// Handler returns Result
return Result.Success(dto);
return Result.Failure<ProjectDto>("Not found", "NOT_FOUND");
```

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
