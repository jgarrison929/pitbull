# CLAUDE.md - AI Assistant Guide for Pitbull

This document provides context for AI assistants working with the Pitbull Construction Solutions codebase.

## Project Overview

**Pitbull** is an on-premise construction management SaaS platform for commercial general contractors. It's designed as a self-hosted alternative to expensive per-seat solutions like Procore.

**Architecture:** Modular monolith with CQRS pattern, multi-tenant with PostgreSQL Row-Level Security.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | .NET 9, ASP.NET Core, Entity Framework Core 9, MediatR 12, FluentValidation |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Database | PostgreSQL 17 with RLS |
| Cache | Redis 7 |
| Auth | ASP.NET Identity + JWT |

## Directory Structure

```
pitbull/
├── src/
│   ├── Pitbull.Api/              # ASP.NET Core host (controllers, middleware, DI)
│   │   ├── Controllers/          # REST API endpoints
│   │   ├── Middleware/           # ExceptionMiddleware, TenantMiddleware
│   │   ├── Migrations/           # EF Core migrations (auto-applied on startup)
│   │   └── Program.cs            # DI composition root
│   │
│   ├── Modules/
│   │   ├── Pitbull.Core/         # Shared kernel: DbContext, CQRS, multi-tenancy
│   │   ├── Pitbull.Projects/     # Project management domain
│   │   ├── Pitbull.Bids/         # Bid management domain
│   │   ├── Pitbull.Contracts/    # Subcontracts (stub)
│   │   ├── Pitbull.Documents/    # Documents (stub)
│   │   ├── Pitbull.Portal/       # Sub portal (stub)
│   │   ├── Pitbull.Billing/      # Billing (stub)
│   │   └── Pitbull.RFIs/         # RFIs and submittals
│   │
│   ├── Infrastructure/           # Cross-cutting (email, storage, messaging)
│   │
│   └── Pitbull.Web/pitbull-web/  # Next.js frontend
│       └── src/
│           ├── app/              # App Router routes
│           │   ├── (auth)/       # Public auth pages (login, register)
│           │   └── (dashboard)/  # Protected pages with sidebar
│           ├── components/       # React components (ui/, layout/, skeletons/)
│           ├── contexts/         # React Context (Auth)
│           └── lib/              # Utilities (api.ts, auth.ts)
│
├── tests/
│   ├── Pitbull.Tests.Unit/       # Unit tests (XUnit, in-memory DB)
│   └── Pitbull.Tests.Integration/ # Integration tests (real PostgreSQL)
│
├── docs/                         # Documentation
│   ├── BEST-PRACTICES.md         # Comprehensive dev guide
│   └── ADDING-A-MODULE.md        # New module tutorial
│
└── deploy/                       # Deployment scripts
```

## Key Patterns

### CQRS with MediatR

Commands and queries are separated. Both return `Result<T>` - never throw exceptions for business logic.

```csharp
// Command example
public record CreateProjectCommand(string Name, string Number) : ICommand<ProjectDto>;

// Query example
public record GetProjectQuery(Guid Id) : IQuery<ProjectDto>;

// Handler returns Result
return Result.Success(dto);
return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
```

### Vertical Slice Architecture

Each feature folder contains command/query, handler, and validator:

```
Features/
  CreateProject/
    CreateProjectCommand.cs    # Request + response DTO
    CreateProjectHandler.cs    # Business logic
    CreateProjectValidator.cs  # FluentValidation
```

### Multi-Tenancy

Two enforcement layers:
1. **Application:** TenantMiddleware resolves from JWT `tenant_id` claim
2. **Database:** PostgreSQL RLS policies filter by `app.current_tenant`

## Backend Conventions

### Controllers
- `[Authorize]` at class level (only AuthController is public)
- Route pattern: `[Route("api/[controller]")]`
- Error response: `new { error = "message", code = "CODE" }`

### Handlers
- Inject `PitbullDbContext` directly (no repository pattern)
- Use `db.Set<T>()` to access entities
- Always pass `CancellationToken`
- Queries use `.AsNoTracking()`

### Entity Configuration
- Table names: snake_case (`projects`, `bid_items`)
- Enums stored as strings: `HasConversion<string>()`
- Decimals: `HasPrecision(18, 2)` for money
- Unique indexes include TenantId: `HasIndex(x => new { x.TenantId, x.Number })`

### Error Codes
Use uppercase strings: `NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_STATUS`, `ALREADY_CONVERTED`

## Frontend Conventions

### API Calls
Always use the typed `api()` wrapper, never raw `fetch`:

```typescript
const projects = await api<PagedResult<Project>>("/api/projects");
const bid = await api<Bid>("/api/bids", { method: "POST", body: {...} });
```

### Auth
Use the `useAuth()` hook:

```typescript
const { user, isAuthenticated, login, logout } = useAuth();
```

