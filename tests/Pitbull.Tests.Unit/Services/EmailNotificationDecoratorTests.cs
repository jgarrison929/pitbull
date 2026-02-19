using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Api.Services;
using Pitbull.Core.CQRS;
using Pitbull.Notifications.Domain;
using Pitbull.Notifications.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class EmailNotificationDecoratorTests : IDisposable
{
    private readonly Mock<INotificationService> _innerMock = new();
    private readonly Mock<IEmailService> _emailServiceMock = new();
    private readonly Mock<INotificationPreferenceService> _prefServiceMock = new();
    private readonly Mock<ILogger<EmailNotificationDecorator>> _loggerMock = new();
    private readonly Core.Data.PitbullDbContext _db;
    private readonly EmailNotificationDecorator _sut;

    private static readonly Guid TestUserId = Guid.NewGuid();
    private static readonly Guid TestNotificationId = Guid.NewGuid();

    public EmailNotificationDecoratorTests()
    {
        _db = TestDbContextFactory.Create();
        _sut = new EmailNotificationDecorator(
            _innerMock.Object,
            _emailServiceMock.Object,
            _prefServiceMock.Object,
            _db,
            _loggerMock.Object);
    }

    public void Dispose() => _db.Dispose();

    private static CreateNotificationCommand MakeCommand(
        NotificationType type = NotificationType.Info,
        string? relatedEntityType = null,
        Guid? relatedEntityId = null)
        => new(TestUserId, "Test Title", "Test Message", type, relatedEntityType, relatedEntityId);

    private static NotificationDto MakeDto()
        => new(TestNotificationId, TestUserId, "Test Title", "Test Message",
               NotificationType.Info, false, DateTime.UtcNow, null, null, null);

    #region CreateAsync — delegation

    [Fact]
    public async Task CreateAsync_ReturnsInnerResult_OnSuccess()
    {
        var dto = MakeDto();
        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(dto));

        var result = await _sut.CreateAsync(MakeCommand());

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(dto);
    }

    [Fact]
    public async Task CreateAsync_ReturnsInnerResult_OnFailure()
    {
        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<NotificationDto>("Failed", "CREATE_FAILED"));

        var result = await _sut.CreateAsync(MakeCommand());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("CREATE_FAILED");
    }

    [Fact]
    public async Task CreateAsync_CallsInnerExactlyOnce()
    {
        var command = MakeCommand();
        _innerMock.Setup(i => i.CreateAsync(command, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(MakeDto()));

        await _sut.CreateAsync(command);

        _innerMock.Verify(i => i.CreateAsync(command, It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region CreateAsync — fire-and-forget email

    [Fact]
    public async Task CreateAsync_WhenInnerFails_DoesNotAttemptEmail()
    {
        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<NotificationDto>("Failed", "ERR"));

        await _sut.CreateAsync(MakeCommand(NotificationType.TimeEntrySubmitted));

        // Give fire-and-forget a chance (it shouldn't fire at all)
        await Task.Delay(100);
        _emailServiceMock.Verify(
            e => e.SendNotificationEmailAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenTypeHasNoEmailCategory_DoesNotSendEmail()
    {
        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(MakeDto()));

        // NotificationType.Info maps to null category → no email
        await _sut.CreateAsync(MakeCommand(NotificationType.Info));

        await Task.Delay(100);
        _emailServiceMock.Verify(
            e => e.SendNotificationEmailAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Theory]
    [InlineData(NotificationType.Success)]
    [InlineData(NotificationType.Warning)]
    [InlineData(NotificationType.Error)]
    [InlineData(NotificationType.ChangeOrder)]
    public async Task CreateAsync_WhenTypeIsUnmapped_DoesNotSendEmail(NotificationType type)
    {
        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(MakeDto()));

        await _sut.CreateAsync(MakeCommand(type));

        await Task.Delay(100);
        _emailServiceMock.Verify(
            e => e.SendNotificationEmailAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenUserNotFound_DoesNotSendEmail()
    {
        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(MakeDto()));

        // TimeEntrySubmitted maps to a category, but no user seeded in DB
        await _sut.CreateAsync(MakeCommand(NotificationType.TimeEntrySubmitted));

        await Task.Delay(100);
        _emailServiceMock.Verify(
            e => e.SendNotificationEmailAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenEmailServiceThrows_DoesNotPropagateException()
    {
        // Seed a user so TrySendEmailAsync gets past the user lookup
        await SeedTestUser();
        SetupPreferencesWithEmailEnabled("time_entry_submitted");

        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(MakeDto()));

        _emailServiceMock
            .Setup(e => e.SendNotificationEmailAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("SMTP failure"));

        // Should not throw even though email service throws
        var act = () => _sut.CreateAsync(MakeCommand(NotificationType.TimeEntrySubmitted));
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task CreateAsync_WhenEmailEnabled_SendsEmail()
    {
        await SeedTestUser();
        SetupPreferencesWithEmailEnabled("time_entry_submitted");

        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(MakeDto()));

        var emailSent = new SemaphoreSlim(0, 1);
        _emailServiceMock
            .Setup(e => e.SendNotificationEmailAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback(() => emailSent.Release())
            .Returns(Task.CompletedTask);

        await _sut.CreateAsync(MakeCommand(NotificationType.TimeEntrySubmitted));

        var sent = await emailSent.WaitAsync(TimeSpan.FromSeconds(2));
        sent.Should().BeTrue("email should have been sent for time_entry_submitted with email enabled");
    }

    [Fact]
    public async Task CreateAsync_WhenEmailDisabledForCategory_DoesNotSendEmail()
    {
        await SeedTestUser();
        // Set up preferences with email disabled
        _prefServiceMock
            .Setup(p => p.GetPreferencesAsync(TestUserId, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<NotificationPreferenceDto>
            {
                new("time_entry_submitted", InApp: true, Email: false)
            });

        _innerMock.Setup(i => i.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(MakeDto()));

        await _sut.CreateAsync(MakeCommand(NotificationType.TimeEntrySubmitted));

        await Task.Delay(200);
        _emailServiceMock.Verify(
            e => e.SendNotificationEmailAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    #endregion

    #region Delegation methods

    [Fact]
    public async Task MarkReadAsync_DelegatesToInner()
    {
        var notifId = Guid.NewGuid();
        _innerMock.Setup(i => i.MarkReadAsync(notifId, TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        await _sut.MarkReadAsync(notifId, TestUserId);

        _innerMock.Verify(i => i.MarkReadAsync(notifId, TestUserId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkAllReadAsync_DelegatesToInner()
    {
        _innerMock.Setup(i => i.MarkAllReadAsync(TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(5));

        var result = await _sut.MarkAllReadAsync(TestUserId);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(5);
        _innerMock.Verify(i => i.MarkAllReadAsync(TestUserId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetUnreadAsync_DelegatesToInner()
    {
        var list = new List<NotificationDto> { MakeDto() };
        _innerMock.Setup(i => i.GetUnreadAsync(TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success<IReadOnlyList<NotificationDto>>(list));

        var result = await _sut.GetUnreadAsync(TestUserId);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllAsync_DelegatesToInner()
    {
        var paged = new PagedResult<NotificationDto>(new List<NotificationDto> { MakeDto() }, 1, 1, 20);
        _innerMock.Setup(i => i.GetAllAsync(TestUserId, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(paged));

        var result = await _sut.GetAllAsync(TestUserId, 1, 20);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task GetUnreadCountAsync_DelegatesToInner()
    {
        _innerMock.Setup(i => i.GetUnreadCountAsync(TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(3));

        var result = await _sut.GetUnreadCountAsync(TestUserId);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(3);
    }

    [Fact]
    public async Task DeleteAsync_DelegatesToInner()
    {
        var notifId = Guid.NewGuid();
        _innerMock.Setup(i => i.DeleteAsync(notifId, TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        await _sut.DeleteAsync(notifId, TestUserId);

        _innerMock.Verify(i => i.DeleteAsync(notifId, TestUserId, It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region Helpers

    private async Task SeedTestUser()
    {
        var user = new Core.Domain.AppUser
        {
            Id = TestUserId,
            TenantId = TestDbContextFactory.TestTenantId,
            Email = "test@example.com",
            FirstName = "Test",
            LastName = "User",
            UserName = "testuser",
            NormalizedUserName = "TESTUSER",
            NormalizedEmail = "TEST@EXAMPLE.COM",
            Status = Core.Domain.UserStatus.Active
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
    }

    private void SetupPreferencesWithEmailEnabled(string category)
    {
        _prefServiceMock
            .Setup(p => p.GetPreferencesAsync(TestUserId, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<NotificationPreferenceDto>
            {
                new(category, InApp: true, Email: true)
            });
    }

    #endregion
}
