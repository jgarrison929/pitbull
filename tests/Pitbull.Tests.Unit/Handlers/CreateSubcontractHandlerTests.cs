using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class CreateSubcontractHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesSubcontractAndReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateSubcontractHandler(db);
        var command = new CreateSubcontractCommand(
            ProjectId: Guid.NewGuid(),
            SubcontractNumber: "SC-2026-001",
            SubcontractorName: "ABC Concrete Inc",
            SubcontractorContact: "John Smith",
            SubcontractorEmail: "john@abcconcrete.com",
            SubcontractorPhone: "555-1234",
            SubcontractorAddress: "123 Main St",
            ScopeOfWork: "Concrete foundations and footings",
            TradeCode: "03 - Concrete",
            OriginalValue: 150000m,
            RetainagePercent: 10m,
            StartDate: new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            CompletionDate: new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc),
            LicenseNumber: "CON-12345",
            Notes: "Standard concrete subcontract"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.SubcontractNumber.Should().Be("SC-2026-001");
        result.Value.SubcontractorName.Should().Be("ABC Concrete Inc");
        result.Value.Status.Should().Be(SubcontractStatus.Draft);
        result.Value.OriginalValue.Should().Be(150000m);
        result.Value.CurrentValue.Should().Be(150000m); // Same as original initially
        result.Value.RetainagePercent.Should().Be(10m);
        result.Value.BilledToDate.Should().Be(0m);
        result.Value.PaidToDate.Should().Be(0m);
    }

    [Fact]
    public async Task Handle_DuplicateNumber_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateSubcontractHandler(db);

        // Create first subcontract
        var first = new CreateSubcontractCommand(
            ProjectId: Guid.NewGuid(),
            SubcontractNumber: "SC-DUP-001",
            SubcontractorName: "First Sub",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "First scope",
            TradeCode: null,
            OriginalValue: 100000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null
        );
        await handler.Handle(first, CancellationToken.None);

        // Try to create duplicate
        var duplicate = first with { SubcontractorName = "Second Sub" };

        // Act
        var result = await handler.Handle(duplicate, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_NUMBER");
    }

    [Fact]
    public async Task Handle_MinimalCommand_CreatesSubcontractWithDefaults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateSubcontractHandler(db);
        var command = new CreateSubcontractCommand(
            ProjectId: Guid.NewGuid(),
            SubcontractNumber: "SC-MIN-001",
            SubcontractorName: "Minimal Sub LLC",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Basic scope of work",
            TradeCode: null,
            OriginalValue: 50000m,
            RetainagePercent: 0m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(SubcontractStatus.Draft);
        result.Value.InsuranceCurrent.Should().BeFalse();
        result.Value.RetainageHeld.Should().Be(0m);
    }

    [Fact]
    public async Task Handle_ValidCommand_PersistsToDatabase()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateSubcontractHandler(db);
        var command = new CreateSubcontractCommand(
            ProjectId: Guid.NewGuid(),
            SubcontractNumber: "SC-PERSIST-001",
            SubcontractorName: "Persist Test Sub",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Persistence test",
            TradeCode: null,
            OriginalValue: 75000m,
            RetainagePercent: 5m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert - verify persisted
        var persisted = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == result.Value!.Id);
        persisted.Should().NotBeNull();
        persisted!.SubcontractNumber.Should().Be("SC-PERSIST-001");
        persisted.OriginalValue.Should().Be(75000m);
    }
}
