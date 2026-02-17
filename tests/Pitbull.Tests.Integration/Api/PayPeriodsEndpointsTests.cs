using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateEmployee;
using Pitbull.TimeTracking.Services;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class PayPeriodsEndpointsTests(PostgresFixture db) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private PitbullApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new PitbullApiFactory(db.AppConnectionString);

        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health/live");
        resp.EnsureSuccessStatusCode();
    }

    public async Task DisposeAsync()
    {
        _factory.Dispose();
        await Task.CompletedTask;
    }

    #region Authentication Tests

    [Fact]
    public async Task Get_pay_periods_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/pay-periods");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_current_pay_period_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/pay-periods/current");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_configuration_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/pay-periods/configuration");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    #endregion

    #region Configuration Tests

    [Fact]
    public async Task Get_configuration_returns_defaults()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/pay-periods/configuration");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var config = await resp.Content.ReadFromJsonAsync<PayPeriodConfigurationDto>(JsonOptions);
        Assert.NotNull(config);
        // Default is Weekly
        Assert.Equal(PayPeriodType.Weekly, config!.Type);
    }

    [Fact]
    public async Task Update_configuration_returns_updated_values()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var updateReq = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.BiWeekly,
            WeekStartDay: DayOfWeek.Monday,
            SemiMonthlyFirstDay: 1,
            SemiMonthlySecondDay: 16,
            AutoLockEnabled: true,
            AutoLockDaysAfterEnd: 5,
            PeriodsToGenerateAhead: 6,
            BiWeeklyReferenceDate: new DateOnly(2026, 1, 5),
            EnforcementEnabled: true
        );

        var resp = await client.PutAsJsonAsync("/api/pay-periods/configuration", updateReq);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var config = await resp.Content.ReadFromJsonAsync<PayPeriodConfigurationDto>(JsonOptions);
        Assert.NotNull(config);
        Assert.Equal(PayPeriodType.BiWeekly, config!.Type);
        Assert.Equal(DayOfWeek.Monday, config.WeekStartDay);
        Assert.True(config.AutoLockEnabled);
        Assert.Equal(5, config.AutoLockDaysAfterEnd);
        Assert.Equal(6, config.PeriodsToGenerateAhead);
    }

    #endregion

    #region Generate Periods Tests

    [Fact]
    public async Task Generate_periods_creates_pay_periods()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // First, set up configuration
        var configReq = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.Weekly,
            WeekStartDay: DayOfWeek.Sunday,
            SemiMonthlyFirstDay: 1,
            SemiMonthlySecondDay: 16,
            AutoLockEnabled: false,
            AutoLockDaysAfterEnd: 3,
            PeriodsToGenerateAhead: 4,
            BiWeeklyReferenceDate: null,
            EnforcementEnabled: true
        );
        var configResp = await client.PutAsJsonAsync("/api/pay-periods/configuration", configReq);
        configResp.EnsureSuccessStatusCode();

        // Generate periods
        var generateReq = new GeneratePayPeriodsRequest(
            FromDate: DateOnly.FromDateTime(DateTime.UtcNow),
            PeriodsToGenerate: 4
        );
        var resp = await client.PostAsJsonAsync("/api/pay-periods/generate", generateReq);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var result = await resp.Content.ReadFromJsonAsync<GeneratePayPeriodsResult>(JsonOptions);
        Assert.NotNull(result);
        Assert.True(result!.PeriodsCreated > 0);
    }

    #endregion

    #region List & Current Period Tests

    [Fact]
    public async Task List_periods_returns_generated_periods()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Set up config and generate
        await SetupConfigAndGenerate(client);

        var resp = await client.GetAsync("/api/pay-periods");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var result = await resp.Content.ReadFromJsonAsync<PagedResult<PayPeriodDto>>(JsonOptions);
        Assert.NotNull(result);
        Assert.True(result!.TotalCount > 0);
        Assert.NotEmpty(result.Items);
    }

    [Fact]
    public async Task Get_current_period_returns_period_for_today()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Set up config and generate
        await SetupConfigAndGenerate(client);

        var resp = await client.GetAsync("/api/pay-periods/current");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var period = await resp.Content.ReadFromJsonAsync<PayPeriodDto>(JsonOptions);
        Assert.NotNull(period);
        Assert.Equal(PayPeriodStatus.Open, period!.Status);
    }

    #endregion

    #region Lock / Unlock Tests

    [Fact]
    public async Task Lock_and_unlock_pay_period()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();

        // Set up config and generate
        await SetupConfigAndGenerate(client);

        // Create an employee to use as the locker/unlocker (lock requires Employee ID, not User ID)
        var empResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"PP-{Guid.NewGuid():N}"[..15],
            firstName = "Lock",
            lastName = "Tester",
            email = "lock-tester@test.com",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 25.00m
        });
        empResp.EnsureSuccessStatusCode();
        var employee = await empResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions);
        Assert.NotNull(employee);

        // Get a period to lock
        var listResp = await client.GetAsync("/api/pay-periods");
        listResp.EnsureSuccessStatusCode();
        var listResult = await listResp.Content.ReadFromJsonAsync<PagedResult<PayPeriodDto>>(JsonOptions);
        Assert.NotNull(listResult);
        Assert.NotEmpty(listResult!.Items);

        var periodToLock = listResult.Items.First(p => p.Status == PayPeriodStatus.Open);

        // Lock the period (user ID resolved from JWT)
        var lockResp = await client.PostAsync($"/api/pay-periods/{periodToLock.Id}/lock", null);

        Assert.Equal(HttpStatusCode.OK, lockResp.StatusCode);

        var lockedPeriod = await lockResp.Content.ReadFromJsonAsync<PayPeriodDto>(JsonOptions);
        Assert.NotNull(lockedPeriod);
        Assert.Equal(PayPeriodStatus.Locked, lockedPeriod!.Status);
        Assert.True(lockedPeriod.IsLocked);

        // Unlock the period (user ID resolved from JWT)
        var unlockResp = await client.PostAsync($"/api/pay-periods/{periodToLock.Id}/unlock", null);

        Assert.Equal(HttpStatusCode.OK, unlockResp.StatusCode);

        var unlockedPeriod = await unlockResp.Content.ReadFromJsonAsync<PayPeriodDto>(JsonOptions);
        Assert.NotNull(unlockedPeriod);
        Assert.Equal(PayPeriodStatus.Open, unlockedPeriod!.Status);
        Assert.False(unlockedPeriod.IsLocked);
    }

    #endregion

    #region Helpers

    private async Task SetupConfigAndGenerate(HttpClient client)
    {
        var configReq = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.Weekly,
            WeekStartDay: DayOfWeek.Sunday,
            SemiMonthlyFirstDay: 1,
            SemiMonthlySecondDay: 16,
            AutoLockEnabled: false,
            AutoLockDaysAfterEnd: 3,
            PeriodsToGenerateAhead: 4,
            BiWeeklyReferenceDate: null,
            EnforcementEnabled: true
        );
        var configResp = await client.PutAsJsonAsync("/api/pay-periods/configuration", configReq);
        configResp.EnsureSuccessStatusCode();

        var generateReq = new GeneratePayPeriodsRequest(
            FromDate: DateOnly.FromDateTime(DateTime.UtcNow),
            PeriodsToGenerate: 4
        );
        var genResp = await client.PostAsJsonAsync("/api/pay-periods/generate", generateReq);
        genResp.EnsureSuccessStatusCode();
    }

    #endregion
}
