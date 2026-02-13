using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.PostgreSql;

namespace Pitbull.Tests.Integration;

public sealed class PitbullTestContainersFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("pitbull_tests")
        .WithUsername("pitbull")
        .WithPassword("pitbull")
        .Build();

    public string ConnectionString => _dbContainer.GetConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            // Ensure the API uses the containerized PostgreSQL instead of local dev settings.
            var overrides = new Dictionary<string, string?>
            {
                ["ConnectionStrings:PitbullDb"] = ConnectionString,
                // Keep JWT deterministic for tests (still uses real signing).
                ["Jwt:Key"] = "TEST-ONLY-CHANGE-ME-minimum-32-characters-long"
            };

            config.AddInMemoryCollection(overrides);
        });
    }

    public async Task InitializeAsync() => await _dbContainer.StartAsync();

    public new async Task DisposeAsync()
    {
        await _dbContainer.DisposeAsync();
        await base.DisposeAsync();
    }
}
