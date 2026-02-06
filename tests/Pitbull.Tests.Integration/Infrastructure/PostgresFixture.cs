using Npgsql;
using Respawn;
using Testcontainers.PostgreSql;

namespace Pitbull.Tests.Integration.Infrastructure;

/// <summary>
/// Shared PostgreSQL container + database reset for integration tests.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container;
    private Respawner? _respawner;

    public PostgresFixture()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:17-alpine")
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
    }

    public async Task DisposeAsync() => await _container.DisposeAsync();

    public async Task ResetAsync()
    {
        await using var conn = new NpgsqlConnection(AppConnectionString);
        await conn.OpenAsync();

        await conn.ExecuteNonQueryAsync("RESET app.current_tenant;");

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