### Styling
- Mobile-first with Tailwind (`sm:`, `md:`, `lg:`)
- Minimum viewport: 375px (iPhone SE)
- Touch targets: 44px minimum

### Components
- shadcn/ui components in `src/components/ui/`
- Loading states via `loading.tsx` files with skeleton components

## Common Commands

### Backend

```bash
# Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# Run API (migrations auto-apply)
cd src/Pitbull.Api && dotnet run

# Build
cd src/Pitbull.Api && dotnet build

# Run unit tests
cd tests/Pitbull.Tests.Unit && dotnet test

# Add EF migration
cd src/Pitbull.Api && dotnet ef migrations add <Name> -- --environment Development
```

### Frontend

```bash
cd src/Pitbull.Web/pitbull-web

# Install dependencies
npm ci

# Development server
npm run dev

# Build (required before PR)
npm run build

# Lint (must pass with zero warnings)
npm run lint
```

## Git Workflow

### Branching
- `main` - production
- `develop` - integration branch (PRs target here)
- Feature branches: `feat/<name>`, `fix/<name>`, `docs/<name>`

### Commits
Use conventional commits:

```
feat: add bid-to-project conversion
fix: resolve FK constraint on registration
docs: update API documentation
chore: update dependencies
```

### Before Every PR
```bash
# Both must pass
cd src/Pitbull.Api && dotnet build
cd src/Pitbull.Web/pitbull-web && npm run build && npm run lint
```

## API Endpoints

Standard CRUD pattern:

| Method | Route | Returns |
|--------|-------|---------|
| POST | `/api/{resource}` | 201 with created entity |
| GET | `/api/{resource}/{id}` | 200 or 404 |
| GET | `/api/{resource}` | 200 with PagedResult |
| PUT | `/api/{resource}/{id}` | 200 with updated entity |
| DELETE | `/api/{resource}/{id}` | 204 NoContent |

Custom actions use verb routes: `POST /api/bids/{id}/convert-to-project`

API documentation: `http://localhost:5000/swagger`

## Known Issues

1. **Domain events not dispatched** - Events collected but `IMediator.Publish()` not called
2. **CreatedBy/UpdatedBy not populated** - Audit fields exist but not auto-set
3. **Delete endpoint is no-op** - Soft delete not fully implemented
4. **PagedResult in wrong location** - Lives in Projects module, should be in Core

## Testing

### Unit Tests
- Use `TestDbContextFactory.Create()` for in-memory DB
- Test handlers directly, not controllers
- Assert on `result.IsSuccess`, `result.ErrorCode`, `result.Value`

```csharp
[Fact]
public async Task Handle_ValidCommand_ReturnsSuccess()
{
    using var db = TestDbContextFactory.Create();
    var handler = new CreateProjectHandler(db);
    var result = await handler.Handle(command, CancellationToken.None);
    result.IsSuccess.Should().BeTrue();
}
```

### CI Pipeline
GitHub Actions runs on push/PR to `main` and `develop`:
- Backend: restore, build, unit tests, integration tests (PostgreSQL service)
- Frontend: install, build, lint

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/Pitbull.Api/Program.cs` | DI composition, middleware pipeline |
| `src/Modules/Pitbull.Core/Data/PitbullDbContext.cs` | EF context, SaveChanges with audit |
| `src/Modules/Pitbull.Core/CQRS/` | ICommand, IQuery, Result, ValidationBehavior |
| `src/Modules/Pitbull.Core/MultiTenancy/` | TenantMiddleware, ITenantContext |
| `src/Pitbull.Web/pitbull-web/src/lib/api.ts` | Typed fetch wrapper |
| `src/Pitbull.Web/pitbull-web/src/contexts/AuthContext.tsx` | Auth state management |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ConnectionStrings__PitbullDb` | PostgreSQL connection string |
| `Jwt__Key` | JWT signing key (min 32 chars) |
| `Cors__AllowedOrigins__0` | Allowed frontend origin |
| `NEXT_PUBLIC_API_BASE_URL` | API URL (baked into frontend build) |

## Adding a New Feature

1. Create feature folder in appropriate module: `Features/<FeatureName>/`
2. Add command/query record with DTO
3. Add handler implementing `IRequestHandler`
4. Add validator (optional) extending `AbstractValidator`
5. Add controller endpoint in `Pitbull.Api/Controllers/`
6. Add frontend page/component
7. Write unit tests

See `docs/ADDING-A-MODULE.md` for creating entirely new modules.

## Useful Documentation

- `docs/BEST-PRACTICES.md` - Comprehensive patterns guide
- `docs/ADDING-A-MODULE.md` - New module creation
- `CONTRIBUTING.md` - Development workflow
- `RLS-IMPLEMENTATION.md` - Row-Level Security details
- `VISION.md` - Product roadmap
