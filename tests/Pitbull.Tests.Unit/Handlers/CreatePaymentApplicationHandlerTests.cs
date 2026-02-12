using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class CreatePaymentApplicationHandlerTests
{
    private async Task<Subcontract> CreateTestSubcontract(PitbullDbContext db, decimal value = 100000m, decimal retainagePercent = 10m)
    {
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            SubcontractNumber = $"SC-TEST-{Guid.NewGuid():N}".Substring(0, 20),
            SubcontractorName = "Test Subcontractor",
            ScopeOfWork = "Test scope",
            OriginalValue = value,
            CurrentValue = value,
            RetainagePercent = retainagePercent,
            Status = SubcontractStatus.Executed
        };
        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync();
        return subcontract;
    }

    [Fact]
    public async Task Handle_FirstApplication_CreatesWithCorrectCalculations()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db, 100000m, 10m);
        var handler = new CreatePaymentApplicationHandler(db);
        var command = new CreatePaymentApplicationCommand(
            SubcontractId: subcontract.Id,
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 25000m,
            StoredMaterials: 5000m,
            InvoiceNumber: "INV-001",
            Notes: "First billing period"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.ApplicationNumber.Should().Be(1);
        result.Value.WorkCompletedPrevious.Should().Be(0m);
        result.Value.WorkCompletedThisPeriod.Should().Be(25000m);
        result.Value.WorkCompletedToDate.Should().Be(25000m);
        result.Value.StoredMaterials.Should().Be(5000m);
        result.Value.TotalCompletedAndStored.Should().Be(30000m);
        result.Value.RetainagePercent.Should().Be(10m);
        result.Value.RetainageThisPeriod.Should().Be(2500m); // 10% of 25000
        result.Value.TotalRetainage.Should().Be(2500m);
        result.Value.TotalEarnedLessRetainage.Should().Be(27500m); // 30000 - 2500
        result.Value.LessPreviousCertificates.Should().Be(0m);
        result.Value.CurrentPaymentDue.Should().Be(27500m);
        result.Value.Status.Should().Be(PaymentApplicationStatus.Draft);
    }

    [Fact]
    public async Task Handle_SecondApplication_CalculatesFromPrevious()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db, 100000m, 10m);
        var handler = new CreatePaymentApplicationHandler(db);

        // Create first application
        var first = new CreatePaymentApplicationCommand(
            SubcontractId: subcontract.Id,
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 25000m,
            StoredMaterials: 0m,
            InvoiceNumber: "INV-001",
            Notes: null
        );
        await handler.Handle(first, CancellationToken.None);

        // Create second application
        var second = new CreatePaymentApplicationCommand(
            SubcontractId: subcontract.Id,
            PeriodStart: new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 3, 31, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 30000m,
            StoredMaterials: 0m,
            InvoiceNumber: "INV-002",
            Notes: null
        );

        // Act
        var result = await handler.Handle(second, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ApplicationNumber.Should().Be(2);
        result.Value.WorkCompletedPrevious.Should().Be(25000m);
        result.Value.WorkCompletedToDate.Should().Be(55000m); // 25000 + 30000
        result.Value.RetainagePrevious.Should().Be(2500m);
        result.Value.RetainageThisPeriod.Should().Be(3000m); // 10% of 30000
        result.Value.TotalRetainage.Should().Be(5500m); // 2500 + 3000
    }

    [Fact]
    public async Task Handle_SubcontractNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreatePaymentApplicationHandler(db);
        var command = new CreatePaymentApplicationCommand(
            SubcontractId: Guid.NewGuid(), // Non-existent
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 10000m,
            StoredMaterials: 0m,
            InvoiceNumber: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("SUBCONTRACT_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ZeroRetainage_CalculatesCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db, 50000m, 0m); // No retainage
        var handler = new CreatePaymentApplicationHandler(db);
        var command = new CreatePaymentApplicationCommand(
            SubcontractId: subcontract.Id,
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 20000m,
            StoredMaterials: 0m,
            InvoiceNumber: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.RetainageThisPeriod.Should().Be(0m);
        result.Value.TotalRetainage.Should().Be(0m);
        result.Value.CurrentPaymentDue.Should().Be(20000m);
    }

    [Fact]
    public async Task Handle_ValidCommand_PersistsToDatabase()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db);
        var handler = new CreatePaymentApplicationHandler(db);
        var command = new CreatePaymentApplicationCommand(
            SubcontractId: subcontract.Id,
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 15000m,
            StoredMaterials: 2000m,
            InvoiceNumber: "INV-PERSIST",
            Notes: "Persist test"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert - verify persisted
        var persisted = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == result.Value!.Id);
        persisted.Should().NotBeNull();
        persisted!.ApplicationNumber.Should().Be(1);
        persisted.WorkCompletedThisPeriod.Should().Be(15000m);
        persisted.InvoiceNumber.Should().Be("INV-PERSIST");
    }
}
