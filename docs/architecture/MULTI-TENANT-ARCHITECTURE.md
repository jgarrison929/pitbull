# Multi-Tenant Architecture

## Overview

Pitbull Construction Solutions implements a **shared-database, schema-isolated** multi-tenancy model using PostgreSQL Row-Level Security (RLS). This approach provides:

- **Strong isolation**: Tenants cannot access each other's data even if application bugs exist
- **Efficient resource usage**: Single database instance, lower infrastructure costs
- **Simplified operations**: Single deployment, unified migrations, centralized monitoring
- **Compliance-ready**: Data segregation enforced at the database level

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         Request                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      ASP.NET Core Pipeline                       │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ JWT Auth    │→ │ TenantMiddleware │→ │ Rate Limiting     │  │
│  │ (tenant_id  │  │ (resolve tenant, │  │ (per-tenant limits│  │
│  │  claim)     │  │  set DB context) │  │  supported)       │  │
│  └─────────────┘  └──────────────────┘  └───────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      Application Layer                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ TenantContext (Scoped)                                   │   │
│  │ - TenantId: Guid                                         │   │
│  │ - TenantName: string                                     │   │
│  │ - Injected into handlers/services                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BaseEntity                                               │   │
│  │ - TenantId (auto-set on creation)                        │   │
│  │ - CreatedBy, ModifiedBy (user audit)                     │   │
│  │ - CreatedAt, ModifiedAt (timestamps)                     │   │
│  │ - IsDeleted (soft delete)                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      Data Layer                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ PitbullDbContext (EF Core)                               │   │
│  │ - TenantConnectionInterceptor                            │   │
│  │ - Automatic TenantId population on SaveChanges           │   │
│  │ - Global query filters for soft delete                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ TenantConnectionInterceptor                              │   │
│  │ - Intercepts ConnectionOpened event                      │   │
│  │ - Sets app.current_tenant session variable               │   │
│  │ - Works with connection pooling                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      PostgreSQL                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Row-Level Security Policies                              │   │
│  │ - CREATE POLICY tenant_isolation ON projects             │   │
│  │     USING (tenant_id::text = current_setting(           │   │
│  │            'app.current_tenant'))                        │   │
│  │ - Applied to all tenant-scoped tables                    │   │
│  │ - Enforced on SELECT, INSERT, UPDATE, DELETE             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Tenant Resolution Flow

### 1. JWT Claims (Primary)

When users authenticate, their JWT includes a `tenant_id` claim:

```json
{
  "sub": "user-uuid",
  "email": "user@company.com",
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "roles": ["Manager", "TimeApprover"]
}
```

### 2. Request Header (API Integrations)

External systems can pass `X-Tenant-Id` header:

```http
GET /api/projects
Authorization: Bearer <jwt>
X-Tenant-Id: 00000000-0000-0000-0000-000000000001
```

### 3. Subdomain (Future)

Planned support for `acme.pitbullconstructionsolutions.com` resolution.

## PostgreSQL RLS Implementation

### Session Variable

Every database connection sets the tenant context:

```sql
SELECT set_config('app.current_tenant', '00000000-0000-0000-0000-000000000001', false);
```

- `false` = persist for the connection lifetime (not just transaction)
- Required for connection pooling scenarios

### RLS Policies

Each tenant-scoped table has an RLS policy:

```sql
-- Enable RLS on the table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

-- Force RLS even for table owners (security)
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
```

### Query Behavior

```sql
-- Application query (no tenant filter needed!)
SELECT * FROM projects WHERE status = 'active';

-- PostgreSQL automatically applies:
SELECT * FROM projects 
WHERE status = 'active' 
  AND tenant_id::text = current_setting('app.current_tenant');
```

## EF Core Integration

### TenantConnectionInterceptor

Ensures session variable is set on every connection, including pooled connections:

```csharp
public class TenantConnectionInterceptor(ITenantContext tenantContext) 
    : DbConnectionInterceptor
{
    public override async Task ConnectionOpenedAsync(
        DbConnection connection, 
        ConnectionEndEventData eventData, 
        CancellationToken ct = default)
    {
        if (tenantContext.TenantId != Guid.Empty 
            && connection is NpgsqlConnection npgsql)
        {
            await using var cmd = new NpgsqlCommand(
                "SELECT set_config('app.current_tenant', @tenantId, false);", 
                npgsql);
            cmd.Parameters.AddWithValue("tenantId", tenantContext.TenantId.ToString());
            await cmd.ExecuteScalarAsync(ct);
        }
    }
}
```

