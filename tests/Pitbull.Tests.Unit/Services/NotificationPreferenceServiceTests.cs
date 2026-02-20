using FluentAssertions;
using Pitbull.Api.Services;
using Pitbull.Core.Entities;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class NotificationPreferenceServiceTests
{
    [Fact]
    public async Task IsNotificationEnabledAsync_NoPreference_ReturnsTrue()
    {
        using var db = TestDbContextFactory.Create();
        var service = new NotificationPreferenceService(db);

        var result = await service.IsNotificationEnabledAsync(
            Guid.NewGuid(), TestDbContextFactory.TestTenantId, "overdue_rfi");

        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsNotificationEnabledAsync_InAppEnabled_ReturnsTrue()
    {
        using var db = TestDbContextFactory.Create();
        var userId = Guid.NewGuid();

        db.NotificationPreferences.Add(new NotificationPreference
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            UserId = userId,
            Category = "overdue_rfi",
            InApp = true,
            Email = false,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = new NotificationPreferenceService(db);
        var result = await service.IsNotificationEnabledAsync(
            userId, TestDbContextFactory.TestTenantId, "overdue_rfi");

        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsNotificationEnabledAsync_InAppDisabled_ReturnsFalse()
    {
        using var db = TestDbContextFactory.Create();
        var userId = Guid.NewGuid();

        db.NotificationPreferences.Add(new NotificationPreference
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            UserId = userId,
            Category = "rfi_deadline_approaching",
            InApp = false,
            Email = true,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = new NotificationPreferenceService(db);
        var result = await service.IsNotificationEnabledAsync(
            userId, TestDbContextFactory.TestTenantId, "rfi_deadline_approaching");

        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsNotificationEnabledAsync_DifferentCategory_ReturnsTrue()
    {
        using var db = TestDbContextFactory.Create();
        var userId = Guid.NewGuid();

        db.NotificationPreferences.Add(new NotificationPreference
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            UserId = userId,
            Category = "overdue_rfi",
            InApp = false,
            Email = false,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = new NotificationPreferenceService(db);
        // Querying a different category should not find the rfi_overdue pref
        var result = await service.IsNotificationEnabledAsync(
            userId, TestDbContextFactory.TestTenantId, "overdue_submittal");

        result.Should().BeTrue();
    }

    [Fact]
    public async Task GetPreferencesAsync_IncludesDeadlineCategories()
    {
        using var db = TestDbContextFactory.Create();
        var userId = Guid.NewGuid();
        var service = new NotificationPreferenceService(db);

        var prefs = await service.GetPreferencesAsync(userId, TestDbContextFactory.TestTenantId);

        var categories = prefs.Select(p => p.Category).ToList();
        categories.Should().Contain("overdue_rfi");
        categories.Should().Contain("rfi_deadline_approaching");
        categories.Should().Contain("overdue_submittal");
        categories.Should().Contain("submittal_deadline_approaching");
        categories.Should().Contain("retention_deadline");
        categories.Should().Contain("inspection_deadline");
    }

    [Fact]
    public void Categories_MatchFrontendExactly()
    {
        // These are the exact categories the frontend settings page references.
        // If this test fails, the frontend and backend are out of sync.
        var expected = new[]
        {
            "time_entry_submitted",
            "time_entry_approved",
            "time_entry_rejected",
            "pay_period_locked",
            "rfi_created",
            "rfi_responded",
            "submittal_status_changed",
            "daily_report_submitted",
            "rfi_deadline_approaching",
            "overdue_rfi",
            "submittal_deadline_approaching",
            "overdue_submittal",
            "retention_deadline",
            "inspection_deadline",
            "document_uploaded",
            "system_announcement"
        };

        NotificationPreferenceService.Categories.Should().BeEquivalentTo(expected);
    }
}
