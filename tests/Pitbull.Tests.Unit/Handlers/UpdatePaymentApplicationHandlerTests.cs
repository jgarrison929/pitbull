using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class UpdatePaymentApplicationHandlerTests
{
    private static async Task<(Subcontract subcontract, PaymentApplication payApp)> CreateTestData(PitbullDbContext db)
    {
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            SubcontractNumber = "SC-TEST-001",
            SubcontractorName = "Test Subcontractor",
            ScopeOfWork = "Test scope",
            OriginalValue = 100000m,
            CurrentValue = 100000m,
            BilledToDate = 0m,
            PaidToDate = 0m,
            RetainagePercent = 10m,
            RetainageHeld = 0m,
            Status = SubcontractStatus.Executed
        };
        db.Set<Subcontract>().Add(subcontract);

        var payApp = new PaymentApplication
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontract.Id,
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
            Status = PaymentApplicationStatus.Draft
        };
        db.Set<PaymentApplication>().Add(payApp);
        await db.SaveChangesAsync();

        return (subcontract, payApp);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            Guid.NewGuid(),
            25000m,
            5000m,
            PaymentApplicationStatus.Draft,
            null, null, null, null, null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_UpdateWorkAmount_RecalculatesTotals()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, payApp) = await CreateTestData(db);
        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            payApp.Id,
            30000m,  // increased from 25000
            8000m,   // increased from 5000
            PaymentApplicationStatus.Draft,
            null, null, null, null, null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.WorkCompletedThisPeriod.Should().Be(30000m);
        result.Value.StoredMaterials.Should().Be(8000m);
        result.Value.WorkCompletedToDate.Should().Be(30000m); // previous (0) + this period
        result.Value.TotalCompletedAndStored.Should().Be(38000m); // 30000 + 8000
    }

    [Fact]
    public async Task Handle_StatusToSubmitted_SetsSubmittedDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, payApp) = await CreateTestData(db);
        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            payApp.Id,
            payApp.WorkCompletedThisPeriod,
            payApp.StoredMaterials,
            PaymentApplicationStatus.Submitted,
            null, null, null, null, null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Submitted);
        result.Value.SubmittedDate.Should().NotBeNull();
        result.Value.SubmittedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Handle_StatusToApproved_SetsApprovedDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, payApp) = await CreateTestData(db);
        payApp.Status = PaymentApplicationStatus.Submitted;
        payApp.SubmittedDate = DateTime.UtcNow.AddDays(-2);
        await db.SaveChangesAsync();

        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            payApp.Id,
            payApp.WorkCompletedThisPeriod,
            payApp.StoredMaterials,
            PaymentApplicationStatus.Approved,
            "Project Manager",
            27500m,
            "INV-001",
            null, null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Approved);
        result.Value.ApprovedDate.Should().NotBeNull();
        result.Value.ApprovedBy.Should().Be("Project Manager");
        result.Value.ApprovedAmount.Should().Be(27500m);
    }

    [Fact]
    public async Task Handle_StatusToPaid_UpdatesSubcontractTotals()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (subcontract, payApp) = await CreateTestData(db);
        payApp.Status = PaymentApplicationStatus.Approved;
        payApp.ApprovedDate = DateTime.UtcNow.AddDays(-1);
        await db.SaveChangesAsync();

        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            payApp.Id,
            payApp.WorkCompletedThisPeriod,
            payApp.StoredMaterials,
            PaymentApplicationStatus.Paid,
            "CFO",
            27500m,
            "INV-001",
            "CHK-12345",
            null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Paid);
        result.Value.PaidDate.Should().NotBeNull();
        result.Value.CheckNumber.Should().Be("CHK-12345");

        // Verify subcontract totals updated
        var updatedSubcontract = await db.Set<Subcontract>().FindAsync(subcontract.Id);
        updatedSubcontract!.BilledToDate.Should().Be(27500m);
        updatedSubcontract.PaidToDate.Should().Be(27500m);
        updatedSubcontract.RetainageHeld.Should().Be(2500m);
    }

    [Fact]
    public async Task Handle_PartiallyApproved_SetsApprovalDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, payApp) = await CreateTestData(db);
        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            payApp.Id,
            payApp.WorkCompletedThisPeriod,
            payApp.StoredMaterials,
            PaymentApplicationStatus.PartiallyApproved,
            "Finance Director",
            20000m, // less than current payment due
            null, null,
            "Adjusted for disputed work"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.PartiallyApproved);
        result.Value.ApprovedAmount.Should().Be(20000m);
        result.Value.Notes.Should().Be("Adjusted for disputed work");
    }

    [Fact]
    public async Task Handle_UpdateNotes_Succeeds()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, payApp) = await CreateTestData(db);
        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            payApp.Id,
            payApp.WorkCompletedThisPeriod,
            payApp.StoredMaterials,
            payApp.Status,
            null, null,
            "INV-2026-001",
            null,
            "Updated notes"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.InvoiceNumber.Should().Be("INV-2026-001");
        result.Value.Notes.Should().Be("Updated notes");
    }

    [Fact]
    public async Task Handle_AlreadyPaid_SyncsAmountDelta()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (subcontract, payApp) = await CreateTestData(db);

        // Set initial paid state
        payApp.Status = PaymentApplicationStatus.Paid;
        payApp.ApprovedAmount = 27500m;
        subcontract.BilledToDate = 27500m;
        subcontract.PaidToDate = 27500m;
        subcontract.RetainageHeld = 2500m;
        await db.SaveChangesAsync();

        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            payApp.Id,
            payApp.WorkCompletedThisPeriod,
            payApp.StoredMaterials,
            PaymentApplicationStatus.Paid, // same status
            payApp.ApprovedBy,
            30000m, // increased approved amount
            payApp.InvoiceNumber,
            payApp.CheckNumber,
            payApp.Notes
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ApprovedAmount.Should().Be(30000m);

        // Verify delta applied to subcontract
        var updatedSubcontract = await db.Set<Subcontract>().FindAsync(subcontract.Id);
        updatedSubcontract!.PaidToDate.Should().Be(30000m); // 27500 + (30000-27500) delta
    }

    [Fact]
    public async Task Handle_SubcontractNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();

        // Create pay app without subcontract
        var payApp = new PaymentApplication
        {
            Id = Guid.NewGuid(),
            SubcontractId = Guid.NewGuid(), // non-existent
            ApplicationNumber = 1,
            PeriodStart = DateTime.UtcNow,
            PeriodEnd = DateTime.UtcNow,
            ScheduledValue = 100000m,
            WorkCompletedThisPeriod = 25000m,
            CurrentPaymentDue = 22500m,
            Status = PaymentApplicationStatus.Draft
        };
        db.Set<PaymentApplication>().Add(payApp);
        await db.SaveChangesAsync();

        var handler = new UpdatePaymentApplicationHandler(db);
        var command = new UpdatePaymentApplicationCommand(
            payApp.Id,
            25000m,
            5000m,
            PaymentApplicationStatus.Draft,
            null, null, null, null, null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("SUBCONTRACT_NOT_FOUND");
    }
}
