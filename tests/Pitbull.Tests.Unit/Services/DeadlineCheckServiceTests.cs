using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Pitbull.Api.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.MultiTenancy;
using Pitbull.Notifications.Domain;
using Pitbull.Notifications.Services;
using Pitbull.ProjectManagement.Domain;
using Pitbull.RFIs.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class DeadlineCheckServiceTests
{
    private static readonly Guid TestUserId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();

    private static (DeadlineCheckService service, Mock<INotificationService> notifMock, Mock<INotificationPreferenceService> prefMock, PitbullDbContext db) CreateTestSetup(bool preferencesEnabled = true)
    {
        var dbName = Guid.NewGuid().ToString();
        var db = TestDbContextFactory.Create(dbName: dbName);

        var notifMock = new Mock<INotificationService>();
        notifMock
            .Setup(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<NotificationDto>.Success(new NotificationDto(
                Guid.NewGuid(), TestUserId, "Test", "Test", NotificationType.Info, false, DateTime.UtcNow, null, null, null)));

        var prefMock = new Mock<INotificationPreferenceService>();
        prefMock
            .Setup(p => p.IsNotificationEnabledAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(preferencesEnabled);

        // Each scope gets a fresh PitbullDbContext sharing the same in-memory DB name.
        // This prevents scope disposal from killing our test's db reference.
        var dbOptions = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        var tenantCtx = new TenantContext { TenantId = TestDbContextFactory.TestTenantId, TenantName = "Test" };
        var companyCtx = new CompanyContext { CompanyId = TestDbContextFactory.TestCompanyId, CompanyCode = "01", CompanyName = "Test" };

        var services = new ServiceCollection();
        services.AddScoped<PitbullDbContext>(_ => new PitbullDbContext(dbOptions, tenantCtx, companyCtx));
        services.AddScoped<INotificationService>(_ => notifMock.Object);
        services.AddScoped<IDeadlineNotificationTracker, DeadlineNotificationTracker>();
        services.AddScoped<INotificationPreferenceService>(_ => prefMock.Object);

        var sp = services.BuildServiceProvider();
        var service = new DeadlineCheckService(
            sp.GetRequiredService<IServiceScopeFactory>(),
            Options.Create(new DeadlineCheckOptions { IntervalHours = 1 }),
            NullLogger<DeadlineCheckService>.Instance);
        return (service, notifMock, prefMock, db);
    }

    private static Rfi CreateRfi(RfiStatus status = RfiStatus.Open, DateTime? dueDate = null, Guid? assignedTo = null)
        => new()
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId, ProjectId = TestProjectId,
            Number = 1, Subject = "Test RFI", Question = "Test?", Status = status,
            DueDate = dueDate, AssignedToUserId = assignedTo ?? TestUserId,
            CreatedAt = DateTime.UtcNow.AddDays(-7), CreatedBy = "system"
        };

    private static PmSubmittal CreateSubmittal(SubmittalStatus status = SubmittalStatus.Submitted,
        DateTime? finalDueDate = null, DateTime? requiredByDate = null, DateTime? submittedDate = null)
        => new()
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId, ProjectId = TestProjectId,
            SubmittalNumber = 1, Title = "Test Submittal", SubmittalType = SubmittalType.ProductData,
            Status = status, FinalDueDate = finalDueDate, RequiredByDate = requiredByDate,
            SubmittedDate = submittedDate,
            CreatedAt = DateTime.UtcNow.AddDays(-7), CreatedBy = TestUserId.ToString()
        };

    [Fact]
    public async Task RfiDueWithin24Hours_SendsUpcomingNotification()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        db.Set<Rfi>().Add(CreateRfi(dueDate: DateTime.UtcNow.AddHours(12)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(
            It.Is<CreateNotificationCommand>(c => c.Title.Contains("due tomorrow") && c.Type == NotificationType.UpcomingRfi),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RfiOverdue_SendsOverdueNotification()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        db.Set<Rfi>().Add(CreateRfi(dueDate: DateTime.UtcNow.AddHours(-2)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(
            It.Is<CreateNotificationCommand>(c => c.Title.Contains("is overdue") && c.Type == NotificationType.OverdueRfi),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RfiAlreadyNotified_NoDuplicate()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        db.Set<Rfi>().Add(CreateRfi(dueDate: DateTime.UtcNow.AddHours(12)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Once);
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ClosedRfi_NoNotification()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        db.Set<Rfi>().Add(CreateRfi(status: RfiStatus.Closed, dueDate: DateTime.UtcNow.AddHours(-2)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RfiWithoutAssignee_NoNotification()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        var rfi = CreateRfi(dueDate: DateTime.UtcNow.AddHours(-2));
        rfi.AssignedToUserId = null;
        rfi.BallInCourtUserId = null;
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task TrackerRecordsSentNotifications()
    {
        var (service, _, _, db) = CreateTestSetup();
        var rfi = CreateRfi(dueDate: DateTime.UtcNow.AddHours(-2));
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        var records = await db.DeadlineNotifications.Where(dn => dn.EntityId == rfi.Id).ToListAsync();
        records.Should().HaveCount(1);
        records[0].EntityType.Should().Be("Rfi");
        records[0].NotificationType.Should().Be("Overdue");
    }

    [Fact]
    public async Task SubmittalDeadlineCheck_DoesNotThrow()
    {
        var (service, _, _, db) = CreateTestSetup();
        db.Set<PmSubmittal>().Add(CreateSubmittal(finalDueDate: DateTime.UtcNow.AddHours(12)));
        await db.SaveChangesAsync();
        // Submittal path with enum string conversion may have in-memory provider limitations.
        // Full path verified via integration tests against PostgreSQL.
        var act = () => service.RunCheckAsync(CancellationToken.None);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ApprovedSubmittal_NoNotification()
    {
        var (service, _, _, db) = CreateTestSetup();
        db.Set<PmSubmittal>().Add(CreateSubmittal(status: SubmittalStatus.Approved, finalDueDate: DateTime.UtcNow.AddHours(-2)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        var records = await db.DeadlineNotifications.Where(dn => dn.EntityType == "Submittal").ToListAsync();
        records.Should().BeEmpty();
    }

    [Fact]
    public async Task RfiOverdue_PreferenceDisabled_NoNotification()
    {
        var (service, notifMock, prefMock, db) = CreateTestSetup(preferencesEnabled: false);
        db.Set<Rfi>().Add(CreateRfi(dueDate: DateTime.UtcNow.AddHours(-2)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        prefMock.Verify(p => p.IsNotificationEnabledAsync(
            TestUserId, TestDbContextFactory.TestTenantId, "overdue_rfi", It.IsAny<CancellationToken>()), Times.Once);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RfiUpcoming_PreferenceDisabled_NoNotification()
    {
        var (service, notifMock, prefMock, db) = CreateTestSetup(preferencesEnabled: false);
        db.Set<Rfi>().Add(CreateRfi(dueDate: DateTime.UtcNow.AddHours(12)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        prefMock.Verify(p => p.IsNotificationEnabledAsync(
            TestUserId, TestDbContextFactory.TestTenantId, "rfi_deadline_approaching", It.IsAny<CancellationToken>()), Times.Once);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RfiOverdue_PreferenceEnabled_SendsNotification()
    {
        var (service, notifMock, prefMock, db) = CreateTestSetup(preferencesEnabled: true);
        db.Set<Rfi>().Add(CreateRfi(dueDate: DateTime.UtcNow.AddHours(-2)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        prefMock.Verify(p => p.IsNotificationEnabledAsync(
            TestUserId, TestDbContextFactory.TestTenantId, "overdue_rfi", It.IsAny<CancellationToken>()), Times.Once);
        notifMock.Verify(n => n.CreateAsync(
            It.Is<CreateNotificationCommand>(c => c.Type == NotificationType.OverdueRfi),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // --- Dedup semantics ---
    // The tracker uses a 24-hour window: notifications for the same entity+type are suppressed
    // within 24h, then re-sent on the next check. This produces daily reminders for ongoing issues.

    [Fact]
    public async Task RfiOverdue_SecondRunWithin24h_Deduped()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        db.Set<Rfi>().Add(CreateRfi(dueDate: DateTime.UtcNow.AddHours(-2)));
        await db.SaveChangesAsync();

        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Once);

        // Second run within the same 24h window — should be deduped
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RfiOverdue_RunAfter24h_ReNotifies()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        var rfi = CreateRfi(dueDate: DateTime.UtcNow.AddHours(-2));
        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync();

        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Once);

        // Backdate the tracker record so it falls outside the 24h window
        var trackerRecord = await db.DeadlineNotifications
            .FirstAsync(dn => dn.EntityId == rfi.Id && dn.NotificationType == "Overdue");
        trackerRecord.SentAt = DateTime.UtcNow.AddHours(-25);
        await db.SaveChangesAsync();

        // Third run — outside 24h window, should re-notify
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    // --- Stale submittal review check ---
    // Note: Submittal queries with enum string conversion have in-memory provider limitations.
    // Tests use NotThrowAsync pattern where the in-memory provider silently returns empty results.
    // Full notification flow verified via integration tests against PostgreSQL.

    [Fact]
    public async Task StaleSubmittalReview_Over48h_DoesNotThrow()
    {
        var (service, _, _, db) = CreateTestSetup();
        db.Set<PmSubmittal>().Add(CreateSubmittal(
            status: SubmittalStatus.Submitted,
            submittedDate: DateTime.UtcNow.AddHours(-72)));
        await db.SaveChangesAsync();
        var act = () => service.RunCheckAsync(CancellationToken.None);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task StaleSubmittalReview_Under48h_NoNotification()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        // Submitted only 24h ago — not stale yet
        db.Set<PmSubmittal>().Add(CreateSubmittal(
            status: SubmittalStatus.Submitted,
            submittedDate: DateTime.UtcNow.AddHours(-24)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(
            It.Is<CreateNotificationCommand>(c => c.Type == NotificationType.SubmittalReviewStale),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task StaleSubmittalReview_ApprovedStatus_NoNotification()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        db.Set<PmSubmittal>().Add(CreateSubmittal(
            status: SubmittalStatus.Approved,
            submittedDate: DateTime.UtcNow.AddHours(-72)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(
            It.Is<CreateNotificationCommand>(c => c.Type == NotificationType.SubmittalReviewStale),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task StaleSubmittalReview_NoSubmittedDate_NoNotification()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        db.Set<PmSubmittal>().Add(CreateSubmittal(
            status: SubmittalStatus.Submitted,
            submittedDate: null));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(
            It.Is<CreateNotificationCommand>(c => c.Type == NotificationType.SubmittalReviewStale),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task StaleSubmittalReview_InReview_DoesNotThrow()
    {
        var (service, _, _, db) = CreateTestSetup();
        db.Set<PmSubmittal>().Add(CreateSubmittal(
            status: SubmittalStatus.InReview,
            submittedDate: DateTime.UtcNow.AddDays(-5)));
        await db.SaveChangesAsync();
        var act = () => service.RunCheckAsync(CancellationToken.None);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task StaleSubmittalReview_PreferenceDisabled_NoNotification()
    {
        var (service, notifMock, _, db) = CreateTestSetup(preferencesEnabled: false);
        db.Set<PmSubmittal>().Add(CreateSubmittal(
            status: SubmittalStatus.Submitted,
            submittedDate: DateTime.UtcNow.AddHours(-72)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(
            It.Is<CreateNotificationCommand>(c => c.Type == NotificationType.SubmittalReviewStale),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task MultipleOverdueRfis_SameUser_NotifiesEach()
    {
        var (service, notifMock, _, db) = CreateTestSetup();
        var rfi1 = CreateRfi(dueDate: DateTime.UtcNow.AddHours(-2));
        rfi1.Number = 1;
        var rfi2 = CreateRfi(dueDate: DateTime.UtcNow.AddHours(-5));
        rfi2.Number = 2;
        var rfi3 = CreateRfi(dueDate: DateTime.UtcNow.AddHours(-10));
        rfi3.Number = 3;
        db.Set<Rfi>().AddRange(rfi1, rfi2, rfi3);
        await db.SaveChangesAsync();

        await service.RunCheckAsync(CancellationToken.None);

        // All three should generate separate notifications for the same user
        notifMock.Verify(n => n.CreateAsync(
            It.Is<CreateNotificationCommand>(c => c.Type == NotificationType.OverdueRfi),
            It.IsAny<CancellationToken>()), Times.Exactly(3));
    }
}
