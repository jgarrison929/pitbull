using FluentAssertions;
using Pitbull.Notifications.Domain;
using Pitbull.Notifications.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Notifications;

public sealed class NotificationCreateValidationTests
{
    [Fact]
    public async Task Create_RejectsEmptyTitle()
    {
        using var db = TestDbContextFactory.Create();
        var service = new NotificationService(db);

        var result = await service.CreateAsync(new CreateNotificationCommand(
            UserId: Guid.NewGuid(),
            Title: "  ",
            Message: "Hello"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Create_RejectsOversizedMessage()
    {
        using var db = TestDbContextFactory.Create();
        var service = new NotificationService(db);

        var result = await service.CreateAsync(new CreateNotificationCommand(
            UserId: Guid.NewGuid(),
            Title: "Notice",
            Message: new string('m', 1001)));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("1000");
    }

    [Fact]
    public async Task Create_AcceptsValidNotification()
    {
        using var db = TestDbContextFactory.Create();
        var service = new NotificationService(db);

        var result = await service.CreateAsync(new CreateNotificationCommand(
            UserId: Guid.NewGuid(),
            Title: "RFI answered",
            Message: "RFI-12 was answered",
            Type: NotificationType.Info));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Title.Should().Be("RFI answered");
    }
}
