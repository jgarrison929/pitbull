using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.GetPaymentApplication;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetPaymentApplicationHandlerTests
{
    private static async Task<PaymentApplication> CreateTestPaymentApplication(PitbullDbContext db)
    {
        var payApp = new PaymentApplication
        {
            Id = Guid.NewGuid(),
            SubcontractId = Guid.NewGuid(),
            ApplicationNumber = 1,
            PeriodStart = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            ScheduledValue = 100000m,
            WorkCompletedPrevious = 0m,
            WorkCompletedThisPeriod = 25000m,
            WorkCompletedToDate = 25000m,
            StoredMaterials = 5000m,
            TotalCompletedAndStored = 30000m,
            RetainagePercent = 10m,
            RetainageThisPeriod = 2500m,
            RetainagePrevious = 0m,
            TotalRetainage = 2500m,
            TotalEarnedLessRetainage = 27500m,
            LessPreviousCertificates = 0m,
            CurrentPaymentDue = 27500m,
            Status = PaymentApplicationStatus.Draft,
            InvoiceNumber = "INV-001",
            Notes = "Test pay app"
        };
        db.Set<PaymentApplication>().Add(payApp);
        await db.SaveChangesAsync();
        return payApp;
    }

    [Fact]
    public async Task Handle_ExistingPaymentApplication_ReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var payApp = await CreateTestPaymentApplication(db);
        var handler = new GetPaymentApplicationHandler(db);
        var query = new GetPaymentApplicationQuery(payApp.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(payApp.Id);
        result.Value.ApplicationNumber.Should().Be(1);
        result.Value.WorkCompletedThisPeriod.Should().Be(25000m);
        result.Value.CurrentPaymentDue.Should().Be(27500m);
        result.Value.Status.Should().Be(PaymentApplicationStatus.Draft);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetPaymentApplicationHandler(db);
        var query = new GetPaymentApplicationQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ApprovedPayApp_ReturnsApprovalDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var payApp = new PaymentApplication
        {
            Id = Guid.NewGuid(),
            SubcontractId = Guid.NewGuid(),
            ApplicationNumber = 2,
            PeriodStart = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            ScheduledValue = 100000m,
            WorkCompletedThisPeriod = 30000m,
            WorkCompletedToDate = 55000m,
            TotalCompletedAndStored = 55000m,
            RetainagePercent = 10m,
            TotalRetainage = 5500m,
            TotalEarnedLessRetainage = 49500m,
            LessPreviousCertificates = 27500m,
            CurrentPaymentDue = 22000m,
            Status = PaymentApplicationStatus.Approved,
            SubmittedDate = new DateTime(2026, 2, 25, 0, 0, 0, DateTimeKind.Utc),
            ApprovedDate = new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            ApprovedBy = "Project Manager",
            ApprovedAmount = 22000m
        };
        db.Set<PaymentApplication>().Add(payApp);
        await db.SaveChangesAsync();

        var handler = new GetPaymentApplicationHandler(db);
        var query = new GetPaymentApplicationQuery(payApp.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Approved);
        result.Value.ApprovedDate.Should().Be(new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc));
        result.Value.ApprovedBy.Should().Be("Project Manager");
        result.Value.ApprovedAmount.Should().Be(22000m);
    }

    [Fact]
    public async Task Handle_PaidPayApp_ReturnsPaidDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var payApp = new PaymentApplication
        {
            Id = Guid.NewGuid(),
            SubcontractId = Guid.NewGuid(),
            ApplicationNumber = 3,
            PeriodStart = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2026, 3, 31, 0, 0, 0, DateTimeKind.Utc),
            ScheduledValue = 100000m,
            WorkCompletedThisPeriod = 45000m,
            WorkCompletedToDate = 100000m,
            TotalCompletedAndStored = 100000m,
            RetainagePercent = 10m,
            TotalRetainage = 10000m,
            TotalEarnedLessRetainage = 90000m,
            LessPreviousCertificates = 49500m,
            CurrentPaymentDue = 40500m,
            Status = PaymentApplicationStatus.Paid,
            SubmittedDate = new DateTime(2026, 3, 25, 0, 0, 0, DateTimeKind.Utc),
            ApprovedDate = new DateTime(2026, 3, 28, 0, 0, 0, DateTimeKind.Utc),
            PaidDate = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc),
            ApprovedBy = "CFO",
            ApprovedAmount = 40500m,
            CheckNumber = "CHK-12345"
        };
        db.Set<PaymentApplication>().Add(payApp);
        await db.SaveChangesAsync();

        var handler = new GetPaymentApplicationHandler(db);
        var query = new GetPaymentApplicationQuery(payApp.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Paid);
        result.Value.PaidDate.Should().Be(new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc));
        result.Value.CheckNumber.Should().Be("CHK-12345");
    }
}
