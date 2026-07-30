using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Pitbull.Api.Controllers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Integration.Infrastructure;

public abstract class ApiIntegrationTestBase(PostgresFixture db) : IAsyncLifetime
{
    protected readonly PostgresFixture Db = db;
    protected PitbullApiFactory Factory { get; private set; } = null!;

    public virtual async Task InitializeAsync()
    {
        Factory = new PitbullApiFactory(Db.AppConnectionString);

        using var client = Factory.CreateClient();
        var resp = await client.GetAsync("/health/live");
        resp.EnsureSuccessStatusCode();

        await EnsurePmEnumColumnsUseTextAsync();
    }

    public virtual Task DisposeAsync()
    {
        Factory.Dispose();
        return Task.CompletedTask;
    }

    protected Task<(HttpClient Client, AuthResponse Auth, Guid TenantId)> CreateAuthenticatedClientAsync()
        => Factory.CreateAuthenticatedClientAsync();

    /// <summary>
    /// Seeds a user into an existing tenant via UserManager and returns a logged-in client.
    /// Open register cannot join by TenantId (security: invitation-only).
    /// </summary>
    protected async Task<HttpClient> CreateUserClientInTenantAsync(Guid tenantId, string? email = null)
    {
        email ??= $"tenant-user-{Guid.NewGuid():N}@example.com";
        const string password = "SecurePass123!";

        Guid companyId;
        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
            var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
            tenantContext.TenantId = tenantId;
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT set_config('app.current_tenant', {tenantId.ToString()}, false)");

            var company = await dbContext.Set<Company>()
                .IgnoreQueryFilters()
                .Where(c => c.TenantId == tenantId && !c.IsDeleted)
                .OrderByDescending(c => c.IsDefault)
                .FirstOrDefaultAsync();
            if (company is null)
                Assert.Fail($"No company found for tenant {tenantId}");
            companyId = company.Id;

            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var user = new AppUser
            {
                UserName = email,
                Email = email,
                FirstName = "Tenant",
                LastName = "User",
                TenantId = tenantId,
                Status = UserStatus.Active,
                EmailConfirmed = true
            };
            var create = await userManager.CreateAsync(user, password);
            if (!create.Succeeded)
                Assert.Fail("Failed to seed user: " + string.Join(", ", create.Errors.Select(e => e.Description)));

            dbContext.Set<UserCompanyAccess>().Add(new UserCompanyAccess
            {
                TenantId = tenantId,
                UserId = user.Id,
                CompanyId = companyId,
                IsDefault = true,
                CreatedAt = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }

        var client = Factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        if (!login.IsSuccessStatusCode)
        {
            var body = await login.Content.ReadAsStringAsync();
            Assert.Fail($"Login after seed failed: {(int)login.StatusCode} {body}");
        }

        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(TestJsonOptions.Default);
        Assert.NotNull(auth);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        client.DefaultRequestHeaders.Remove("X-Tenant-Id");
        client.DefaultRequestHeaders.Add("X-Tenant-Id", tenantId.ToString());
        return client;
    }

    protected async Task<Guid> CreateProjectAsync(HttpClient client, string nameSuffix)
    {
        var createResp = await client.PostAsJsonAsync("/api/projects", new
        {
            name = $"PM Int Test {nameSuffix}",
            number = $"PRJ-{Guid.NewGuid():N}"[..16],
            type = 0,
            contractAmount = 100000m
        });

        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created from /api/projects but got {(int)createResp.StatusCode}. Body: {body}");
        }

        return await ReadIdAsync(createResp);
    }

    protected static async Task<Guid> ReadIdAsync(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var id = Guid.Empty;
        if (!doc.RootElement.TryGetProperty("id", out var idElement) || !idElement.TryGetGuid(out id))
            Assert.Fail("Response JSON did not contain a valid id property.");
        return id;
    }

    protected static async Task<string> ReadBodyAsync(HttpResponseMessage response)
        => await response.Content.ReadAsStringAsync();

    protected static Guid ExtractTenantIdFromToken(string token)
    {
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        var tenantClaim = jwt.Claims.FirstOrDefault(c => c.Type == "tenant_id")?.Value;
        if (!Guid.TryParse(tenantClaim, out var tenantId))
            throw new InvalidOperationException("JWT token did not contain a valid tenant_id claim.");
        return tenantId;
    }

