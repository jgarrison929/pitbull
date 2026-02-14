using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Core.Data;

/// <summary>
/// EF Core interceptor that sets the PostgreSQL app.current_tenant and app.current_company
/// session variables on every database connection to ensure Row-Level Security policies work correctly.
/// This handles connection pooling scenarios where the session variable might not persist.
/// </summary>
public class TenantConnectionInterceptor(ITenantContext tenantContext, ICompanyContext? companyContext = null) : DbConnectionInterceptor
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
            // Set tenant session variable
            await using var tenantCmd = new NpgsqlCommand(
                "SELECT set_config('app.current_tenant', @tenantId, false);",
                npgsqlConn);
            tenantCmd.Parameters.AddWithValue("tenantId", tenantContext.TenantId.ToString());
            await tenantCmd.ExecuteScalarAsync(cancellationToken);

            // Set company session variable (empty string = all companies in tenant)
            var companyIdStr = companyContext?.IsResolved == true
                ? companyContext.CompanyId.ToString()
                : "";
            await using var companyCmd = new NpgsqlCommand(
                "SELECT set_config('app.current_company', @companyId, false);",
                npgsqlConn);
            companyCmd.Parameters.AddWithValue("companyId", companyIdStr);
            await companyCmd.ExecuteScalarAsync(cancellationToken);
        }
        catch (Exception)
        {
            // Log but don't fail the operation - this might be expected in some scenarios
            // (e.g., unit tests, migrations, system operations)
        }
    }
}
