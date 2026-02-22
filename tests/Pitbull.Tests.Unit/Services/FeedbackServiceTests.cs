using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Entities;
using Pitbull.Core.Features.Feedback;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class FeedbackServiceTests
{
    private static FeedbackService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var tenantContext = new Pitbull.Core.MultiTenancy.TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId,
            TenantName = "Test Tenant"
        };

        return new FeedbackService(db, tenantContext, NullLogger<FeedbackService>.Instance);
    }

    [Fact]
    public async Task CreateAsync_PersistsFeedback()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var created = await service.CreateAsync(
            new CreateFeedbackRequest(
                Page: "/projects/123",
                UserRole: "Admin",
                Category: "Bug",
                Message: "Save button is clipped on mobile",
                ContactEmail: "user@test.com"),
            "test-user");

        created.Id.Should().NotBeEmpty();
        created.Status.Should().Be(FeedbackStatus.New);
        created.Category.Should().Be("Bug");

        var persisted = await db.Set<Feedback>().FindAsync(created.Id);
        persisted.Should().NotBeNull();
        persisted!.Message.Should().Contain("clipped");
    }

    [Fact]
    public async Task ListAsync_FiltersByCategoryAndStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateAsync(
            new CreateFeedbackRequest("/a", "Admin", "Bug", "Bug report", null),
            "u1");
        var feature = await service.CreateAsync(
            new CreateFeedbackRequest("/b", "Manager", "Feature", "Feature request", null),
            "u2");
        await service.UpdateStatusAsync(feature.Id, FeedbackStatus.Reviewed);

        var bugs = await service.ListAsync(new FeedbackListQuery("Bug", null, null, null));
        bugs.Should().HaveCount(1);
        bugs[0].Category.Should().Be("Bug");

        var reviewed = await service.ListAsync(new FeedbackListQuery(null, FeedbackStatus.Reviewed, null, null));
        reviewed.Should().HaveCount(1);
        reviewed[0].Status.Should().Be(FeedbackStatus.Reviewed);
    }

    [Fact]
    public async Task UpdateStatusAsync_ReturnsNull_WhenFeedbackMissing()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.UpdateStatusAsync(Guid.NewGuid(), FeedbackStatus.Resolved);

        result.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_PersistsFeedbackType()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var created = await service.CreateAsync(
            new CreateFeedbackRequest(
                Page: "/billing",
                UserRole: "CFO",
                Category: "Bug",
                Message: "Invoice total is wrong",
                ContactEmail: null,
                Type: FeedbackType.Bug),
            "cfo-user");

        created.Type.Should().Be(FeedbackType.Bug);

        var persisted = await db.Set<Feedback>().FindAsync(created.Id);
        persisted!.Type.Should().Be(FeedbackType.Bug);
    }

    [Fact]
    public async Task CreateAsync_DefaultsToGeneralType()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var created = await service.CreateAsync(
            new CreateFeedbackRequest("/home", "User", "Other", "Just a thought", null),
            "user1");

        created.Type.Should().Be(FeedbackType.General);
    }

    [Fact]
    public async Task CreateAsync_PersistsScreenshotUrl()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var created = await service.CreateAsync(
            new CreateFeedbackRequest(
                Page: "/projects",
                UserRole: "PM",
                Category: "Bug",
                Message: "Layout broken",
                ContactEmail: null,
                Type: FeedbackType.Bug,
                ScreenshotUrl: "https://screenshots.example.com/abc123.png"),
            "pm-user");

        created.ScreenshotUrl.Should().Be("https://screenshots.example.com/abc123.png");

        var persisted = await db.Set<Feedback>().FindAsync(created.Id);
        persisted!.ScreenshotUrl.Should().Be("https://screenshots.example.com/abc123.png");
    }

    [Fact]
    public async Task CreateAsync_PersistsBrowserInfo()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0";
        var created = await service.CreateAsync(
            new CreateFeedbackRequest(
                Page: "/time-tracking",
                UserRole: "Foreman",
                Category: "Bug",
                Message: "Crew entry not loading",
                ContactEmail: null,
                BrowserInfo: userAgent),
            "foreman1");

        created.BrowserInfo.Should().Be(userAgent);
    }

    [Fact]
    public async Task CreateAsync_TrimsWhitespaceOnNewFields()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var created = await service.CreateAsync(
            new CreateFeedbackRequest(
                Page: "/test",
                UserRole: "Admin",
                Category: "Bug",
                Message: "test",
                ContactEmail: null,
                ScreenshotUrl: "  https://example.com/shot.png  ",
                BrowserInfo: "  Chrome/120  "),
            "user");

        created.ScreenshotUrl.Should().Be("https://example.com/shot.png");
        created.BrowserInfo.Should().Be("Chrome/120");
    }

    [Fact]
    public async Task CreateAsync_NullsEmptyStringsOnNewFields()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var created = await service.CreateAsync(
            new CreateFeedbackRequest(
                Page: "/test",
                UserRole: "Admin",
                Category: "Bug",
                Message: "test",
                ContactEmail: null,
                ScreenshotUrl: "   ",
                BrowserInfo: ""),
            "user");

        created.ScreenshotUrl.Should().BeNull();
        created.BrowserInfo.Should().BeNull();
    }

    [Fact]
    public async Task ListAsync_FiltersByType()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateAsync(
            new CreateFeedbackRequest("/a", "Admin", "Bug", "A bug", null, Type: FeedbackType.Bug),
            "u1");
        await service.CreateAsync(
            new CreateFeedbackRequest("/b", "Admin", "Feature", "A feature", null, Type: FeedbackType.Feature),
            "u2");

        var bugs = await service.ListAsync(new FeedbackListQuery(null, null, null, null, Type: FeedbackType.Bug));
        bugs.Should().HaveCount(1);
        bugs[0].Type.Should().Be(FeedbackType.Bug);
    }

    [Fact]
    public async Task ListAsync_ReturnsNewFieldsInDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateAsync(
            new CreateFeedbackRequest(
                "/test", "PM", "Bug", "Something broke", null,
                Type: FeedbackType.Bug,
                ScreenshotUrl: "https://example.com/shot.png",
                BrowserInfo: "Firefox/115"),
            "pm1");

        var items = await service.ListAsync(new FeedbackListQuery(null, null, null, null));
        items.Should().HaveCount(1);
        items[0].Type.Should().Be(FeedbackType.Bug);
        items[0].ScreenshotUrl.Should().Be("https://example.com/shot.png");
        items[0].BrowserInfo.Should().Be("Firefox/115");
    }

    [Fact]
    public async Task BulkUpdateStatusAsync_UpdatesMultipleItems()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var f1 = await service.CreateAsync(
            new CreateFeedbackRequest("/a", "Admin", "Bug", "Bug 1", null), "u1");
        var f2 = await service.CreateAsync(
            new CreateFeedbackRequest("/b", "Admin", "Bug", "Bug 2", null), "u2");
        var f3 = await service.CreateAsync(
            new CreateFeedbackRequest("/c", "Admin", "Feature", "Feature 1", null), "u3");

        var updated = await service.BulkUpdateStatusAsync(
            [f1.Id, f2.Id], FeedbackStatus.Reviewed);

        updated.Should().Be(2);

        var items = await service.ListAsync(new FeedbackListQuery(null, FeedbackStatus.Reviewed, null, null));
        items.Should().HaveCount(2);

        // f3 should remain New
        var allItems = await service.ListAsync(new FeedbackListQuery(null, FeedbackStatus.New, null, null));
        allItems.Should().HaveCount(1);
        allItems[0].Id.Should().Be(f3.Id);
    }

    [Fact]
    public async Task BulkUpdateStatusAsync_ReturnsZero_WhenEmptyList()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var updated = await service.BulkUpdateStatusAsync([], FeedbackStatus.Resolved);

        updated.Should().Be(0);
    }

    [Fact]
    public async Task BulkUpdateStatusAsync_ReturnsZero_WhenIdsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var updated = await service.BulkUpdateStatusAsync(
            [Guid.NewGuid(), Guid.NewGuid()], FeedbackStatus.Resolved);

        updated.Should().Be(0);
    }
}