    protected async Task<Guid> GetFirstCostCodeIdAsync(HttpClient client)
    {
        var resp = await client.GetAsync("/api/cost-codes?page=1&pageSize=1");
        resp.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        if (!doc.RootElement.TryGetProperty("items", out var items)
            || items.ValueKind != JsonValueKind.Array
            || items.GetArrayLength() == 0)
        {
            Assert.Fail("Expected at least one seeded cost code but none were returned.");
        }

        var first = items[0];
        var id = Guid.Empty;
        if (!first.TryGetProperty("id", out var idElement) || !idElement.TryGetGuid(out id))
            Assert.Fail("Cost code payload did not contain a valid id.");
        return id;
    }

    protected async Task<Guid> CreateCostCodeAsync(Guid tenantId, Guid userId, string codeSuffix)
    {
        var id = Guid.NewGuid();
        var sql = """
INSERT INTO "CostCodes"
("Id", "TenantId", "CreatedAt", "CreatedBy", "IsDeleted", "Code", "Description", "CostType", "IsActive", "IsCompanyStandard")
VALUES
(@id, @tenant_id, @created_at, @created_by, false, @code, @description, @cost_type, true, true);
""";

        await using var conn = new NpgsqlConnection(Db.AdminConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("tenant_id", tenantId);
        cmd.Parameters.AddWithValue("created_at", DateTime.UtcNow);
        cmd.Parameters.AddWithValue("created_by", userId.ToString());
        cmd.Parameters.AddWithValue("code", $"CC-{codeSuffix[..Math.Min(codeSuffix.Length, 8)]}-{Guid.NewGuid():N}"[..20]);
        cmd.Parameters.AddWithValue("description", "Integration test cost code");
        cmd.Parameters.AddWithValue("cost_type", 1); // Labor
        await cmd.ExecuteNonQueryAsync();

        return id;
    }

    private async Task EnsurePmEnumColumnsUseTextAsync()
    {
        const string sql = """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_schedules' AND column_name = 'CalendarType' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_schedules ALTER COLUMN "Status" TYPE text USING "Status"::text;
        ALTER TABLE pm_schedules ALTER COLUMN "CalendarType" TYPE text USING "CalendarType"::text;
        ALTER TABLE pm_schedules ALTER COLUMN "ImportedFrom" TYPE text USING "ImportedFrom"::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_schedule_activities' AND column_name = 'ActivityType' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_schedule_activities ALTER COLUMN "ActivityType" TYPE text USING "ActivityType"::text;
        ALTER TABLE pm_schedule_activities ALTER COLUMN "Status" TYPE text USING "Status"::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_schedule_dependencies' AND column_name = 'DependencyType' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_schedule_dependencies ALTER COLUMN "DependencyType" TYPE text USING "DependencyType"::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_job_cost_commitments' AND column_name = 'CommitmentType' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_job_cost_commitments ALTER COLUMN "CommitmentType" TYPE text USING "CommitmentType"::text;
        ALTER TABLE pm_job_cost_commitments ALTER COLUMN "Status" TYPE text USING "Status"::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_job_cost_forecasts' AND column_name = 'ForecastConfidence' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_job_cost_forecasts ALTER COLUMN "ForecastConfidence" TYPE text USING "ForecastConfidence"::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_submittals' AND column_name = 'SubmittalType' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_submittals ALTER COLUMN "SubmittalType" TYPE text USING "SubmittalType"::text;
        ALTER TABLE pm_submittals ALTER COLUMN "Status" TYPE text USING "Status"::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_submittal_workflow_events' AND column_name = 'EventType' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_submittal_workflow_events ALTER COLUMN "EventType" TYPE text USING "EventType"::text;
        ALTER TABLE pm_submittal_workflow_events ALTER COLUMN "FromStatus" TYPE text USING "FromStatus"::text;
        ALTER TABLE pm_submittal_workflow_events ALTER COLUMN "ToStatus" TYPE text USING "ToStatus"::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_daily_reports' AND column_name = 'ReportType' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_daily_reports ALTER COLUMN "ReportType" TYPE text USING "ReportType"::text;
        ALTER TABLE pm_daily_reports ALTER COLUMN "Status" TYPE text USING "Status"::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pm_tasks' AND column_name = 'TaskType' AND data_type <> 'text'
    ) THEN
        ALTER TABLE pm_tasks ALTER COLUMN "TaskType" TYPE text USING "TaskType"::text;
        ALTER TABLE pm_tasks ALTER COLUMN "Priority" TYPE text USING "Priority"::text;
        ALTER TABLE pm_tasks ALTER COLUMN "Status" TYPE text USING "Status"::text;
        ALTER TABLE pm_tasks ALTER COLUMN "ReferenceType" TYPE text USING "ReferenceType"::text;
    END IF;
END
$$;
""";

        await using var conn = new NpgsqlConnection(Db.AdminConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }
}
