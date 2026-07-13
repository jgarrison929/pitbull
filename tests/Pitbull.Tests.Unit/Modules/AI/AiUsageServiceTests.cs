using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.AI.Domain;
using Pitbull.AI.Features;
using Pitbull.AI.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.AI;

public sealed class AiUsageServiceTests
{
    private sealed class TestTenantContext(Guid tenantId) : ITenantContext
    {
        public Guid TenantId { get; } = tenantId;
        public string TenantName => "Test Tenant";
        public bool IsResolved => true;
    }

    [Fact]
    public async Task LogUsage_PersistsRecordWithTenantAndCost()
    {
        using var db = TestDbContextFactory.Create();
        var service = new AiUsageService(db, new TestTenantContext(TestDbContextFactory.TestTenantId));
        var userId = Guid.NewGuid();

        await service.LogUsageAsync(
            userId: userId,
            provider: "openai",
            model: "gpt-4.1",
            tokensIn: 200,
            tokensOut: 50,
            estimatedCost: 1.25m,
            feature: "invoice-extraction",
            durationMs: 350);

        var record = await db.Set<AiUsageRecord>().SingleAsync();
        record.TenantId.Should().Be(TestDbContextFactory.TestTenantId);
        record.UserId.Should().Be(userId);
        record.Provider.Should().Be("openai");
        record.EstimatedCost.Should().Be(1.25m);
    }

    [Fact]
    public async Task LogUsage_with_companyId_increments_company_meter()
    {
        using var db = TestDbContextFactory.Create();
        var service = new AiUsageService(db, new TestTenantContext(TestDbContextFactory.TestTenantId));
        var companyId = Guid.NewGuid();

        await service.LogUsageAsync(
            userId: Guid.NewGuid(),
            provider: "openai",
            model: "gpt-4.1",
            tokensIn: 10,
            tokensOut: 5,
            estimatedCost: 0m,
            feature: "field-voice-suggestion",
            durationMs: 100,
            companyId: companyId);

        var count = await service.GetCompanyRequestCountAsync(
            companyId,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)));
        count.Should().Be(1);

        var other = await service.GetCompanyRequestCountAsync(
            Guid.NewGuid(),
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)));
        other.Should().Be(0);
    }

    [Fact]
    public async Task GetUsageSummary_AggregatesRequestsTokensAndCost()
    {
        using var db = TestDbContextFactory.Create();
        var service = new AiUsageService(db, new TestTenantContext(TestDbContextFactory.TestTenantId));
        var from = new DateOnly(2026, 2, 1);
        var to = new DateOnly(2026, 2, 28);

        await SeedUsageAsync(db, Guid.NewGuid(), "openai", 100, 20, 0.50m, new DateTime(2026, 2, 5, 12, 0, 0, DateTimeKind.Utc));
        await SeedUsageAsync(db, Guid.NewGuid(), "anthropic", 60, 10, 0.30m, new DateTime(2026, 2, 6, 12, 0, 0, DateTimeKind.Utc));
        await SeedUsageAsync(db, Guid.NewGuid(), "openai", 500, 200, 4.10m, new DateTime(2026, 1, 20, 12, 0, 0, DateTimeKind.Utc)); // out of range

        var summary = await service.GetUsageSummaryAsync(from, to);

        summary.TotalRequests.Should().Be(2);
        summary.TotalTokensIn.Should().Be(160);
        summary.TotalTokensOut.Should().Be(30);
        summary.TotalCost.Should().Be(0.80m);
    }

    [Fact]
    public async Task GetUsageByUser_ReturnsDisplayNamesAndUnknownFallback()
    {
        using var db = TestDbContextFactory.Create();
        var service = new AiUsageService(db, new TestTenantContext(TestDbContextFactory.TestTenantId));
        var knownUserId = Guid.NewGuid();
        var unknownUserId = Guid.NewGuid();
        var from = new DateOnly(2026, 2, 1);
        var to = new DateOnly(2026, 2, 28);

        db.Users.Add(new AppUser
        {
            Id = knownUserId,
            TenantId = TestDbContextFactory.TestTenantId,
            UserName = "known-user",
            Email = "known@pitbull.local",
            FirstName = "Known",
            LastName = "User"
        });
        await db.SaveChangesAsync();

        await SeedUsageAsync(db, knownUserId, "openai", 100, 50, 1.0m, new DateTime(2026, 2, 10, 0, 0, 0, DateTimeKind.Utc));
        await SeedUsageAsync(db, unknownUserId, "openai", 50, 20, 2.0m, new DateTime(2026, 2, 11, 0, 0, 0, DateTimeKind.Utc));

        var result = await service.GetUsageByUserAsync(from, to);

        result.Should().HaveCount(2);
        result[0].UserName.Should().Be("Unknown");
        result[0].TotalCost.Should().Be(2.0m);
        result[1].UserName.Should().Be("Known User");
        result[1].TotalCost.Should().Be(1.0m);
    }

    [Fact]
    public async Task GetDailyUsage_InMemoryProvider_ThrowsTranslationException()
    {
        using var db = TestDbContextFactory.Create();
        var service = new AiUsageService(db, new TestTenantContext(TestDbContextFactory.TestTenantId));
        var userId = Guid.NewGuid();
        var from = new DateOnly(2026, 2, 1);
        var to = new DateOnly(2026, 2, 28);

        await SeedUsageAsync(db, userId, "openai", 100, 20, 0.5m, new DateTime(2026, 2, 3, 8, 0, 0, DateTimeKind.Utc));
        await SeedUsageAsync(db, userId, "openai", 50, 10, 0.2m, new DateTime(2026, 2, 3, 10, 0, 0, DateTimeKind.Utc));
        await SeedUsageAsync(db, userId, "anthropic", 80, 40, 1.0m, new DateTime(2026, 2, 4, 9, 0, 0, DateTimeKind.Utc));

        Func<Task> act = async () => await service.GetDailyUsageAsync(from, to);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task GetUsageByProvider_InMemoryProvider_ThrowsTranslationException()
    {
        using var db = TestDbContextFactory.Create();
        var service = new AiUsageService(db, new TestTenantContext(TestDbContextFactory.TestTenantId));
        var from = new DateOnly(2026, 2, 1);
        var to = new DateOnly(2026, 2, 28);

        await SeedUsageAsync(db, Guid.NewGuid(), "openai", 10, 5, 0.1m, new DateTime(2026, 2, 3, 8, 0, 0, DateTimeKind.Utc));

        Func<Task> act = async () => await service.GetUsageByProviderAsync(from, to);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    private static async Task SeedUsageAsync(
        PitbullDbContext db,
        Guid userId,
        string provider,
        int tokensIn,
        int tokensOut,
        decimal cost,
        DateTime requestedAtUtc)
    {
        db.Set<AiUsageRecord>().Add(new AiUsageRecord
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            UserId = userId,
            Provider = provider,
            Model = "model",
            TokensIn = tokensIn,
            TokensOut = tokensOut,
            EstimatedCost = cost,
            DurationMs = 100,
            RequestedAt = requestedAtUtc,
            CreatedAt = requestedAtUtc
        });
        await db.SaveChangesAsync();
    }
}
