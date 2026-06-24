# AGENTS.md — Pitbull Construction Solutions

## Project Overview

Pitbull is an agentic back-office platform for construction companies, under development as a learning/prototype project and potential modern, AI-native alternative to tools like Vista/Viewpoint, Procore, and SharePoint.

It is a learning/prototype project with real engineering in multi-tenancy, modular boundaries, and several implemented modules (14 modules, 95 controllers, 155 migrations as of mid-2026). It is **not** yet a production replacement for commercial systems.

- **Stack:** .NET 9 API + Next.js 16 frontend + PostgreSQL 17
- **Architecture:** Modular monolith, CQRS (direct service injection, NOT MediatR in controllers), multi-tenant with row-level security (RLS)
- **Deploy:** Railway (from main), self-hosted Docker support
- **Tests:** ~250 unit + integration tests (via Testcontainers). ~253 .cs test files as of mid-2026.

## Dev Environment

### Backend (.NET)

```bash
# Restore
dotnet restore

# Build
dotnet build Pitbull.sln

# Run unit tests
dotnet test tests/Pitbull.Tests.Unit --configuration Release --verbosity normal

# Run integration tests (requires Docker for Testcontainers PostgreSQL)
dotnet test tests/Pitbull.Tests.Integration --configuration Release --verbosity normal

# Run ALL tests
dotnet test Pitbull.sln --configuration Release --verbosity normal
```

### Frontend (Next.js)

```bash
cd src/Pitbull.Web/pitbull-web

# Install
npm ci

# Build
npm run build

# Lint
npm run lint

# Dev server
npm run dev
```

### Validate Everything Before Committing

```bash
# Backend
dotnet build Pitbull.sln --configuration Release

# Frontend
cd src/Pitbull.Web/pitbull-web && npm run build && npm run lint
```

## Project Structure

```
Pitbull.sln
src/
  Pitbull.Api/                          # API host (controllers, middleware, Program.cs)
    Controllers/                        # All API controllers
    Middleware/                          # ExceptionMiddleware, CORS, RLS, etc.
    Dockerfile                          # Production Docker build
  Modules/
    Pitbull.Core/                       # Shared: BaseEntity, DbContext, domain events, multi-tenancy
      Domain/                           # Entity classes (BaseEntity, AuditLog, Company, etc.)
      Data/                             # EF configurations, PitbullDbContext
      MultiTenancy/                     # Tenant/company middleware and scoping
    Pitbull.Projects/                   # Projects module
    Pitbull.Bids/                       # Bids module
    Pitbull.RFIs/                       # RFI tracking with cost impact
    Pitbull.TimeTracking/               # Time entries, crew timecards, payroll workflow
    Pitbull.Contracts/                  # Subcontracts, change orders, SOV
    Pitbull.ProjectManagement/          # PM: schedule, daily reports, submittals, tasks
    Pitbull.AI/                         # AI provider abstraction (OpenAI + Anthropic)
    Pitbull.Documents/                  # File attachments
    Pitbull.Notifications/              # In-app notification system
    Pitbull.SystemAdmin/                # System administration
    Pitbull.Billing/                    # Payment applications
    Pitbull.Portal/                     # External portal
  Infrastructure/
    Pitbull.Email/                      # Email sending
    Pitbull.Storage/                    # File storage abstraction
    Pitbull.Messaging/                  # CAP event bus (PostgreSQL outbox + Redis)
  Pitbull.Web/pitbull-web/              # Next.js 16 frontend
    src/app/                            # App Router pages
    src/components/                     # Shared UI components
    src/lib/                            # API helpers, utilities
tests/
  Pitbull.Tests.Unit/                   # Unit tests (mocked services)
  Pitbull.Tests.Integration/            # Integration tests (Testcontainers + PostgreSQL)
docs/
  plans/                                # Design docs for features
  specs/                                # Module specifications
```

## Architecture Patterns

### Entity Pattern
All business entities inherit `BaseEntity`:
```csharp
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
}
```
- **Always** filter `!IsDeleted` in queries
- TenantId is enforced via RLS at the database level
- Entities implementing `ICompanyScoped` also have a `CompanyId`

### Controller Pattern
Controllers use **direct service injection** (constructor injection), NOT MediatR:
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
public class ExampleController(IExampleService exampleService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ExampleDto>>> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await exampleService.ListAsync(page, pageSize);
        return Ok(result);
    }
}
```

### Service Pattern
Each module has an interface + implementation:
```
src/Modules/Pitbull.Example/Services/IExampleService.cs
src/Modules/Pitbull.Example/Services/ExampleService.cs
```
Services are auto-registered via `AddPitbullModuleServices<T>()` in `Program.cs`.

### Module Registration (Program.cs)
When adding a new module, you need THREE registrations:
```csharp
// 1. Assembly registration (for EF config discovery)
PitbullDbContext.RegisterModuleAssembly(typeof(YourModuleMarker).Assembly);

// 2. CQRS + validation module registration (handlers/validators)
builder.Services.AddPitbullModule<YourModuleCommand>();

// 3. Service registration
builder.Services.AddPitbullModuleServices<YourModuleCommand>();
```

### Frontend API Pattern
```typescript
// Use the api<T>() helper for JSON responses
const data = await api<ProjectDto[]>('/api/projects');

// Use native fetch for blob/CSV downloads
const response = await fetch('/api/reports/export');
```

### EF Configuration Pattern
Each entity gets a separate configuration class:
```csharp
public class ExampleConfiguration : IEntityTypeConfiguration<Example>
{
    public void Configure(EntityTypeBuilder<Example> builder)
    {
        builder.ToTable("examples");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Name).HasMaxLength(200).IsRequired();
        // ... column mappings
    }
}
```
Place in the module's `Data/` folder. EF discovers them via registered assemblies.

### Migration Pattern
```bash
# Generate migration (from repo root)
dotnet ef migrations add YourMigrationName -p src/Modules/Pitbull.Core -s src/Pitbull.Api

