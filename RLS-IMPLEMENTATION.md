# Row-Level Security (RLS) Implementation

## Overview

This implementation adds PostgreSQL Row-Level Security policies to enforce database-level multi-tenancy for the Pitbull Construction Solutions platform.

## What Was Implemented

### 1. RLS Migration (`20260202085534_ImplementRLSPolicies.cs`)

Created RLS policies for all tenant-scoped tables:
- `projects`
- `bids`
- `project_phases`
- `project_budgets`
- `project_projections`
- `bid_items`

For each table, the migration:
1. Enables Row-Level Security
2. Creates SELECT policy using `app.current_tenant` session variable
3. Creates INSERT policy with tenant validation
4. Creates UPDATE policy with tenant validation
5. Creates DELETE policy with tenant validation

### 2. Session Variable Integration

The `TenantMiddleware` already exists and sets the PostgreSQL session variable:

```sql
SET app.current_tenant = '{tenantId}'
```

This variable is used by all RLS policies to filter data by tenant.

### 3. Policy Structure

Each table has four policies:

```sql
-- SELECT: Users can only read their tenant's data
CREATE POLICY {table}_tenant_isolation_select ON {table} 
FOR SELECT 
USING ("TenantId"::text = current_setting('app.current_tenant', true));

-- INSERT: Users can only insert data for their tenant
CREATE POLICY {table}_tenant_isolation_insert ON {table} 
FOR INSERT 
WITH CHECK ("TenantId"::text = current_setting('app.current_tenant', true));

-- UPDATE: Users can only update their tenant's data
CREATE POLICY {table}_tenant_isolation_update ON {table} 
FOR UPDATE 
USING ("TenantId"::text = current_setting('app.current_tenant', true))
WITH CHECK ("TenantId"::text = current_setting('app.current_tenant', true));

-- DELETE: Users can only delete their tenant's data
CREATE POLICY {table}_tenant_isolation_delete ON {table} 
FOR DELETE 
USING ("TenantId"::text = current_setting('app.current_tenant', true));
```

## Security Benefits

1. **Defense in Depth**: Even if application-level filtering fails, the database enforces isolation
2. **Complete Isolation**: No tenant can access another tenant's data at the database level
3. **Automatic Enforcement**: No developer action required - all queries automatically filtered
4. **Attack Prevention**: SQL injection or application bugs cannot bypass tenant isolation

## Testing

### Manual Testing with `test-rls.sql`

Run the provided test script to verify:
1. Without tenant context, no rows are returned (for non-superusers)
2. With Tenant A context, only Tenant A data is visible
3. With Tenant B context, only Tenant B data is visible
4. Cross-tenant inserts fail with policy violation
5. Resetting context hides all data again

### Application Testing

1. Create multiple tenants via the API
2. Create projects/bids for each tenant
3. Login as different tenant users
4. Verify each user only sees their tenant's data
5. Verify API operations (CRUD) work correctly with RLS

## Migration Deployment

The migration will automatically run when the application starts on Railway, thanks to:

```csharp
// Auto-migrate database on startup (Program.cs)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
    await db.Database.MigrateAsync();
}
```

## Rollback

If issues occur, the migration can be rolled back:

```bash
dotnet ef migrations remove
```

The Down() method:
1. Drops all RLS policies
2. Disables RLS on all tables
3. Restores previous behavior

## Performance Considerations

1. **Minimal Impact**: RLS policies use indexes on `TenantId` (already exist)
2. **Query Plan**: PostgreSQL optimizer handles policy checks efficiently
3. **Session Variable**: `current_setting()` is fast and cached per session

## Troubleshooting

### Common Issues

1. **No data visible**: Ensure `app.current_tenant` is set
2. **Insert failures**: Verify `TenantId` matches session variable
3. **Superuser bypass**: Database superusers bypass RLS (by design)

### Debug Commands

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('projects', 'bids');

-- View current tenant setting
SELECT current_setting('app.current_tenant', true);

-- List RLS policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('projects', 'bids');
```

## Next Steps

1. **Monitor Performance**: Watch query performance after deployment
2. **Add Metrics**: Track tenant isolation effectiveness
3. **Extend Policies**: Add RLS to other tenant-scoped tables as they're created
4. **User Tables**: Consider RLS for user/role tables if needed

This implementation provides enterprise-grade multi-tenant security at the database level, ensuring complete data isolation between tenants.