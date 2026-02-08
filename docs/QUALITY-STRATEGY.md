# Pitbull Quality Strategy

**Created:** 2026-02-01
**Owner:** Quality Architect (AI Agent)
**Last Updated:** 2026-02-01

This document covers what endpoint testing alone will never catch. It is organized by risk category, with specific mitigations referencing actual code in the Pitbull repo.

---

## Table of Contents

1. [Data Integrity](#1-data-integrity)
2. [Security Beyond Auth](#2-security-beyond-auth)
3. [Reliability](#3-reliability)
4. [Performance](#4-performance)
5. [Observability](#5-observability)
6. [Code Quality Gates](#6-code-quality-gates)
7. [Construction-Specific Risks](#7-construction-specific-risks)
8. [Implementation Priority](#8-implementation-priority)

---

## 1. Data Integrity

### 1.1 SQL Injection via Raw Interpolated SQL

**Risk:** `TenantMiddleware.cs` line 26 uses string interpolation inside `ExecuteSqlRawAsync`:

```csharp
await db.Database.ExecuteSqlRawAsync(
    $"SET app.current_tenant = '{tenantId.Value}'");
```

If `tenantId` were ever derived from user input (like the `X-Tenant-Id` header), this is a direct SQL injection vector. Right now `Guid.TryParse` provides some protection, but the pattern itself is dangerous and will be copied.

**Why QA won't catch it:** Functional tests send valid GUIDs. Nobody sends `'; DROP TABLE projects; --` as a tenant ID.

**Mitigation:** Use `ExecuteSqlInterpolatedAsync` which parameterizes automatically:

```csharp
await db.Database.ExecuteSqlInterpolatedAsync(
    $"SET app.current_tenant = {tenantId.Value.ToString()}");
```

Or better, use a parameterized raw SQL call:

```csharp
await db.Database.ExecuteSqlRawAsync(
    "SET app.current_tenant = @p0", tenantId.Value.ToString());
```

**Priority:** P0 -- fix immediately in v0.1.0

---

### 1.2 Concurrent Edits (No Optimistic Concurrency)

**Risk:** Two users editing the same project simultaneously. User A loads the project, User B loads it, User A saves, User B saves and silently overwrites User A's changes. This is called "last write wins" and it destroys data.

**Why QA won't catch it:** Single-user testing never exercises concurrent writes.

**Mitigation:** Add a `RowVersion` (concurrency token) to `BaseEntity`:

```csharp
// In BaseEntity.cs
[Timestamp]
public byte[] RowVersion { get; set; } = null!;
```

Configure in EF:

```csharp
// In each entity configuration
builder.Property(e => e.RowVersion)
    .IsRowVersion()
    .HasColumnName("xmin")  // PostgreSQL system column -- free concurrency token
    .HasColumnType("xid")
    .ValueGeneratedOnAddOrUpdate();
```

PostgreSQL's `xmin` system column is a built-in concurrency token -- no migration needed. Configure EF to use it:

```csharp
builder.UseXminAsConcurrencyToken();
```

Handle `DbUpdateConcurrencyException` in the update handlers and return a `CONFLICT` result.

**Priority:** P1 -- implement in v0.1.0

---

### 1.3 Soft Delete Does Not Cascade

**Risk:** If a project is soft-deleted (`IsDeleted = true`), its child records (phases, budgets, projections) remain active. They become orphaned ghosts -- invisible parent, visible children. When we add documents, RFIs, and submittals linked to projects, this gets worse.

**Why QA won't catch it:** Delete tests check the parent disappears. Nobody checks that child records also become inaccessible through other entry points.

**Mitigation:** Create a `SoftDeleteService` that cascades soft deletes through navigation properties:

```csharp
public class SoftDeleteService(PitbullDbContext db)
{
    public async Task SoftDeleteWithCascade<T>(Guid id, string deletedBy) where T : BaseEntity
    {
        var entity = await db.Set<T>().FindAsync(id);
        if (entity == null) return;
        
        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        entity.DeletedBy = deletedBy;
        
        // Cascade to owned children via reflection or explicit mappings
        // Each module registers its cascade rules
    }
}
```

Also fix the `ProjectsController.Delete` endpoint which currently is a no-op (Known Issue #3 from BEST-PRACTICES.md).

**Priority:** P1 -- implement in v0.1.0

---

### 1.4 Multi-Tenant Data Leakage

**Risk:** The `BaseEntity` global query filter only filters by `IsDeleted`, NOT by `TenantId`. Tenant isolation relies entirely on:
1. RLS at the database level (the `SET app.current_tenant` call)
2. The application-level `TenantContext.TenantId` auto-stamp on `SaveChangesAsync`

If the RLS policies are missing, misconfigured, or bypassed (e.g., by a migration, a raw query, or a new table without RLS), any authenticated user can see any tenant's data.

**Why QA won't catch it:** Tests use a single tenant. You need multi-tenant integration tests.

**Mitigation:**

1. Add a tenant query filter alongside the soft-delete filter in `PitbullDbContext.OnModelCreating`:

```csharp
// Defense in depth: application-level tenant filter + database RLS
builder.Entity(entityType.ClrType)
    .HasQueryFilter(CreateTenantAndSoftDeleteFilter(entityType.ClrType));
```

2. Write integration tests that create two tenants and verify tenant A cannot see tenant B's data:

```csharp
[Fact]
public async Task TenantA_CannotSee_TenantB_Projects()
{
    // Create project as Tenant A
    // Switch context to Tenant B  
    // Query projects -- should return empty
}
```

3. Add a CI check that every table with a `tenant_id` column has an RLS policy.

**Priority:** P0 -- fix immediately in v0.1.0

---

### 1.5 Orphaned Records from Failed Transactions

**Risk:** The registration FK bug (Known Issue #1, already fixed) demonstrated this pattern. Other places in the code do multi-entity writes without transactions. `ConvertBidToProjectHandler.cs` creates a `Project` and updates a `Bid` in a single `SaveChangesAsync` which is safe, but any future handler that calls `SaveChangesAsync` multiple times risks orphans.

**Why QA won't catch it:** Happy-path tests succeed. Failure injection (kill the DB mid-transaction) is needed.

**Mitigation:**

1. Establish a code review rule: any handler that calls `SaveChangesAsync` more than once MUST use an explicit transaction with the execution strategy pattern (as shown in `AuthController.Register`).
2. Add a Roslyn analyzer or architecture test that flags multiple `SaveChangesAsync` calls in a single handler method.
3. Document the pattern in BEST-PRACTICES.md.

**Priority:** P2 -- v0.2.0

---

### 1.6 Tenant Deletion Leaves Data Behind

**Risk:** There is no tenant deletion flow, but when one is added: deleting a `Tenant` from the `tenants` table while leaving all its `projects`, `bids`, `users`, etc. creates massive data orphans. The FK from `AppUser` to `Tenant` is `DeleteBehavior.Restrict`, so a raw delete would fail, but a soft-delete would leave everything dangling.

**Why QA won't catch it:** The feature does not exist yet, so it cannot be tested. But it will be built eventually.

**Mitigation:** Design the tenant deletion flow now (even if not implemented):
- Soft-delete the tenant
- Background job cascades soft-delete to all tenant data
- 30-day grace period before hard-delete
- Hard-delete uses a dedicated service that removes data in correct FK order
- Document in BEST-PRACTICES.md

**Priority:** P3 -- v0.5.0 (before pilot customers)

---

## 2. Security Beyond Auth

### 2.1 Mass Assignment (Over-Posting)

**Risk:** Controllers bind `[FromBody]` directly to MediatR command records. If a command record has properties that should not be user-settable (like `TenantId` or `IsDeleted`), a malicious client could include them in the JSON body.

Current commands like `CreateProjectCommand` accept all fields directly. If someone adds a `TenantId` property to a command, a user could post data into another tenant.

**Why QA won't catch it:** Tests send expected payloads. Nobody tests sending `"tenantId": "<other-tenant>"` in a create request.

**Mitigation:**

1. Never expose `TenantId`, `Id`, `CreatedAt`, `UpdatedAt`, `IsDeleted` in command DTOs.
2. Add a unit test that scans all `ICommand<T>` implementations via reflection and asserts none have properties named `TenantId`, `IsDeleted`, `CreatedBy`, etc.
3. Consider using `[JsonIgnore]` on sensitive base entity properties, or better, always map from explicit DTOs to entities manually (which the codebase already does).

```csharp
[Fact]
public void Commands_ShouldNot_Contain_Dangerous_Properties()
{
    var commandTypes = typeof(CreateProjectCommand).Assembly
        .GetTypes()
        .Where(t => t.GetInterfaces().Any(i => 
            i.IsGenericType && i.GetGenericTypeDefinition() == typeof(ICommand<>)));

    var forbidden = new[] { "TenantId", "IsDeleted", "CreatedAt", "CreatedBy" };
    
    foreach (var type in commandTypes)
    {
        var props = type.GetProperties().Select(p => p.Name);
        props.Should().NotContain(forbidden);
    }
}
```

**Priority:** P1 -- v0.1.0

---

### 2.2 JWT Secret in appsettings.json

**Risk:** `appsettings.json` contains `"Key": "CHANGE-ME-IN-PRODUCTION-minimum-32-characters-long"`. This file is committed to git. If the production key is also in `appsettings.json` or `appsettings.Production.json`, it is in the repo history forever.

**Why QA won't catch it:** Auth works fine. The vulnerability is in the secret management, not the auth flow.

**Mitigation:**

1. Production JWT key MUST come from an environment variable, never a config file. Verify the Railway deployment uses `Jwt__Key` env var.
2. Add a startup check that fails if the default key is used in non-Development environments:

```csharp
if (!app.Environment.IsDevelopment())
{
    var jwtKey = app.Configuration["Jwt:Key"];
    if (jwtKey == "CHANGE-ME-IN-PRODUCTION-minimum-32-characters-long")
        throw new InvalidOperationException("Production JWT key not configured!");
}
```

3. Run `git log --all -p -- '**/appsettings*'` and verify no real secrets were ever committed.

**Priority:** P0 -- verify immediately

---

### 2.3 No Rate Limiting

**Risk:** The auth endpoints (`/api/auth/login`, `/api/auth/register`) have no rate limiting. An attacker can brute-force passwords or create unlimited tenants. ASP.NET Identity's `lockoutOnFailure: true` on `CheckPasswordSignInAsync` helps, but it only locks the target account -- it does not stop distributed attacks across multiple accounts.

**Why QA won't catch it:** QA sends one request at a time.

**Mitigation:** Add the built-in .NET 9 rate limiter:

```csharp
// In Program.cs
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
    
    options.AddFixedWindowLimiter("api", opt =>
    {
        opt.PermitLimit = 60;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 2;
    });
    
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Too many requests. Try again later." }, token);
    };
});

// In pipeline
app.UseRateLimiter();

// On controllers
[EnableRateLimiting("auth")]  // on AuthController
[EnableRateLimiting("api")]   // on other controllers
```

**Priority:** P0 -- v0.1.0

---

### 2.4 CORS Too Permissive in Development

**Risk:** The "Dev" CORS policy allows `AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()`. This is fine locally, but if the app accidentally runs with `ASPNETCORE_ENVIRONMENT=Development` on Railway, every origin can make authenticated requests.

**Why QA won't catch it:** CORS is a browser enforcement mechanism. curl ignores it.

**Mitigation:**

1. Add a startup warning/failure if `IsDevelopment()` returns true on Railway:

```csharp
if (app.Environment.IsDevelopment() && 
    Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT") != null)
{
    throw new InvalidOperationException(
        "Running in Development mode on Railway! Set ASPNETCORE_ENVIRONMENT=Production");
}
```

2. Review Railway environment variables to confirm `ASPNETCORE_ENVIRONMENT=Production`.

**Priority:** P1 -- v0.1.0

---

### 2.5 No Input Sanitization on Search

**Risk:** `ListProjectsHandler.cs` uses user-provided `request.Search` directly in a LINQ `Contains` call. While EF Core parameterizes this (preventing SQL injection), there is no length limit on the search term. A very long search string could cause expensive `LIKE` operations.

**Why QA won't catch it:** Tests use short search terms.

**Mitigation:**

1. FluentValidation on query DTOs (not just commands):

```csharp
public class ListProjectsValidator : AbstractValidator<ListProjectsQuery>
{
    public ListProjectsValidator()
    {
        RuleFor(x => x.Search).MaximumLength(200);
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
```

2. Cap `pageSize` server-side even if the validator is bypassed:

```csharp
var effectivePageSize = Math.Min(request.PageSize, 100);
```

**Priority:** P1 -- v0.1.0

---

### 2.6 Dependency Vulnerability Scanning

**Risk:** NuGet and npm packages can contain known vulnerabilities. Without automated scanning, you will not know until it is too late.

**Why QA won't catch it:** QA tests functionality, not dependency security.

**Mitigation:** Add to CI pipeline:

```yaml
# In ci.yml, after build
- name: Check NuGet vulnerabilities
  run: dotnet list package --vulnerable --include-transitive

- name: Check npm vulnerabilities  
  working-directory: src/Pitbull.Web/pitbull-web
  run: npm audit --production
```

Also consider GitHub Dependabot (free for private repos):

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "nuget"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/src/Pitbull.Web/pitbull-web"
    schedule:
      interval: "weekly"
```

**Priority:** P1 -- v0.1.0

---

### 2.7 File Upload Security (Future)

**Risk:** The Documents module is planned for v0.5.0. When file uploads are added, risks include: executable uploads disguised as documents, path traversal (`../../etc/passwd`), zip bombs, oversized files exhausting disk/memory, and serving uploaded files with incorrect MIME types.

**Why QA won't catch it:** Testing uploads of valid PDFs won't catch malicious payloads.

**Mitigation (design now, implement in v0.5.0):**

1. Allowlist file extensions: `.pdf`, `.docx`, `.xlsx`, `.dwg`, `.jpg`, `.png`
2. Validate MIME type via magic bytes, not just extension
3. Enforce max file size (50MB per RELEASE-PLAN.md quality gates)
4. Store uploads outside the web root (object storage like S3/MinIO)
5. Serve files through a controller that sets `Content-Disposition: attachment`
6. Scan with ClamAV or similar before storing
7. Generate unique filenames; never use the user-provided filename for storage

**Priority:** P3 -- design in v0.2.0, implement in v0.5.0

---

## 3. Reliability

### 3.1 Health Check is Shallow

**Risk:** The current health check at `/health` returns `{ status: "healthy" }` without checking any dependencies. If PostgreSQL is down, the health check still reports healthy. Load balancers and monitoring tools will not know the service is degraded.

**Why QA won't catch it:** QA tests endpoints when everything is running. Health checks matter when things are broken.

**Mitigation:** Use ASP.NET's built-in health check framework:

```csharp
// In Program.cs
builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration.GetConnectionString("PitbullDb")!,
        name: "postgresql",
        tags: ["db", "ready"])
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"]);

// Replace the manual /health endpoint
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

NuGet packages needed:
- `AspNetCore.HealthChecks.NpgSql`
- `AspNetCore.HealthChecks.UI.Client` (for JSON response formatting)

Add Redis health check when Redis is integrated. Add AI service health checks in v0.5.0.

**Priority:** P0 -- v0.1.0

---

### 3.2 Database Connection Pool Exhaustion

**Risk:** Default Npgsql connection pool is 100 connections. With multiple Railway instances, background jobs, and the OCR pipeline all sharing the pool, exhaustion is possible. Symptoms: requests hang for 30 seconds then timeout.

**Why QA won't catch it:** Requires load testing or sustained concurrent usage.

**Mitigation:**

1. Configure pool limits explicitly in the connection string:

```
Host=...;Port=5432;Database=pitbull;...;Maximum Pool Size=50;Connection Idle Lifetime=300;
```

2. Add a health check for pool utilization
3. Ensure all `PitbullDbContext` usages are scoped (they are, via DI), and no handler holds a context across async boundaries.
4. Add connection pool metrics to logging (Npgsql 9+ supports this via OpenTelemetry).

**Priority:** P2 -- v0.2.0

---

### 3.3 Auto-Migration on Startup is Dangerous

**Risk:** `Program.cs` runs `db.Database.MigrateAsync()` on every startup. In production with multiple instances, concurrent migrations can corrupt the database. Additionally, a bad migration will crash the app on deploy with no easy rollback.

**Why QA won't catch it:** Single-instance dev/test environments work fine.

**Mitigation:**

1. Remove auto-migration from `Program.cs` for production. Use a one-time migration job instead.
2. For Railway, use a deploy hook or a separate migration container that runs before the app starts.
3. Keep auto-migrate for Development only:

```csharp
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
    await db.Database.MigrateAsync();
}
```

4. For production, run migrations via CI/CD:

```bash
dotnet ef database update --connection "$CONNECTION_STRING"
```

**Priority:** P1 -- v0.1.0

---

### 3.4 No Graceful Degradation Pattern

**Risk:** When AI services (Docling, Azure Document Intelligence) are unavailable in v0.5.0+, the app should still function for non-AI workflows. Without circuit breakers, one failing external service can cascade and slow down the entire platform.

**Why QA won't catch it:** Tests run against available services.

**Mitigation:** Design the pattern now using Polly (already part of .NET 9 via `Microsoft.Extensions.Http.Resilience`):

```csharp
builder.Services.AddHttpClient("AiService")
    .AddResilienceHandler("ai-pipeline", builder =>
    {
        builder.AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
        {
            FailureRatio = 0.5,
            SamplingDuration = TimeSpan.FromSeconds(30),
            MinimumThroughput = 5,
            BreakDuration = TimeSpan.FromSeconds(60)
        });
        builder.AddTimeout(TimeSpan.FromSeconds(30));
        builder.AddRetry(new RetryStrategyOptions<HttpResponseMessage>
        {
            MaxRetryAttempts = 2,
            Delay = TimeSpan.FromSeconds(1)
        });
    });
```

When AI is down, return a response indicating manual review is required rather than failing the entire request.

**Priority:** P3 -- v0.5.0

---

## 4. Performance

### 4.1 N+1 Queries in EF Core

**Risk:** EF Core lazy loading (if enabled) or manual loops with navigation property access create N+1 query problems. Example: `ConvertBidToProjectHandler.cs` correctly uses `.Include(b => b.Items)`, but as more handlers are added, someone will forget.

**Why QA won't catch it:** Small test datasets hide N+1. It only shows up with 100+ records.

**Mitigation:**

1. Enable EF Core query warnings in Development:

```csharp
// In AddPitbullCore
options.UseNpgsql(...)
    .ConfigureWarnings(w => w.Throw(
        RelationalEventId.MultipleCollectionIncludeWarning))
    .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
    .EnableDetailedErrors(builder.Environment.IsDevelopment());
```

2. Add `MiniProfiler.EntityFrameworkCore` in development to see query counts per request.

3. Set a Serilog filter to log slow queries:

```json
{
    "Serilog": {
        "MinimumLevel": {
            "Override": {
                "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
            }
        }
    }
}
```

Actually, for catching slow queries, configure the EF Core command timeout and log anything over 200ms:

```csharp
options.UseNpgsql(connectionString, npgsql =>
{
    npgsql.CommandTimeout(30);
});
```

And enable the `LogTo` for queries exceeding a threshold.

**Priority:** P2 -- v0.2.0

---

### 4.2 Missing Database Indexes

**Risk:** The codebase has indexes on `TenantId` (auto-added in `OnModelCreating`) and composite unique indexes on `{TenantId, Number}`. But common query patterns are not indexed:
- `projects.Status` (used in `ListProjectsHandler` filter)
- `bids.Status` (used in `ListBidsHandler` filter)
- `projects.CreatedAt` (used for ordering in list queries)
- Text search columns (Name, ClientName)

**Why QA won't catch it:** Small datasets return instantly. Missing indexes show up at 10K+ rows.

**Mitigation:** Add indexes for common query patterns:

```csharp
// ProjectConfiguration.cs
builder.HasIndex(p => p.Status);
builder.HasIndex(p => p.CreatedAt);
builder.HasIndex(p => new { p.TenantId, p.Status });

// BidConfiguration.cs -- Status index already exists per BEST-PRACTICES.md
builder.HasIndex(b => b.CreatedAt);
builder.HasIndex(b => new { b.TenantId, b.Status });
```

For text search, consider PostgreSQL `pg_trgm` extension with GIN indexes when search volume increases:

```sql
CREATE INDEX idx_projects_name_trgm ON projects USING gin (name gin_trgm_ops);
```

**Priority:** P2 -- v0.2.0

---

### 4.3 Unbounded PageSize

**Risk:** `ListProjectsQuery` accepts `pageSize` from the query string with a default of 25 but no maximum. A request with `?pageSize=1000000` loads every record into memory.

**Why QA won't catch it:** Tests use default pagination.

**Mitigation:** Server-side cap in every list handler:

```csharp
var effectivePageSize = Math.Clamp(request.PageSize, 1, 100);
```

And FluentValidation as mentioned in 2.5.

**Priority:** P1 -- v0.1.0

---

### 4.4 No Response Caching or Compression

**Risk:** Every API request generates a fresh response. For list endpoints that rarely change within a few seconds, this wastes server resources.

**Why QA won't catch it:** Single requests are fast enough.

**Mitigation:**

1. Add response compression:

```csharp
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

app.UseResponseCompression(); // Before other middleware
```

2. Add ETag support for GET endpoints (can be a middleware or per-endpoint).

**Priority:** P3 -- v0.2.0

---

## 5. Observability

### 5.1 No Request Correlation IDs

**Risk:** When a user reports "something broke," there is no way to trace which request failed across logs. The `ExceptionMiddleware` includes `traceId` but this is the ASP.NET trace identifier, not a correlation ID that flows through MediatR handlers, DB queries, and external service calls.

**Why QA won't catch it:** QA sees the error. Production debugging needs the trace.

**Mitigation:** Add Serilog correlation ID enrichment:

```csharp
// Create middleware
public class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string CorrelationHeader = "X-Correlation-Id";
    
    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationHeader].FirstOrDefault()
            ?? Guid.NewGuid().ToString();
        
        context.Response.Headers[CorrelationHeader] = correlationId;
        
        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await next(context);
        }
    }
}

// Register before other middleware
app.UseMiddleware<CorrelationIdMiddleware>();
```

Configure Serilog output template to include it:

```json
{
    "Serilog": {
        "WriteTo": [{
            "Name": "Console",
            "Args": {
                "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}"
            }
        }]
    }
}
```

**Priority:** P0 -- v0.1.0 (listed in RELEASE-PLAN.md quality gates)

---

### 5.2 No Structured Logging Standards

**Risk:** Without structured logging conventions, logs become unsearchable noise. Different handlers will log differently, making pattern analysis impossible.

**Why QA won't catch it:** QA reads error messages, not log aggregations.

**Mitigation:** Define and enforce logging standards:

```csharp
// Standard log properties for every handler
logger.LogInformation(
    "Creating project {ProjectName} for tenant {TenantId}",
    request.Name, tenantContext.TenantId);

// Standard for errors
logger.LogError(ex,
    "Failed to create project {ProjectName} for tenant {TenantId}. Error: {ErrorCode}",
    request.Name, tenantContext.TenantId, "DB_ERROR");
```

Rules:
- Always include `TenantId` in log context
- Always use structured parameters (not string interpolation)
- Use `LogInformation` for business events, `LogWarning` for degraded paths, `LogError` for failures
- Never log sensitive data (passwords, tokens, PII)

Add a Roslyn analyzer or code review checklist item for string interpolation in log calls:

```
// BAD
logger.LogInformation($"Created project {name}");

// GOOD
logger.LogInformation("Created project {ProjectName}", name);
```

**Priority:** P1 -- v0.1.0

---

### 5.3 Error Tracking Service

**Risk:** Console logs on Railway are ephemeral. Once the buffer fills, old logs are gone. Without a persistent error tracking service, you will not know about recurring errors until users complain.

**Why QA won't catch it:** QA runs in a controlled environment with visible output.

**Mitigation:** Add Sentry (free tier: 5K errors/month, sufficient for alpha/beta):

```bash
dotnet add src/Pitbull.Api/Pitbull.Api.csproj package Sentry.AspNetCore
```

```csharp
// In Program.cs
builder.WebHost.UseSentry(options =>
{
    options.Dsn = builder.Configuration["Sentry:Dsn"];
    options.TracesSampleRate = 0.2; // 20% of requests for performance monitoring
    options.Environment = builder.Environment.EnvironmentName;
});
```

For the frontend, add `@sentry/nextjs`.

**Priority:** P2 -- v0.2.0

---

### 5.4 No Alerting

**Risk:** The health check exists but nobody is watching it. If the app goes down at 2 AM, nobody knows until morning.

**Why QA won't catch it:** QA is a point-in-time check.

**Mitigation:** Options for a solo dev + AI team:

1. **UptimeRobot** (free tier: 50 monitors, 5-min intervals) -- ping `/health/ready`
2. **Railway native metrics** -- set spend/resource alerts
3. **Sentry alerts** -- configure alert rules for error spikes
4. **GitHub Actions scheduled workflow** -- run a health check every 15 minutes

Start with UptimeRobot and Sentry alerts. Both are free and take 10 minutes to set up.

**Priority:** P2 -- v0.2.0

---

## 6. Code Quality Gates

### 6.1 CI Pipeline Gaps

**Risk:** The current CI pipeline builds and lints but does not:
- Run security scanning
- Check for vulnerable dependencies
- Enforce code coverage thresholds
- Run architecture tests
- Validate migration safety

**Why QA won't catch it:** QA tests behavior, not code quality.

**Mitigation:** Enhanced CI pipeline:

```yaml
# Add to ci.yml

- name: Check NuGet vulnerabilities
  run: dotnet list package --vulnerable --include-transitive
  continue-on-error: false

- name: Run architecture tests
  run: dotnet test tests/Pitbull.Tests.Architecture --no-build --configuration Release

- name: Check for warnings-as-errors
  run: dotnet build --configuration Release -warnaserror
```

**Priority:** P1 -- v0.1.0

---

### 6.2 Architecture Tests (Module Boundary Enforcement)

**Risk:** In a modular monolith, the value comes from module isolation. Without automated checks, developers (or AI agents) will create cross-module dependencies that turn the modular monolith into a ball of mud. Example: `Pitbull.Bids` already references `Pitbull.Projects.Domain.Project` directly for the bid-to-project conversion.

**Why QA won't catch it:** The app compiles and runs. The architecture violation is invisible to functional tests.

**Mitigation:** Use `NetArchTest` (or `ArchUnitNET`) for architecture tests:

```bash
dotnet add tests/Pitbull.Tests.Architecture/Pitbull.Tests.Architecture.csproj package NetArchTest.Rules
```

```csharp
[Fact]
public void ProjectsModule_ShouldNotDependOn_BidsModule()
{
    var result = Types.InAssembly(typeof(Project).Assembly)
        .ShouldNot()
        .HaveDependencyOn("Pitbull.Bids")
        .GetResult();
    
    result.IsSuccessful.Should().BeTrue();
}

[Fact]
public void Handlers_Should_ReturnResult()
{
    var result = Types.InAssembly(typeof(CreateProjectHandler).Assembly)
        .That().ImplementInterface(typeof(IRequestHandler<,>))
        .Should().HaveNameEndingWith("Handler")
        .GetResult();
    
    result.IsSuccessful.Should().BeTrue();
}

[Fact]
public void Controllers_ShouldAll_HaveAuthorizeAttribute()
{
    var controllers = Types.InAssembly(typeof(ProjectsController).Assembly)
        .That().Inherit(typeof(ControllerBase))
        .And().DoNotHaveName("AuthController")
        .GetTypes();
    
    foreach (var controller in controllers)
    {
        controller.GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Should().NotBeEmpty($"{controller.Name} must have [Authorize]");
    }
}
```

**Priority:** P1 -- v0.1.0

---

### 6.3 Database Migration Safety

**Risk:** A migration that adds a NOT NULL column without a default, drops a column, or renames a table will fail on a database with existing data. The CI runs migrations against an empty test database, so it won't catch this.

**Why QA won't catch it:** The CI test database starts fresh every time.

**Mitigation:**

1. Review all migrations manually before merge (human review required per TEAM-PROTOCOL.md)
2. Add a migration linter. For PostgreSQL, consider `squawk` (open source SQL migration linter):

```yaml
# In CI
- name: Lint migrations
  run: |
    pip install squawk-sql
    find src/Pitbull.Api/Migrations -name "*.cs" -exec grep -l "migrationBuilder" {} \; | \
    while read f; do
      # Extract SQL from migration and lint
      echo "Checking $f"
    done
```

3. Rules for safe migrations:
   - Adding columns: always nullable OR with a default value
   - Adding indexes: use `CREATE INDEX CONCURRENTLY` (via `migrationBuilder.Sql`)
   - Dropping columns: two-step process (make nullable first, drop in next release)
   - Never rename tables or columns in production

**Priority:** P2 -- v0.2.0

---

### 6.4 Dependabot Configuration

**Risk:** Dependencies go stale. Known CVEs in old packages are easy targets.

**Why QA won't catch it:** Functional tests pass regardless of dependency age.

**Mitigation:** Add `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "nuget"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    labels: ["dependencies", "automated"]
    
  - package-ecosystem: "npm"
    directory: "/src/Pitbull.Web/pitbull-web"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    labels: ["dependencies", "automated"]
    
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

**Priority:** P1 -- v0.1.0

---

## 7. Construction-Specific Risks

### 7.1 Audit Trail Requirements

**Risk:** Construction disputes end up in court. Contracts, change orders, billing records, and RFIs are legal documents. If Pitbull cannot prove who changed what and when, the platform is a liability rather than an asset.

The current `BaseEntity` has `CreatedBy`/`UpdatedBy`/`DeletedBy` fields but they are NOT populated (Known Issue #2 from BEST-PRACTICES.md). There is no audit log that captures what the old values were.

**Why QA won't catch it:** CRUD tests verify current state, not history.

**Mitigation:**

Phase 1 (v0.1.0): Populate `CreatedBy`/`UpdatedBy`/`DeletedBy` from the JWT `sub` claim:

```csharp
// In PitbullDbContext.SaveChangesAsync
public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
{
    var userId = _httpContextAccessor?.HttpContext?.User?
        .FindFirstValue(ClaimTypes.NameIdentifier) ?? "system";
    
    foreach (var entry in ChangeTracker.Entries<BaseEntity>())
    {
        switch (entry.State)
        {
            case EntityState.Added:
                entry.Entity.TenantId = tenantContext.TenantId;
                entry.Entity.CreatedAt = DateTime.UtcNow;
                entry.Entity.CreatedBy = userId;
                break;
            case EntityState.Modified:
                entry.Entity.UpdatedAt = DateTime.UtcNow;
                entry.Entity.UpdatedBy = userId;
                break;
        }
    }
    // ...
}
```

Phase 2 (v0.5.0): Full audit log table capturing old/new values:

```csharp
public class AuditLog
{
    public long Id { get; set; }
    public Guid TenantId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string Action { get; set; } = string.Empty; // Created, Updated, Deleted
    public string UserId { get; set; } = string.Empty;
    public string? OldValues { get; set; } // JSON
    public string? NewValues { get; set; } // JSON
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
}
```

Write audit entries in `SaveChangesAsync` by inspecting `ChangeTracker.Entries()` for modified properties.

**Priority:** Phase 1: P0 (v0.1.0), Phase 2: P1 (v0.5.0)

---

### 7.2 Data Retention

**Risk:** Construction contracts, change orders, pay applications, and project documentation may need to be retained for 6-10+ years depending on jurisdiction (statute of limitations for construction defect claims ranges from 4-12 years). Soft deletes are a start, but hard deletes and database purges could destroy legally required records.

**Why QA won't catch it:** Tests create and delete freely. Retention is a policy, not a feature test.

**Mitigation:**

1. Never hard-delete financial or contractual data. Soft delete only.
2. Add a `RetentionPolicy` enum to entities that carry legal significance:

```csharp
public enum RetentionPolicy
{
    Standard,           // Can be purged after tenant-defined period
    LegalHold,          // Cannot be deleted, even by admin
    RegulatoryRetention // Must be retained for X years per jurisdiction
}
```

3. Any purge/cleanup jobs must check retention policy before deletion.
4. Document the retention policy in user-facing terms of service (v1.0).

**Priority:** P2 -- design in v0.2.0, enforce in v0.5.0

---

### 7.3 Document OCR Accuracy

**Risk:** When the AI OCR pipeline launches (v0.5.0), misreading a spec requirement could cause real construction defects. Example: OCR reads "3500 PSI" as "8500 PSI" for a concrete spec, contractor pours wrong mix.

**Why QA won't catch it:** Testing with clean PDFs works. Real construction documents are scanned, smudged, handwritten, and photographed at angles on job sites.

**Mitigation:**

1. Always display confidence scores alongside AI-extracted values
2. Flag any extraction below 90% confidence for human review
3. Never auto-approve AI outputs for spec-critical fields (PSI, temperature, dimensions)
4. Provide a side-by-side view: original document + extracted data
5. Log all AI extractions with the source document hash for audit trail
6. Allow users to correct AI output, and use corrections to improve the pipeline

**Priority:** P3 -- implement with Documents module in v0.5.0

---

### 7.4 AI Confidence and Human Override

**Risk:** AI features (bid leveling, submittal review, contract ops) will make recommendations. If users blindly trust AI and the AI is wrong, Pitbull gets blamed. If users cannot override AI, the tool is useless for edge cases.

**Why QA won't catch it:** AI accuracy is a probabilistic concern, not a pass/fail test.

**Mitigation:** Design the AI interaction pattern now:

```
Every AI output MUST include:
1. Confidence score (0-100%)
2. Source references (which document, which page, which clause)
3. An "Override" button that lets the user correct the AI
4. A "Flag for Review" button that escalates to a senior user
5. An audit entry recording AI suggestion + human decision
```

Thresholds:
- > 95% confidence: show as recommendation
- 70-95% confidence: show with "Review Suggested" badge
- < 70% confidence: show with "Low Confidence - Manual Review Required" warning

**Priority:** P3 -- design in v0.2.0, implement with AI features

---

### 7.5 Offline Access

**Risk:** Construction job sites frequently have poor or no internet connectivity. If the platform requires constant connectivity, field staff cannot use it where they need it most.

**Why QA won't catch it:** QA runs on stable internet.

**Mitigation:** This is a v2.0+ feature per RELEASE-PLAN.md, but design decisions made now affect feasibility:

1. Keep API responses self-contained (no lazy-loaded references that require additional calls)
2. Use optimistic concurrency (section 1.2) which is required for offline sync
3. Consider Service Worker / PWA support in the Next.js app for basic offline read access
4. Design the data model to support conflict resolution (last-write-wins with audit trail)

**Priority:** P4 -- v2.0+ but architectural decisions in v0.2.0

---

## 8. Implementation Priority

### v0.1.0 (Must-Have for Alpha Tag)

| # | Issue | Risk Level | Effort |
|---|-------|-----------|--------|
| 1 | ~~Fix SQL interpolation in TenantMiddleware (1.1)~~ | ~~P0~~ | ✅ Done |
| 2 | Add tenant query filter for defense-in-depth (1.4) | P0 | 2 hours |
| 3 | ~~JWT secret validation on startup (2.2)~~ | ~~P0~~ | ✅ Done |
| 4 | ~~Rate limiting on auth endpoints (2.3)~~ | ~~P0~~ | ✅ Done |
| 5 | ~~Deep health checks with DB connectivity (3.1)~~ | ~~P0~~ | ✅ Done |
| 6 | ~~Correlation ID middleware (5.1)~~ | ~~P0~~ | ✅ Done |
| 7 | Populate CreatedBy/UpdatedBy audit fields (7.1) | P0 | 1 hour |
| 8 | Optimistic concurrency via xmin (1.2) | P1 | 2 hours |
| 9 | ~~Mass assignment architecture test (2.1)~~ | ~~P1~~ | ✅ Done |
| 10 | ~~Cap pageSize server-side (4.3)~~ | ~~P1~~ | ✅ Done |
| 11 | ~~Dependabot configuration (6.4)~~ | ~~P1~~ | ✅ Done |
| 12 | ~~Architecture tests project (6.2)~~ | ~~P1~~ | ✅ Done |
| 13 | ~~CORS environment validation (2.4)~~ | ~~P1~~ | ✅ Done |

### v0.2.0 (Must-Have for Beta Demo)

| # | Issue | Risk Level | Effort |
|---|-------|-----------|--------|
| 14 | N+1 query detection in dev (4.1) | P2 | 1 hour |
| 15 | Missing database indexes (4.2) | P2 | 1 hour |
| 16 | Sentry error tracking (5.3) | P2 | 2 hours |
| 17 | Alerting with UptimeRobot (5.4) | P2 | 30 min |
| 18 | Migration safety checks (6.3) | P2 | 2 hours |
| 19 | Multi-SaveChanges transaction rule (1.5) | P2 | 1 hour |
| 20 | DB connection pool configuration (3.2) | P2 | 30 min |

### v0.5.0 (Must-Have for Pilot)

| # | Issue | Risk Level | Effort |
|---|-------|-----------|--------|
| 21 | Full audit log table (7.1 Phase 2) | P1 | 4 hours |
| 22 | Soft delete cascade service (1.3) | P1 | 3 hours |
| 23 | File upload security (2.7) | P2 | 4 hours |
| 24 | Circuit breaker for AI services (3.4) | P3 | 2 hours |
| 25 | OCR confidence scoring (7.3) | P3 | Ongoing |
| 26 | Data retention policies (7.2) | P2 | 2 hours |

---

## Appendix: Quick Wins Checklist

Things you can fix in under 30 minutes each:

- [x] Change `ExecuteSqlRawAsync` to `ExecuteSqlInterpolatedAsync` in TenantMiddleware ✅ (Feb 2026)
- [x] Add `Math.Clamp(pageSize, 1, 100)` to all list handlers ✅ (PaginationQuery caps at 100)
- [x] Add JWT key validation on startup ✅ (EnvironmentValidator.cs)
- [x] Add `.github/dependabot.yml` ✅ (configured)
- [x] Add CORS environment check ✅ (EnvironmentValidator.cs)
- [x] Cap search string length in validators ✅ (query validation PR #105)
- [x] Add `[Authorize]` architecture test ✅ (ArchitectureTests.cs)
- [ ] Remove auto-migrate from production startup path (deferred - acceptable for alpha)