# Migrations live in src/Pitbull.Api/Migrations/
```
- **NEVER** use `RenameColumn` or `RenameTable` (CI blocks these as dangerous)
- **NEVER** use `DROP TABLE` or `TRUNCATE` in raw SQL (CI blocks these)
- When backfilling varchar columns, use `LEFT(value, max_length)` to avoid truncation errors
- Quote column aliases in raw SQL: `AS "Value"` not `AS Value` (PostgreSQL lowercases unquoted)
- RLS policies use PascalCase column names: `"TenantId"` not `tenant_id`

### Multi-Tenancy
- Every request sets `app.current_tenant` via `TenantMiddleware`
- RLS policies filter by TenantId automatically
- Use `set_config()` for tenant context (NOT parameterized queries with `@p0`)
- `ConnectionOpenedAsync` interceptor ensures tenant isolation with connection pooling

### Soft Delete
- ALL queries MUST filter `!IsDeleted`
- Write tests for 404 on deleted items
- Set `DeletedAt` and `DeletedBy` when soft-deleting

## Testing Patterns

### Unit Test Pattern
```csharp
public class ExampleControllerTests
{
    private readonly Mock<IExampleService> _mockService = new();
    private readonly ExampleController _controller;

    public ExampleControllerTests()
    {
        _controller = new ExampleController(_mockService.Object);
        // Set up ClaimsPrincipal with tenant/user claims
    }

    [Fact]
    public async Task List_ReturnsOk()
    {
        _mockService.Setup(s => s.ListAsync(1, 20))
            .ReturnsAsync(new PagedResult<ExampleDto>([], 0, 1, 20));
        var result = await _controller.List();
        result.Result.Should().BeOfType<OkObjectResult>();
    }
}
```

### Integration Test Pattern
- Uses Testcontainers with PostgreSQL 17
- Shared fixture for database setup
- Each test gets its own tenant for isolation

## Dockerfile
When adding a new module, you **MUST** add a COPY line for its .csproj in the Dockerfile:
```dockerfile
COPY src/Modules/Pitbull.YourModule/Pitbull.YourModule.csproj src/Modules/Pitbull.YourModule/
```
Place it with the other module COPY lines in `src/Pitbull.Api/Dockerfile`. Missing this will break the Railway production build.

## CI Pipeline (.github/workflows/ci.yml)

Two parallel jobs:
1. **build-backend:** Restore → Vuln scan → Build → Migration safety check → Unit tests → Integration tests
2. **build-frontend:** Install → Vuln audit → Build → Lint

CI must be GREEN before merging to main. Railway auto-deploys from main.

## Code Style

### C# / .NET
- Use primary constructors for controllers and services
- Use `record` types for DTOs and commands
- `PagedResult<T>` for all list endpoints
- Nullable reference types enabled (`string?` for optional fields)
- File-scoped namespaces
- No `var` for non-obvious types (prefer explicit typing)

### TypeScript / React
- Strict mode enabled
- Functional components with hooks
- Server Components by default, `'use client'` only when needed
- Tailwind CSS for styling (shadcn/ui component library)
- Forms: react-hook-form + zod validation

## Security

- All API endpoints require `[Authorize]` unless explicitly `[AllowAnonymous]`
- Anonymous endpoints MUST be rate-limited
- Bootstrap-admin pattern: check if admins exist before allowing anonymous admin creation
- JWT with tenant-prefixed roles
- Never expose stack traces in production responses
- RLS enforces tenant isolation at the database level

## PR & Commit Conventions

- **Branch naming:** `feature/description`, `fix/description`, `hotfix/description`
- **Commit messages:** Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`)
- **PR title:** Descriptive, matches the feature/fix
- **Before opening PR:** `dotnet build`, `npm run build`, `npm run lint` must all pass
- **Do NOT merge PRs** — push, open PR, request review. User merges after review.

## Design Philosophy

- **This is an ERP system.** Every module needs a settings page. Business rules are configurable within the constraints of GAAP principles and construction industry standards.
- **Dual-book accounting.** Construction companies run GAAP books (for investors/banks) AND Bonus/Job Cost books (for PM performance). The system must support both perspectives on the same underlying data.
- **Configurable, not opinionated.** When a business rule could go either way, make it a toggle in company/module settings. Let the customer decide. Example: "Require signed subcontract before payment application?" → that's a setting, not a hardcoded rule.
- **Balance forward.** Customers shouldn't need a 2-year migration. Meet them where they are.
- **Construction-first.** Every feature should make sense to a GC project manager, not just a developer.
- **Module settings pattern:** Each module should have a `{Module}Settings` entity (company-scoped) with sensible defaults. Settings page in the admin UI. Examples: TimecardSettings already exists — follow that pattern.

## Anti-Patterns (DO NOT DO THESE)

- **Never use MediatR in controllers** — use direct service injection
- **Never fabricate TypeScript types** — always match the backend DTO exactly
- **Never skip `!IsDeleted` filters** — every query must exclude soft-deleted records
- **Never use `RenameColumn`/`RenameTable`** in migrations — CI will reject it
- **Never hardcode tenant IDs** — always derive from the authenticated user's claims
- **Never swallow exceptions silently** — always log, even in catch blocks
- **Never commit with failing tests** — fix them first or explain why in the PR
- **Never push directly to main** — always use feature branches + PRs
- **Never forget the Dockerfile** — new modules need COPY lines or production breaks
