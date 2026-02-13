using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.ListPaymentApplications;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ListPaymentApplicationsHandlerTests
{
    private static async Task SeedPaymentApplications(PitbullDbContext db, Guid subcontractId)
    {
        var payApps = new[]
        {
            new PaymentApplication
            {
                Id = Guid.NewGuid(),
                SubcontractId = subcontractId,
                ApplicationNumber = 1,
                PeriodStart = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                PeriodEnd = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
                ScheduledValue = 100000m,
                WorkCompletedThisPeriod = 25000m,
                WorkCompletedToDate = 25000m,
                CurrentPaymentDue = 22500m,
                Status = PaymentApplicationStatus.Paid,
                CreatedAt = DateTime.UtcNow.AddDays(-60)
            },
            new PaymentApplication
            {
                Id = Guid.NewGuid(),
                SubcontractId = subcontractId,
                ApplicationNumber = 2,
                PeriodStart = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
                PeriodEnd = new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
                ScheduledValue = 100000m,
                WorkCompletedThisPeriod = 30000m,
                WorkCompletedToDate = 55000m,
                CurrentPaymentDue = 27000m,
                Status = PaymentApplicationStatus.Approved,
                CreatedAt = DateTime.UtcNow.AddDays(-30)
            },
            new PaymentApplication
            {
                Id = Guid.NewGuid(),
                SubcontractId = subcontractId,
                ApplicationNumber = 3,
                PeriodStart = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                PeriodEnd = new DateTime(2026, 3, 31, 0, 0, 0, DateTimeKind.Utc),
                ScheduledValue = 100000m,
                WorkCompletedThisPeriod = 20000m,
                WorkCompletedToDate = 75000m,
                CurrentPaymentDue = 18000m,
                Status = PaymentApplicationStatus.Draft,
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            }
        };

        db.Set<PaymentApplication>().AddRange(payApps);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Handle_ReturnsAllPaymentApplications()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedPaymentApplications(db, subcontractId);
        var handler = new ListPaymentApplicationsHandler(db);
        var query = new ListPaymentApplicationsQuery(null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(3);
        result.Value.Items.Should().HaveCount(3);
    }

    [Fact]
    public async Task Handle_FilterBySubcontract_ReturnsMatchingOnly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId1 = Guid.NewGuid();
        var subcontractId2 = Guid.NewGuid();
        await SeedPaymentApplications(db, subcontractId1);

        // Add one for different subcontract
        db.Set<PaymentApplication>().Add(new PaymentApplication
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontractId2,
            ApplicationNumber = 1,
            PeriodStart = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            ScheduledValue = 50000m,
            CurrentPaymentDue = 10000m,
            Status = PaymentApplicationStatus.Draft
        });
        await db.SaveChangesAsync();

        var handler = new ListPaymentApplicationsHandler(db);
        var query = new ListPaymentApplicationsQuery(subcontractId1, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(3);
        result.Value.Items.Should().OnlyContain(pa => pa.SubcontractId == subcontractId1);
    }

    [Fact]
    public async Task Handle_FilterByStatus_ReturnsMatchingOnly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedPaymentApplications(db, subcontractId);
        var handler = new ListPaymentApplicationsHandler(db);
        var query = new ListPaymentApplicationsQuery(null, PaymentApplicationStatus.Draft);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().Status.Should().Be(PaymentApplicationStatus.Draft);
        result.Value.Items.Single().ApplicationNumber.Should().Be(3);
    }

    [Fact]
    public async Task Handle_Pagination_ReturnsCorrectPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedPaymentApplications(db, subcontractId);
        var handler = new ListPaymentApplicationsHandler(db);
        var query = new ListPaymentApplicationsQuery(null, null, Page: 1, PageSize: 2);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(3);
        result.Value.Items.Should().HaveCount(2);
        result.Value.Page.Should().Be(1);
        result.Value.PageSize.Should().Be(2);
    }

    [Fact]
    public async Task Handle_OrdersByApplicationNumberDescending()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedPaymentApplications(db, subcontractId);
        var handler = new ListPaymentApplicationsHandler(db);
        var query = new ListPaymentApplicationsQuery(subcontractId, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var items = result.Value!.Items.ToList();
        items[0].ApplicationNumber.Should().Be(3);
        items[1].ApplicationNumber.Should().Be(2);
        items[2].ApplicationNumber.Should().Be(1);
    }

    [Fact]
    public async Task Handle_EmptyDatabase_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ListPaymentApplicationsHandler(db);
        var query = new ListPaymentApplicationsQuery(null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(0);
        result.Value.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_CombinedFilters_ReturnsCorrectResults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedPaymentApplications(db, subcontractId);
        var handler = new ListPaymentApplicationsHandler(db);
        var query = new ListPaymentApplicationsQuery(subcontractId, PaymentApplicationStatus.Paid);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().ApplicationNumber.Should().Be(1);
        result.Value.Items.Single().Status.Should().Be(PaymentApplicationStatus.Paid);
    }

    [Fact]
    public async Task Handle_SecondPage_ReturnsCorrectItems()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedPaymentApplications(db, subcontractId);
        var handler = new ListPaymentApplicationsHandler(db);
        var query = new ListPaymentApplicationsQuery(null, null, Page: 2, PageSize: 2);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(3);
        result.Value.Items.Should().HaveCount(1); // Only 1 item on page 2
        result.Value.Page.Should().Be(2);
    }
}
