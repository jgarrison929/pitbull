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
            Guid.NewGuid(), TestDbContextFactory.TestTenantId, "rfi_overdue");

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
            Category = "rfi_overdue",
            InApp = true,
            Email = false,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = new NotificationPreferenceService(db);
        var result = await service.IsNotificationEnabledAsync(
            userId, TestDbContextFactory.TestTenantId, "rfi_overdue");

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
            Category = "rfi_upcoming",
            InApp = false,
            Email = true,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = new NotificationPreferenceService(db);
        var result = await service.IsNotificationEnabledAsync(
            userId, TestDbContextFactory.TestTenantId, "rfi_upcoming");

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
            Category = "rfi_overdue",
            InApp = false,
            Email = false,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = new NotificationPreferenceService(db);
        // Querying a different category should not find the rfi_overdue pref
        var result = await service.IsNotificationEnabledAsync(
            userId, TestDbContextFactory.TestTenantId, "submittal_overdue");

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
        categories.Should().Contain("rfi_overdue");
        categories.Should().Contain("rfi_upcoming");
        categories.Should().Contain("submittal_overdue");
        categories.Should().Contain("submittal_upcoming");
    }
}
