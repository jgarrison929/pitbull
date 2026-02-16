using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Pitbull.Api.Controllers;
using Pitbull.Core.Domain;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class TimecardSettingsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
    public async Task Get_timecard_settings_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/companies/settings/time-tracking");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Update_timecard_settings_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PutAsJsonAsync("/api/companies/settings/time-tracking", new
        {
            timecardMode = 0,
            weeklyEntryMode = 0,
            defaultProjectId = (Guid?)null,
            requirePhase = false,
            requireEquipment = false
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    #endregion

    #region Get Default Settings Tests

    [Fact]
    public async Task Get_timecard_settings_returns_defaults()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/companies/settings/time-tracking");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var settings = await resp.Content.ReadFromJsonAsync<TimecardSettingsResponse>(JsonOptions);
        Assert.NotNull(settings);
        Assert.Equal(TimecardMode.Daily, settings!.TimecardMode);
        Assert.Equal(WeeklyEntryMode.Detailed, settings.WeeklyEntryMode);
        Assert.Null(settings.DefaultProjectId);
        Assert.False(settings.RequirePhase);
        Assert.False(settings.RequireEquipment);
    }

    #endregion

    #region Update Settings Tests

    [Fact]
    public async Task Update_timecard_settings_returns_updated_values()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var updateReq = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Weekly,
            WeeklyEntryMode: WeeklyEntryMode.Simple,
            DefaultProjectId: null,
            RequirePhase: true,
            RequireEquipment: true
        );

        var resp = await client.PutAsJsonAsync("/api/companies/settings/time-tracking", updateReq);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var settings = await resp.Content.ReadFromJsonAsync<TimecardSettingsResponse>(JsonOptions);
        Assert.NotNull(settings);
        Assert.Equal(TimecardMode.Weekly, settings!.TimecardMode);
        Assert.Equal(WeeklyEntryMode.Simple, settings.WeeklyEntryMode);
        Assert.Null(settings.DefaultProjectId);
        Assert.True(settings.RequirePhase);
        Assert.True(settings.RequireEquipment);
    }

    [Fact]
    public async Task Update_timecard_settings_persists_on_subsequent_get()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var updateReq = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Weekly,
            WeeklyEntryMode: WeeklyEntryMode.Detailed,
            DefaultProjectId: null,
            RequirePhase: true,
            RequireEquipment: false
        );

        var updateResp = await client.PutAsJsonAsync("/api/companies/settings/time-tracking", updateReq);
        updateResp.EnsureSuccessStatusCode();

        // Re-fetch settings
        var getResp = await client.GetAsync("/api/companies/settings/time-tracking");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var settings = await getResp.Content.ReadFromJsonAsync<TimecardSettingsResponse>(JsonOptions);
        Assert.NotNull(settings);
        Assert.Equal(TimecardMode.Weekly, settings!.TimecardMode);
        Assert.Equal(WeeklyEntryMode.Detailed, settings.WeeklyEntryMode);
        Assert.True(settings.RequirePhase);
        Assert.False(settings.RequireEquipment);
    }

    #endregion

    #region Validation Tests

    [Fact]
    public async Task Update_with_invalid_enum_value_returns_400()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Send raw JSON with an invalid enum value
        var json = """
        {
            "timecardMode": 99,
            "weeklyEntryMode": 0,
            "defaultProjectId": null,
            "requirePhase": false,
            "requireEquipment": false
        }
        """;

        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var resp = await client.PutAsync("/api/companies/settings/time-tracking", content);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Update_with_nonexistent_default_project_returns_400()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var updateReq = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Daily,
            WeeklyEntryMode: WeeklyEntryMode.Simple,
            DefaultProjectId: Guid.NewGuid(),  // Non-existent project
            RequirePhase: false,
            RequireEquipment: false
        );

        var resp = await client.PutAsJsonAsync("/api/companies/settings/time-tracking", updateReq);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);

        var body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("DefaultProjectId", body);
    }

    #endregion
}
