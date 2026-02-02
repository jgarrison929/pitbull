# Pitbull Construction Solutions - Best Practices & Patterns Guide

A practical reference for developers (and AI agents) contributing to the Pitbull codebase.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Backend Patterns](#backend-patterns)
- [Frontend Patterns](#frontend-patterns)
- [Database](#database)
- [Git & CI](#git--ci)
- [Common Pitfalls & Lessons Learned](#common-pitfalls--lessons-learned)
- [Known Issues](#known-issues)

---

## Architecture Overview

### Modular Monolith

Pitbull is a **modular monolith** -- a single deployable unit with clear internal module boundaries. Each domain gets its own .NET class library project under `src/Modules/`:

```
src/
  Modules/
    Pitbull.Core/         # Shared kernel: DbContext, CQRS, multi-tenancy, base entities
    Pitbull.Projects/     # Project management domain
    Pitbull.Bids/         # Bid/estimating domain
    Pitbull.Contracts/    # Contract management (planned)
    Pitbull.Documents/    # Document management (planned)
    Pitbull.Billing/      # Billing domain (planned)
    Pitbull.Portal/       # Client portal (planned)
  Pitbull.Api/            # ASP.NET Core host -- controllers, middleware, DI composition
  Pitbull.Web/            # Next.js frontend
  Infrastructure/         # Cross-cutting infra (email, storage, etc.)
```

**Key principle:** Modules own their domain entities, features, EF configurations, and validators. The API project wires everything together but contains no business logic.

### When to Create a New Module vs. Add to Existing

Create a new module when:
- The domain has its own distinct aggregate root (e.g., `Bid`, `Contract`, `Invoice`)
- The feature area could theoretically be deployed independently
- You need separate EF configurations and migrations wouldn't conflict

Add to an existing module when:
- The feature is a sub-entity of an existing aggregate (e.g., `Phase` belongs to `Project`)
- It's tightly coupled to existing domain logic

### Vertical Slice Architecture (Feature Folders)

Each module uses **feature folders** instead of layers. Every feature (command or query) gets its own folder containing everything it needs:

```
Pitbull.Projects/
  Features/
    CreateProject/
      CreateProjectCommand.cs    # Request DTO + response DTO
      CreateProjectHandler.cs    # Business logic
      CreateProjectValidator.cs  # FluentValidation rules
    GetProject/
      GetProjectQuery.cs
      GetProjectHandler.cs
    ListProjects/
      ListProjectsQuery.cs
      ListProjectsHandler.cs
    UpdateProject/
      UpdateProjectCommand.cs
      UpdateProjectHandler.cs
      UpdateProjectValidator.cs
```

This means you never have to hunt across `Services/`, `Repositories/`, `DTOs/`, and `Validators/` folders. Everything for a feature lives together.

### CQRS with MediatR

Commands (writes) and queries (reads) are separated using MediatR:

- **Commands** implement `ICommand<TResponse>` and change state
- **Queries** implement `IQuery<TResponse>` and only read data
- Both return `Result<T>` -- never throw exceptions for business logic failures

---

## Backend Patterns

### Command/Query Handler Pattern

**Command example** (from `CreateProjectHandler.cs`):

```csharp
// 1. Define the command as a record with ICommand<TResponse>
public record CreateProjectCommand(
    string Name,
    string Number,
    string? Description,
    ProjectType Type,
    // ... other fields
) : ICommand<ProjectDto>;

// 2. Define the response DTO as a record
public record ProjectDto(
    Guid Id,
    string Name,
    string Number,
    // ... mapped fields
);

// 3. Implement the handler
public class CreateProjectHandler(PitbullDbContext db)
    : IRequestHandler<CreateProjectCommand, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(
        CreateProjectCommand request, CancellationToken cancellationToken)
    {
        var project = new Project
        {
            Name = request.Name,
            Number = request.Number,
            // ... map fields
        };

        db.Set<Project>().Add(project);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapToDto(project));
    }
}
```

**Query example** (from `GetProjectHandler.cs`):

```csharp
public record GetProjectQuery(Guid Id) : IQuery<ProjectDto>;

public class GetProjectHandler(PitbullDbContext db)
    : IRequestHandler<GetProjectQuery, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(
        GetProjectQuery request, CancellationToken cancellationToken)
    {
        var project = await db.Set<Project>()
            .AsNoTracking()                    // Always use for queries
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (project is null)
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");

        return Result.Success(CreateProjectHandler.MapToDto(project));
    }
}
```

**Conventions:**
- Queries always use `.AsNoTracking()` for performance
- Handlers inject `PitbullDbContext` directly (no repository abstraction)
- Use `db.Set<T>()` to access entities -- there are no explicit `DbSet` properties per module
- Pass `cancellationToken` through all async calls

### The Result Pattern

All handlers return `Result` or `Result<T>`. No exceptions for expected business failures.

```csharp
// Success
return Result.Success(dto);

// Failure with error code
return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
return Result.Failure<ConvertBidToProjectResult>("Only won bids can be converted", "INVALID_STATUS");
return Result.Failure<ConvertBidToProjectResult>("Already converted", "ALREADY_CONVERTED");
```

Error codes are uppercase strings: `NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_STATUS`, `ALREADY_CONVERTED`.

The `ICommand` and `IQuery` interfaces enforce this:

```csharp
public interface ICommand<TResponse> : IRequest<Result<TResponse>> { }
public interface IQuery<TResponse> : IRequest<Result<TResponse>> { }
```

### FluentValidation Pipeline Behavior

Validators run automatically before handlers via `ValidationBehavior<TRequest, TResponse>`. You just create a validator class in the feature folder:

```csharp
public class CreateProjectValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Project name is required")
            .MaximumLength(200);

        RuleFor(x => x.ContractAmount)
            .GreaterThanOrEqualTo(0).WithMessage("Contract amount cannot be negative");

        RuleFor(x => x.ClientEmail)
            .EmailAddress().When(x => !string.IsNullOrEmpty(x.ClientEmail));

        RuleFor(x => x.EstimatedCompletionDate)
            .GreaterThan(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.EstimatedCompletionDate.HasValue)
            .WithMessage("Estimated completion date must be after start date");
    }
}
```

The pipeline automatically collects all validation errors and returns a `Result.Failure` with code `VALIDATION_ERROR`. No manual validation in handlers.

### Entity Configuration (EF Core)

Each module has a `Data/` folder with `IEntityTypeConfiguration<T>` classes. These are auto-discovered by the DbContext.

**Conventions:**
- Table names are **snake_case**: `projects`, `bids`, `bid_items`, `project_phases`
- Enums are stored as **strings** with `HasConversion<string>()`
- Decimals use explicit precision: `HasPrecision(18, 2)` for money, `HasPrecision(18, 4)` for quantities
- String lengths are always specified: `HasMaxLength(200)`
- Composite unique indexes include `TenantId`: `HasIndex(p => new { p.TenantId, p.Number }).IsUnique()`
- Cascade deletes for owned children, restrict for cross-aggregate references

**Example** (from `BidConfiguration.cs`):

```csharp
public class BidConfiguration : IEntityTypeConfiguration<Bid>
{
    public void Configure(EntityTypeBuilder<Bid> builder)
    {
        builder.ToTable("bids");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name).HasMaxLength(200).IsRequired();
        builder.Property(b => b.Number).HasMaxLength(50).IsRequired();
        builder.Property(b => b.EstimatedValue).HasPrecision(18, 2);
        builder.Property(b => b.Status).HasConversion<string>().HasMaxLength(50);

        builder.HasIndex(b => new { b.TenantId, b.Number }).IsUnique();
        builder.HasIndex(b => b.Status);

        builder.HasMany(b => b.Items)
            .WithOne(i => i.Bid)
            .HasForeignKey(i => i.BidId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

**Computed/derived properties** use `.Ignore()`:

```csharp
builder.Ignore(b => b.CurrentContractAmount);
builder.Ignore(b => b.BudgetVariance);
```

### Multi-Tenancy

Pitbull uses a **shared database, shared schema** multi-tenancy model with two enforcement layers:

1. **Application-level:** `TenantMiddleware` resolves the tenant from JWT claims, `X-Tenant-Id` header, or subdomain. The `TenantContext` is scoped per-request. On `SaveChangesAsync`, the DbContext auto-stamps `TenantId` on all new `BaseEntity` records.

2. **Database-level:** PostgreSQL Row-Level Security (RLS). The middleware sets `SET app.current_tenant = '{tenantId}'` on every request so the DB itself enforces data isolation.

**Resolution order in `TenantMiddleware`:**
1. JWT `tenant_id` claim (preferred -- set during login)
2. `X-Tenant-Id` header (for API integrations)
3. Subdomain (e.g., `acme.pitbull.local`) -- planned but not yet implemented

**Global query filter** on all `BaseEntity` types filters soft-deleted records automatically:

```csharp
// Applied in PitbullDbContext.OnModelCreating
builder.Entity(entityType.ClrType)
    .HasQueryFilter(CreateSoftDeleteFilter(entityType.ClrType));
```

### Audit Fields & Soft Delete

Every entity inherits from `BaseEntity`:

```csharp
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
}
```

`SaveChangesAsync` in `PitbullDbContext` auto-populates:
- `TenantId` from `TenantContext` on insert
- `CreatedAt` on insert
- `UpdatedAt` on update

**Note:** `CreatedBy`/`UpdatedBy`/`DeletedBy` fields exist but are not yet auto-populated. They'll need the current user ID from `HttpContext.User`.

### Domain Events

`BaseEntity` supports domain events via MediatR notifications:

```csharp
public void AddDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);
```

Events implement `IDomainEvent` (which extends `MediatR.INotification`):

```csharp
public abstract record DomainEventBase : IDomainEvent
{
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}
```

**Current status:** The `DispatchDomainEvents()` method in `PitbullDbContext` collects events after save but does not yet dispatch them via MediatR (noted as TODO in the code). When implemented, add `IMediator` to the DbContext constructor.

### Controller Conventions

**Route pattern:** `[Route("api/[controller]")]` -- all routes start with `/api/`.

**Standard CRUD endpoints:**

| Method | Route | Action | Returns |
|--------|-------|--------|---------|
| POST | `/api/projects` | Create | `201 CreatedAtAction` with body |
| GET | `/api/projects/{id}` | Get by ID | `200 Ok` or `404 NotFound` |
| GET | `/api/projects` | List (paginated) | `200 Ok` with `PagedResult<T>` |
| PUT | `/api/projects/{id}` | Update | `200 Ok` with updated entity |
| DELETE | `/api/projects/{id}` | Delete (soft) | `204 NoContent` |

**Custom actions** use verb-based sub-routes:

```csharp
[HttpPost("{id:guid}/convert-to-project")]
public async Task<IActionResult> ConvertToProject(Guid id, [FromBody] ConvertToProjectRequest request)
```

**Response pattern** -- controllers translate Result to HTTP:

```csharp
var result = await mediator.Send(command);
if (!result.IsSuccess)
    return result.ErrorCode == "NOT_FOUND"
        ? NotFound(new { error = result.Error })
        : BadRequest(new { error = result.Error });

return Ok(result.Value);
```

Error responses always use `new { error = "message" }` or `new { error = "message", code = "CODE" }`.

**List endpoints** accept query parameters for filtering and pagination:

```csharp
[HttpGet]
public async Task<IActionResult> List(
    [FromQuery] BidStatus? status,
    [FromQuery] string? search,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 25)
```

### Auth: JWT Claims & [Authorize]

**JWT claims included in every token:**

| Claim | Value |
|-------|-------|
| `sub` | User ID (Guid) |
| `email` | User's email |
| `tenant_id` | Tenant ID (Guid) |
| `full_name` | Display name |
| `user_type` | User type enum |

**Usage:**
- `[Authorize]` attribute at the **controller level** for all protected endpoints
- `AuthController` has **no** `[Authorize]` (login/register are public)
- Access claims in handlers via injecting `IHttpContextAccessor` if needed

### Global Exception Handling

`ExceptionMiddleware` catches all unhandled exceptions and returns a consistent JSON response:

```json
{
  "error": "An unexpected error occurred",
  "traceId": "0HMVQ..."
}
```

In development, the full exception is included. In production, only the trace ID is shown for log correlation.

### Module Registration

In `Program.cs`, each module requires two registration steps:

```csharp
// 1. Register module assembly for EF configuration discovery
PitbullDbContext.RegisterModuleAssembly(typeof(CreateProjectCommand).Assembly);

// 2. Register MediatR handlers + FluentValidation validators
builder.Services.AddPitbullModule<CreateProjectCommand>();
```

The marker type can be any class in the module assembly. By convention, use the module's primary `Create*Command`.

---

## Frontend Patterns

### Next.js App Router

The frontend lives at `src/Pitbull.Web/pitbull-web/` and uses Next.js with the App Router.

**Route groups:**

```
app/
  (auth)/          # Public auth pages (no sidebar/nav)
    login/
    register/
  (dashboard)/     # Protected pages (with sidebar, nav, auth guard)
    projects/
      page.tsx         # List view
      new/page.tsx     # Create form
      [id]/page.tsx    # Detail/edit view
    bids/
      page.tsx
      new/page.tsx
      [id]/page.tsx
```

Route groups `(auth)` and `(dashboard)` share different layouts without affecting the URL path.

### Auth Context

`AuthProvider` wraps the app and provides:

```typescript
const { user, isLoading, isAuthenticated, login, register, logout } = useAuth();
```

Auth state is derived from the JWT token stored in local storage (via `getToken`/`setToken` helpers). On load, the token is decoded client-side to extract user info -- no `/me` API call needed.

The `api` client auto-attaches the `Authorization: Bearer` header and redirects to `/login` on 401 responses.

### API Client

The `api()` function in `src/lib/api.ts` is a typed wrapper around `fetch`:

```typescript
// GET
const projects = await api<PagedResult<Project>>("/api/projects?page=1");

// POST
const newBid = await api<Bid>("/api/bids", {
  method: "POST",
  body: { name: "Highway Bridge", number: "BID-2026-005", estimatedValue: 500000 },
});
```

Key behaviors:
- Auto-adds `Content-Type: application/json` and `Authorization` headers
- JSON-serializes the `body` automatically
- Returns `undefined` for 204 responses
- Throws `ApiError` with `status`, `message`, and `data` for non-OK responses
- Redirects to `/login` and clears token on 401

### Component Structure

Uses **shadcn/ui** components. These are copied into the project (not a node_modules dependency), so they're fully customizable.

### Error Handling

- API errors throw `ApiError` which can be caught and displayed via toast notifications
- The `api` client handles 401 globally (redirect to login)
- Form validation errors should be displayed inline next to the relevant field

---

## Database

### Migration Workflow

Migrations live in the API project (`Pitbull.Api`) since that's where the EF migrations assembly is configured.

**Adding a new migration:**

```bash
cd src/Pitbull.Api
dotnet ef migrations add <MigrationName> -- --environment Development
```

**Applying migrations:**

Migrations auto-apply on startup via `Program.cs`:

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
    await db.Database.MigrateAsync();
}
```

For manual application:

```bash
dotnet ef database update
```

### Naming Conventions

- **Tables:** snake_case (`projects`, `bid_items`, `project_phases`, `project_budgets`)
- **Identity tables:** Renamed from ASP.NET defaults to snake_case (`users`, `roles`, `user_roles`, etc.)
- **Columns:** EF convention (PascalCase in C#, auto-maps to snake_case via Npgsql)
- **Indexes:** Auto-named by EF convention

### Foreign Key Patterns

- **Parent-child (owned):** Cascade delete. Example: `Bid` -> `BidItem`, `Project` -> `Phase`
- **Cross-aggregate references:** Restrict delete. Example: `AppUser` -> `Tenant`
- **Optional references:** Nullable FK. Example: `Project.SourceBidId`, `Bid.ProjectId`

### Connection String Management

- **Local development:** Uses `appsettings.Development.json` with a local PostgreSQL connection string
- **Railway (production):** The `ConnectionStrings__PitbullDb` environment variable overrides the config
- **CI:** Spins up a PostgreSQL 17 service container and passes the connection string via env var

---

## Git & CI

### Branch Naming

- `main` -- production branch
- `develop` -- integration branch
- Feature branches: `feature/<short-description>` (e.g., `feature/add-contracts-module`)
- Bug fixes: `fix/<short-description>`
- Docs: `docs/<short-description>`

### Commit Message Format

Use **conventional commits**:

```
feat: add bid-to-project conversion endpoint
fix: resolve FK constraint error on user registration
docs: add best practices guide
chore: update NuGet packages
refactor: extract validation pipeline behavior
```

### CI Workflow

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main` and `develop`:

**Backend job:**
1. Checkout
2. Setup .NET 9.0
3. `dotnet restore`
4. `dotnet build --configuration Release`
5. Run unit tests (`tests/Pitbull.Tests.Unit`)
6. Run integration tests with a PostgreSQL 17 service container

**Frontend job:**
1. Checkout
2. Setup Node.js 22
3. `npm ci`
4. `npm run build`
5. `npm run lint`

Both jobs must pass before merge.

---

## Common Pitfalls & Lessons Learned

### 1. Registration FK Constraint Error

**Problem:** User registration failed with a foreign key constraint error because the `Tenant` and `AppUser` were being created in separate `SaveChangesAsync` calls without a transaction. If user creation failed (e.g., duplicate email), an orphan tenant was left behind.

**Fix:** Wrapped tenant + user creation in an explicit transaction with `CreateExecutionStrategy().ExecuteAsync()` (required by Npgsql's retry-on-failure):

```csharp
var strategy = db.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var transaction = await db.Database.BeginTransactionAsync();
    try
    {
        // Create tenant
        // Create user
        await transaction.CommitAsync();
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
});
```

**Lesson:** Always use explicit transactions when multiple entities must be created atomically, especially when using `EnableRetryOnFailure`.

### 2. Missing [Authorize] Attribute

**Problem:** New controller endpoints were accidentally left without `[Authorize]`, exposing them publicly.

**Fix:** Apply `[Authorize]` at the **controller class level**, not per-action. Only `AuthController` should be public.

**Lesson:** Every new controller should have `[Authorize]` at the class level. If a specific endpoint needs to be public, use `[AllowAnonymous]` on that action.

### 3. Empty 500 Errors in Production

**Problem:** Unhandled exceptions returned empty 500 responses with no body, making debugging impossible.

**Fix:** Added `ExceptionMiddleware` as the **first** middleware in the pipeline. It catches all exceptions and returns a JSON body with a `traceId` for log correlation.

**Lesson:** Always check that `ExceptionMiddleware` is registered before other middleware in the pipeline. The trace ID lets you find the full stack trace in Serilog logs.

### 4. Soft Delete Query Filter Not Applied

**Problem:** Direct LINQ queries could accidentally return soft-deleted records if not filtered.

**Fix:** The global query filter on `BaseEntity` in `PitbullDbContext.OnModelCreating` handles this automatically. Use `IgnoreQueryFilters()` only when you explicitly need deleted records (e.g., admin recovery tools).

**Lesson:** Never manually filter `IsDeleted` in queries -- the global filter handles it. If you see deleted records showing up, check that the entity inherits from `BaseEntity`.

---

## Known Issues

1. **Domain events not dispatched:** `PitbullDbContext.DispatchDomainEvents()` collects events but doesn't call `IMediator.Publish()`. Needs `IMediator` injected into the DbContext (or use a separate dispatcher service to avoid the circular dependency).

2. **CreatedBy/UpdatedBy not populated:** The audit fields `CreatedBy`, `UpdatedBy`, and `DeletedBy` exist on `BaseEntity` but `SaveChangesAsync` doesn't set them. Need to inject `IHttpContextAccessor` and read from `User.Claims`.

3. **Delete endpoint is a no-op:** `ProjectsController.Delete` fetches the project but doesn't actually mark it as deleted. Needs a proper soft-delete implementation.

4. **Subdomain tenant resolution not implemented:** `TenantMiddleware` has a placeholder for subdomain-based tenant lookup but returns null. Will need a tenant lookup service.

5. **PagedResult defined in Projects module:** `PagedResult<T>` lives in `Pitbull.Projects.Features.ListProjects` but is used by other modules too. Should be moved to `Pitbull.Core.CQRS`.

6. **BidDto/BidMapper at Features root:** `BidDto.cs` and `BidMapper.cs` sit in `Pitbull.Bids/Features/` at the root level instead of in a shared subfolder. Consider moving to `Pitbull.Bids/Features/Shared/` or a `Mapping/` folder for consistency with the per-feature folder pattern.
