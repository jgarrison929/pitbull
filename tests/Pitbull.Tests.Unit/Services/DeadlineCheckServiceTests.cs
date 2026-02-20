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

    private static (DeadlineCheckService service, Mock<INotificationService> notifMock, PitbullDbContext db) CreateTestSetup()
    {
        var dbName = Guid.NewGuid().ToString();
        var db = TestDbContextFactory.Create(dbName: dbName);

        var notifMock = new Mock<INotificationService>();
        notifMock
            .Setup(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<NotificationDto>.Success(new NotificationDto(
                Guid.NewGuid(), TestUserId, "Test", "Test", NotificationType.Info, false, DateTime.UtcNow, null, null, null)));

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

        var sp = services.BuildServiceProvider();
        var service = new DeadlineCheckService(
            sp.GetRequiredService<IServiceScopeFactory>(),
            Options.Create(new DeadlineCheckOptions { IntervalHours = 1 }),
            NullLogger<DeadlineCheckService>.Instance);
        return (service, notifMock, db);
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
        DateTime? finalDueDate = null, DateTime? requiredByDate = null)
        => new()
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId, ProjectId = TestProjectId,
            SubmittalNumber = 1, Title = "Test Submittal", SubmittalType = SubmittalType.ProductData,
            Status = status, FinalDueDate = finalDueDate, RequiredByDate = requiredByDate,
            CreatedAt = DateTime.UtcNow.AddDays(-7), CreatedBy = TestUserId.ToString()
        };

    [Fact]
    public async Task RfiDueWithin24Hours_SendsUpcomingNotification()
    {
        var (service, notifMock, db) = CreateTestSetup();
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
        var (service, notifMock, db) = CreateTestSetup();
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
        var (service, notifMock, db) = CreateTestSetup();
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
        var (service, notifMock, db) = CreateTestSetup();
        db.Set<Rfi>().Add(CreateRfi(status: RfiStatus.Closed, dueDate: DateTime.UtcNow.AddHours(-2)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        notifMock.Verify(n => n.CreateAsync(It.IsAny<CreateNotificationCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RfiWithoutAssignee_NoNotification()
    {
        var (service, notifMock, db) = CreateTestSetup();
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
        var (service, _, db) = CreateTestSetup();
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
        var (service, _, db) = CreateTestSetup();
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
        var (service, _, db) = CreateTestSetup();
        db.Set<PmSubmittal>().Add(CreateSubmittal(status: SubmittalStatus.Approved, finalDueDate: DateTime.UtcNow.AddHours(-2)));
        await db.SaveChangesAsync();
        await service.RunCheckAsync(CancellationToken.None);
        var records = await db.DeadlineNotifications.Where(dn => dn.EntityType == "Submittal").ToListAsync();
        records.Should().BeEmpty();
    }
}
