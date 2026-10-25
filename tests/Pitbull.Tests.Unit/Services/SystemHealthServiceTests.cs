using FluentAssertions;
using Pitbull.SystemAdmin.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class SystemHealthServiceTests : IDisposable
{
    private readonly Core.Data.PitbullDbContext _db;
    private readonly SystemHealthService _sut;

    public SystemHealthServiceTests()
    {
        _db = TestDbContextFactory.Create();
        _sut = new SystemHealthService(_db);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task GetHealthAsync_ReturnsSuccessResult()
    {
        var result = await _sut.GetHealthAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetHealthAsync_ReturnsDegradedStatus_WhenRawSqlUnavailable()
    {
        // In-memory provider doesn't support SqlQueryRaw, so CheckDatabaseHealthAsync
        // catches the exception and reports Connected = false → "Degraded"
        var result = await _sut.GetHealthAsync();

        result.Value!.Status.Should().Be("Degraded");
    }

    [Fact]
    public async Task GetHealthAsync_DatabaseHealth_ShowsNotConnected_WithInMemory()
    {
        var result = await _sut.GetHealthAsync();

        result.Value!.Database.Connected.Should().BeFalse();
        result.Value!.Database.Error.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetHealthAsync_HasTimestamp()
    {
        var before = DateTime.UtcNow;
        var result = await _sut.GetHealthAsync();
        var after = DateTime.UtcNow;

        result.Value!.CheckedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public async Task GetHealthAsync_Stats_DefaultsToZeros_WhenQueriesFail()
    {
        // With in-memory DB and no seeded data, raw SQL fails and Users count = 0
        var result = await _sut.GetHealthAsync();
        var stats = result.Value!.Stats;

        stats.Should().NotBeNull();
        stats.TotalProjects.Should().Be(0);
        stats.TotalBids.Should().Be(0);
        stats.TotalSubcontracts.Should().Be(0);
        stats.TotalTimeEntries.Should().Be(0);
    }

    [Fact]
    public async Task GetHealthAsync_Stats_HasAllFields()
    {
        var result = await _sut.GetHealthAsync();
        var stats = result.Value!.Stats;

        // Verify the DTO structure is complete (all fields exist, no nulls)
        stats.TotalUsers.Should().BeGreaterThanOrEqualTo(0);
        stats.ActiveUsers.Should().BeGreaterThanOrEqualTo(0);
        stats.TotalProjects.Should().BeGreaterThanOrEqualTo(0);
        stats.TotalBids.Should().BeGreaterThanOrEqualTo(0);
        stats.TotalSubcontracts.Should().BeGreaterThanOrEqualTo(0);
        stats.TotalTimeEntries.Should().BeGreaterThanOrEqualTo(0);
        stats.ApiKeysActive.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public void AllowedTables_ContainsExpectedEntries()
    {
        // Verify the SQL-injection whitelist via reflection
        var field = typeof(SystemHealthService)
            .GetField("AllowedTables", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        field.Should().NotBeNull("AllowedTables field should exist");

        var allowedTables = field!.GetValue(null) as HashSet<string>;
        allowedTables.Should().NotBeNull();
        allowedTables.Should().BeEquivalentTo(["projects", "bids", "subcontracts", "time_entries"]);
    }

    [Fact]
    public void AllowedTables_IsCaseSensitive()
    {
        var field = typeof(SystemHealthService)
            .GetField("AllowedTables", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var allowedTables = field!.GetValue(null) as HashSet<string>;

        // Verify the comparer is Ordinal (case-sensitive) — uppercase variants should not be found
        allowedTables!.Contains("Projects").Should().BeFalse("whitelist should be case-sensitive");
        allowedTables.Contains("PROJECTS").Should().BeFalse("whitelist should be case-sensitive");
    }

    [Theory]
    [InlineData("projects")]
    [InlineData("bids")]
    [InlineData("subcontracts")]
    [InlineData("time_entries")]
    public void AllowedTables_ContainsTable(string tableName)
    {
        var field = typeof(SystemHealthService)
            .GetField("AllowedTables", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var allowedTables = field!.GetValue(null) as HashSet<string>;

        allowedTables!.Contains(tableName).Should().BeTrue();
    }

    [Theory]
    [InlineData("users")]
    [InlineData("api_keys")]
    [InlineData("audit_logs")]
    [InlineData("employees")]
    [InlineData("drop_table_attack")]
    public void AllowedTables_RejectsUnlistedTable(string tableName)
    {
        var field = typeof(SystemHealthService)
            .GetField("AllowedTables", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var allowedTables = field!.GetValue(null) as HashSet<string>;

        allowedTables!.Contains(tableName).Should().BeFalse();
    }
}