### Automatic TenantId Population

`PitbullDbContext.SaveChangesAsync` automatically sets `TenantId` on new entities:

```csharp
public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
{
    foreach (var entry in ChangeTracker.Entries<BaseEntity>())
    {
        if (entry.State == EntityState.Added)
        {
            entry.Entity.TenantId = _tenantContext.TenantId;
            entry.Entity.CreatedAt = DateTime.UtcNow;
            entry.Entity.CreatedBy = _currentUser?.Id;
        }
        // ... modified tracking
    }
    return await base.SaveChangesAsync(ct);
}
```

## Tables Without Tenant Isolation

Some tables are intentionally tenant-agnostic:

| Table | Reason |
|-------|--------|
| `tenants` | Tenant registry itself |
| `asp_net_users` | Identity shared across tenants (email uniqueness) |
| `asp_net_roles` | System-defined roles |
| `cost_codes` | Tenant-scoped, but seeded as system defaults |

## Security Considerations

### Defense in Depth

1. **Application layer**: TenantMiddleware validates and sets context
2. **ORM layer**: EF Core interceptor ensures DB session variable
3. **Database layer**: RLS policies enforce isolation regardless of query

### Protection Against

- **Direct SQL injection**: RLS applies even to raw SQL
- **Application bugs**: Forgetting WHERE clause still returns only tenant data
- **Privilege escalation**: Users cannot query other tenants even with valid JWT

### Audit Trail

All tenant-scoped entities track:
- `CreatedBy` / `ModifiedBy` (user IDs)
- `CreatedAt` / `ModifiedAt` (timestamps)
- `IsDeleted` (soft delete for compliance)

## Testing Strategy

### Integration Tests

Tests use a dedicated test tenant with known ID:

```csharp
public class IntegrationTestBase
{
    protected static readonly Guid TestTenantId = 
        Guid.Parse("11111111-1111-1111-1111-111111111111");
    
    // TenantContext is set before each test
}
```

### RLS Verification Tests

Explicit tests verify cross-tenant isolation:

```csharp
[Fact]
public async Task CannotAccessOtherTenantData()
{
    // Create project in Tenant A
    var projectId = await CreateProject(tenantA);
    
    // Switch to Tenant B context
    SetTenantContext(tenantB);
    
    // Should return 404, not the project
    var result = await GetProject(projectId);
    Assert.Equal(HttpStatusCode.NotFound, result.StatusCode);
}
```

## Performance Considerations

### Connection Pooling

- Npgsql pools connections, but session variables are reset per-connection
- `TenantConnectionInterceptor` runs on `ConnectionOpened`, not per-query
- Minimal overhead (~1ms per connection acquire)

### Index Strategy

All tenant-scoped queries benefit from composite indexes:

```sql
CREATE INDEX ix_projects_tenant_status ON projects(tenant_id, status);
CREATE INDEX ix_time_entries_tenant_date ON time_entries(tenant_id, date);
```

### Query Plan Verification

RLS conditions appear in EXPLAIN plans:

```sql
EXPLAIN ANALYZE SELECT * FROM projects WHERE status = 'active';
-- Filter: ((tenant_id)::text = current_setting('app.current_tenant')) AND (status = 'active')
```

## Migration Path

### Adding a New Tenant-Scoped Table

1. Create entity inheriting `BaseEntity`
2. Add to `PitbullDbContext.OnModelCreating`
3. Migration adds RLS policy automatically via convention

### Converting Existing Table to Multi-Tenant

1. Add `tenant_id` column (nullable initially)
2. Backfill existing data with default tenant
3. Make column non-nullable
4. Enable RLS policy
5. Add index on `(tenant_id, ...)`

## Future Enhancements

- **Per-tenant connection strings**: Support dedicated databases for enterprise tenants
- **Tenant-specific feature flags**: Enable/disable modules per tenant
- **Usage metering**: Track API calls per tenant for billing
- **Cross-tenant reporting**: Admin-only aggregation with explicit bypass

---

*Last updated: 2026-02-11*
