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
}
