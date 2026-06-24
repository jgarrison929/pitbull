---
name: erp-architecture
description: AAI-ERP system architect. Use when creating new modules, defining entity relationships, designing service interfaces, working with multi-tenancy, event bus patterns, or making structural decisions. Enforces module boundaries and CQRS conventions.
---

# AAI-ERP Architecture — System Design Expert

## Your Role
You are the system architect for a modular monolith construction ERP. You enforce clean boundaries, consistent patterns, and scalable design decisions.

## Module Creation Checklist

When creating a new module:

1. **Create module project:** `src/Modules/Pitbull.{ModuleName}/`
2. **Domain entities** in `Domain/` (or Features/ for CQRS DTOs) — inherit from `BaseEntity`, implement `ICompanyScoped` when company-level
3. **Service interfaces + implementations** in `Services/` (auto-registered if end in "Service")
4. **EF configurations** in `Data/` — `IEntityTypeConfiguration<T>` with snake_case table names. Register assembly in Program.cs via `PitbullDbContext.RegisterModuleAssembly`
5. **Db access** — Prefer `db.Set<YourEntity>()` (Set<T> used heavily); add DbSet only for heavily referenced in Pitbull.Core if needed
6. **Register module** in Program.cs:
   - `PitbullDbContext.RegisterModuleAssembly(...)`
   - `builder.Services.AddPitbullModule<YourMarker>();`
   - `builder.Services.AddPitbullModuleServices<YourMarker>();`
   - Explicit `AddScoped` only for non-auto or cross-cutting
7. **Controller** in `Pitbull.Api/Controllers/` — primary ctor injection of IService, [Authorize] + rate limit
8. **Frontend pages** in `app/(dashboard)/...` — list + detail + create/edit + loading.tsx + empty states
9. **Tests** in `tests/Pitbull.Tests.Unit/` (and Integration if DB heavy)
10. **Navigation** — update `src/Pitbull.Web/pitbull-web/src/components/layout/nav-items.ts` and workspaces.ts as needed.

## Entity Patterns

### BaseEntity (actual)
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

    // Domain events (still dispatched via MediatR INotification in some paths)
    private readonly List<IDomainEvent> _domainEvents = [];
    ...
}
```
ALWAYS filter `!IsDeleted`. All writes go through DbContext.SaveChanges which enforces UTC + audit.

### ICompanyScoped
All business entities must implement this for multi-company isolation:
```csharp
public interface ICompanyScoped
{
    Guid CompanyId { get; set; }
}
```

### Enum Rules
- Always store as string: `HasConversion<string>()`
- Always start from 0
- NEVER reorder existing values (they're stored in DB)
- Add new values at the end only
- Frozen enums (stored in DB): document with `// FROZEN — DO NOT REORDER`

## Service Patterns

### Constructor Injection + patterns
```csharp
public class ProjectService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    ILogger<ProjectService> logger) : IProjectService
```

### Query Pattern (reads)
```csharp
// Prefer AsNoTracking for reads. Use Set<T> or DbSet.
var items = await db.Set<Project>()
    .AsNoTracking()
    .Where(p => p.CompanyId == companyContext.CompanyId && !p.IsDeleted)
    .OrderByDescending(p => p.CreatedAt)
    .ToListAsync(ct);
```

### Command Pattern (writes)
```csharp
var entity = new Project { ... };
db.Set<Project>().Add(entity);
await db.SaveChangesAsync(ct);  // global UTC fix + audit + domain events happen here
// Return Result<T> (from Pitbull.Core.CQRS) for success/failure + error codes
```
Controllers call services directly (no _mediator.Send). Validation via FluentValidation injected or inside service.

## Multi-Tenancy Layers

1. **JWT claim** → `tenant_id` → resolved by `TenantMiddleware`
2. **Query filter** → `HasQueryFilter(x => !x.IsDeleted && x.TenantId == tenantId)`
3. **RLS policy** → PostgreSQL enforces at DB level even if app layer has a bug
4. **Company scope** → `CompanyMiddleware` → `ICompanyContext` → additional filter

## Event Bus (CAP)

```csharp
// Publishing (in services or after SaveChanges)
await capPublisher.PublishAsync("time-entry.submitted", new TimeEntrySubmittedEvent { ... });

// Subscribing (consumers in module)
[CapSubscribe("time-entry.submitted")]
public async Task HandleTimeEntrySubmitted(TimeEntrySubmittedEvent @event) { ... }
```

- Uses PostgreSQL outbox (transactional with DB writes via DotNetCore.CAP)
- Redis Streams transport (in-memory fallback)
- Note: Legacy MediatR still used internally for domain event dispatch (IDomainEvent : INotification) and ValidationBehavior pipeline. Controllers do NOT use it.

## Migration Rules

1. **One migration per feature.** Don't scaffold multiple migrations in the same session.
2. **Diff against recent migrations** before committing — EF captures full model delta, causing duplicate columns.
3. **Never modify existing migrations.** Create a new one to fix issues.
4. **Test migration applies cleanly** to current production schema.

## Performance Guidelines

- **Read-heavy endpoints** (chart of accounts, cost codes, project lists): use IMemoryCache with 5-min TTL
- **List endpoints**: always paginated (default page size 25, max 100)
- **Include entities**: use `.Include()` sparingly — prefer projection with `.Select()`
- **Expected scale**: 200+ employees, 50+ active projects, 1000+ time entries/week per tenant

## Security Patterns

- **File uploads**: validated by `IFileValidationService` (blocked extensions, content-type allowlist, double-extension check)
- **Rate limiting**: 10 policies in Program.cs — all controllers must have `[EnableRateLimiting]`
- **JWT**: signed key in environment variable. DataProtection keys persisted to PostgreSQL.
- **AI inputs**: sanitized by `AiSanitizer` (zero-width bypass prevention, HTML stripping)
