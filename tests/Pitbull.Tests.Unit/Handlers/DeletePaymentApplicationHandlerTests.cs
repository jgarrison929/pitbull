using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.DeletePaymentApplication;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class DeletePaymentApplicationHandlerTests
{
    private static async Task<(Subcontract sub, PaymentApplication pa)> CreateTestData(PitbullDbContext db, PaymentApplicationStatus status = PaymentApplicationStatus.Draft)
    {
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            SubcontractNumber = "SC-DEL-PA-001",
            SubcontractorName = "Test Sub",
            ScopeOfWork = "Test scope",
            OriginalValue = 100000m,
            CurrentValue = 100000m,
            RetainagePercent = 10m,
            Status = SubcontractStatus.Executed
        };
        db.Set<Subcontract>().Add(subcontract);

        var payApp = new PaymentApplication
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontract.Id,
            ApplicationNumber = 1,
            PeriodStart = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            ScheduledValue = 100000m,
            WorkCompletedThisPeriod = 25000m,
            WorkCompletedToDate = 25000m,
            TotalCompletedAndStored = 25000m,
            RetainagePercent = 10m,
            RetainageThisPeriod = 2500m,
            TotalRetainage = 2500m,
            TotalEarnedLessRetainage = 22500m,
            CurrentPaymentDue = 22500m,
            Status = status
        };
        db.Set<PaymentApplication>().Add(payApp);
        await db.SaveChangesAsync();

        return (subcontract, payApp);
    }

    [Fact]
    public async Task Handle_DraftPaymentApplication_SoftDeletesSuccessfully()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, pa) = await CreateTestData(db, PaymentApplicationStatus.Draft);
        var handler = new DeletePaymentApplicationHandler(db);
        var command = new DeletePaymentApplicationCommand(pa.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        // Query filter excludes soft-deleted, so check raw
        var deleted = await db.Set<PaymentApplication>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == pa.Id);
        deleted.Should().NotBeNull();
        deleted!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new DeletePaymentApplicationHandler(db);
        var command = new DeletePaymentApplicationCommand(Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ApprovedPaymentApplication_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, pa) = await CreateTestData(db, PaymentApplicationStatus.Approved);
        var handler = new DeletePaymentApplicationHandler(db);
        var command = new DeletePaymentApplicationCommand(pa.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Handle_PaidPaymentApplication_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, pa) = await CreateTestData(db, PaymentApplicationStatus.Paid);
        var handler = new DeletePaymentApplicationHandler(db);
        var command = new DeletePaymentApplicationCommand(pa.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }
}
