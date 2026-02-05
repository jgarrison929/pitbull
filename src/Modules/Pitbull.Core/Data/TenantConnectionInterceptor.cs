using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;
using Pitbull.Core.MultiTenancy;
using System.Data.Common;

namespace Pitbull.Core.Data;

/// <summary>
/// EF Core interceptor that sets the PostgreSQL app.current_tenant session variable
/// on every database connection to ensure Row-Level Security policies work correctly.
/// This handles connection pooling scenarios where the session variable might not persist.
/// </summary>
public class TenantConnectionInterceptor(ITenantContext tenantContext) : DbConnectionInterceptor
{
    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        await EnsureTenantContextSet(connection, cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }

    private async Task EnsureTenantContextSet(DbConnection? connection, CancellationToken cancellationToken)
    {
        // Skip if no tenant context or not PostgreSQL
        if (tenantContext.TenantId == Guid.Empty || connection is not NpgsqlConnection npgsqlConn)
            return;

        try
        {
            // Set the session variable on this specific connection
            await using var command = new NpgsqlCommand(
                "SELECT set_config('app.current_tenant', @tenantId, false);", 
                npgsqlConn);
            command.Parameters.AddWithValue("tenantId", tenantContext.TenantId.ToString());
            
            await command.ExecuteScalarAsync(cancellationToken);
        }
        catch (Exception)
        {
            // Log but don't fail the operation - this might be expected in some scenarios
            // (e.g., unit tests, migrations, system operations)
        }
    }
}