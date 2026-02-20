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
2. **Domain entities** in `Domain/` — inherit from `BaseEntity`, implement `ICompanyScoped`
3. **Service interfaces + implementations** in `Services/`
4. **EF configurations** in `Data/` — `IEntityTypeConfiguration<T>` with snake_case table names
5. **Register in DbContext** — add `DbSet<T>` properties to `PitbullDbContext`
6. **Register services** in `Program.cs` — use `builder.Services.AddScoped<IService, Service>()`
7. **Controller** in `Pitbull.Api/Controllers/` — standard pattern with rate limiting
8. **Frontend pages** in `app/(dashboard)/` — list + detail + create/edit
9. **Tests** in `tests/Pitbull.Tests.Unit/`
10. **Navigation** — add to `nav-items.ts` sidebar configuration

## Entity Patterns

### BaseEntity
```csharp
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
}
```

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

### Constructor Injection
```csharp
public class ProjectService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    ILogger<ProjectService> logger) : IProjectService
```

### Query Pattern (reads)
```csharp
var items = await db.Projects
    .AsNoTracking()
    .Where(p => p.CompanyId == companyContext.CompanyId)
    .OrderByDescending(p => p.CreatedAt)
    .ToListAsync(ct);
```

### Command Pattern (writes)
```csharp
var entity = new Project { ... };
db.Projects.Add(entity);
await db.SaveChangesAsync(ct);  // UTC conversion + audit trail happens here
```

## Multi-Tenancy Layers

1. **JWT claim** → `tenant_id` → resolved by `TenantMiddleware`
2. **Query filter** → `HasQueryFilter(x => !x.IsDeleted && x.TenantId == tenantId)`
3. **RLS policy** → PostgreSQL enforces at DB level even if app layer has a bug
4. **Company scope** → `CompanyMiddleware` → `ICompanyContext` → additional filter

## Event Bus (CAP)

```csharp
// Publishing
await capPublisher.PublishAsync("time-entry.submitted", new TimeEntrySubmittedEvent { ... });

// Subscribing
[CapSubscribe("time-entry.submitted")]
public async Task HandleTimeEntrySubmitted(TimeEntrySubmittedEvent @event) { ... }
```

- Uses PostgreSQL outbox (transactional with DB writes)
- Redis Streams transport (in-memory fallback when Redis unavailable)
- Ordered processing for payroll-critical events

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
