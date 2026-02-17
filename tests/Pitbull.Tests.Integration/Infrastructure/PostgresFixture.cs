using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Respawn;
using Testcontainers.PostgreSql;

namespace Pitbull.Tests.Integration.Infrastructure;

/// <summary>
/// Shared PostgreSQL container + database reset for integration tests.
/// Migrations are applied once during fixture initialization to avoid
/// race conditions when multiple test hosts start concurrently.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container;
    private Respawner? _respawner;

    /// <summary>
    /// Indicates migrations have already been applied by the fixture.
    /// Test hosts should skip MigrateAsync when this is true.
    /// </summary>
    public bool MigrationsApplied { get; private set; }

    public PostgresFixture()
    {
        _container = new PostgreSqlBuilder("postgres:17-alpine")
            .WithDatabase("pitbull_test")
            .WithUsername("pitbull")
            .WithPassword("pitbull_test")
            .Build();
    }

    public string AdminConnectionString => _container.GetConnectionString();

    public string AppConnectionString
    {
        get
        {
            var csb = new NpgsqlConnectionStringBuilder(AdminConnectionString)
            {
                Username = "pitbull_app",
                Password = "pitbull_app"
            };

            return csb.ConnectionString;
        }
    }

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        // Create a non-superuser, non-bypassrls role for the app so we can verify tenant isolation via RLS.
        await using var adminConn = new NpgsqlConnection(AdminConnectionString);
        await adminConn.OpenAsync();

        await adminConn.ExecuteNonQueryAsync(@"
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pitbull_app') THEN
        CREATE ROLE pitbull_app LOGIN PASSWORD 'pitbull_app';
    END IF;
END
$$;

ALTER ROLE pitbull_app NOSUPERUSER NOCREATEROLE NOBYPASSRLS;
GRANT ALL PRIVILEGES ON DATABASE pitbull_test TO pitbull_app;
GRANT ALL PRIVILEGES ON SCHEMA public TO pitbull_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pitbull_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pitbull_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO pitbull_app;
");

        // Apply migrations once using admin connection to avoid race conditions
        // when multiple test hosts start concurrently.
        var optionsBuilder = new DbContextOptionsBuilder<Pitbull.Core.Data.PitbullDbContext>();
        optionsBuilder.UseNpgsql(AdminConnectionString);
        var tenantCtx = new Pitbull.Core.MultiTenancy.TenantContext { TenantId = Guid.Empty, TenantName = "fixture" };
        var companyCtx = new Pitbull.Core.MultiTenancy.CompanyContext { CompanyId = Guid.Empty, CompanyCode = "00", CompanyName = "fixture" };
        await using var dbCtx = new Pitbull.Core.Data.PitbullDbContext(optionsBuilder.Options, tenantCtx, companyCtx);
        await dbCtx.Database.MigrateAsync();
        MigrationsApplied = true;
    }

    public async Task DisposeAsync() => await _container.DisposeAsync();

    public async Task ResetAsync()
    {
        await using var conn = new NpgsqlConnection(AppConnectionString);
        await conn.OpenAsync();

        await conn.ExecuteNonQueryAsync("RESET app.current_tenant;");
        await conn.ExecuteNonQueryAsync("RESET app.current_company;");

        _respawner ??= await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = ["__EFMigrationsHistory"],
        });

        await _respawner.ResetAsync(conn);
    }
}

internal static class NpgsqlConnectionExtensions
{
    public static async Task ExecuteNonQueryAsync(this NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }
}
