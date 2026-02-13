using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class CreateChangeOrderHandlerTests
{
    private static async Task<Subcontract> CreateTestSubcontract(PitbullDbContext db)
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
            RetainagePercent = 10m,
            Status = SubcontractStatus.Executed
        };
        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync();
        return subcontract;
    }

    [Fact]
    public async Task Handle_ValidCommand_CreatesChangeOrderAndReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db);
        var handler = new CreateChangeOrderHandler(db);
        var command = new CreateChangeOrderCommand(
            SubcontractId: subcontract.Id,
            ChangeOrderNumber: "CO-001",
            Title: "Additional Foundation Work",
            Description: "Extended footings required due to soil conditions",
            Reason: "Field condition",
            Amount: 15000m,
            DaysExtension: 5,
            ReferenceNumber: "OWNER-CO-001"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.ChangeOrderNumber.Should().Be("CO-001");
        result.Value.Title.Should().Be("Additional Foundation Work");
        result.Value.Amount.Should().Be(15000m);
        result.Value.DaysExtension.Should().Be(5);
        result.Value.Status.Should().Be(ChangeOrderStatus.Pending);
        result.Value.SubmittedDate.Should().NotBeNull();
    }

    [Fact]
    public async Task Handle_NegativeAmount_CreatesDeductiveChangeOrder()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db);
        var handler = new CreateChangeOrderHandler(db);
        var command = new CreateChangeOrderCommand(
            SubcontractId: subcontract.Id,
            ChangeOrderNumber: "CO-DEDUCT-001",
            Title: "Scope Reduction",
            Description: "Owner deleted alternate bid item",
            Reason: "Owner request",
            Amount: -5000m,
            DaysExtension: null,
            ReferenceNumber: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Amount.Should().Be(-5000m);
    }

    [Fact]
    public async Task Handle_SubcontractNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateChangeOrderHandler(db);
        var command = new CreateChangeOrderCommand(
            SubcontractId: Guid.NewGuid(), // Non-existent
            ChangeOrderNumber: "CO-001",
            Title: "Test",
            Description: "Test description",
            Reason: null,
            Amount: 1000m,
            DaysExtension: null,
            ReferenceNumber: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("SUBCONTRACT_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_DuplicateCONumber_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db);
        var handler = new CreateChangeOrderHandler(db);

        // Create first CO
        var first = new CreateChangeOrderCommand(
            SubcontractId: subcontract.Id,
            ChangeOrderNumber: "CO-DUP-001",
            Title: "First CO",
            Description: "First change order",
            Reason: null,
            Amount: 5000m,
            DaysExtension: null,
            ReferenceNumber: null
        );
        await handler.Handle(first, CancellationToken.None);

        // Try to create duplicate
        var duplicate = first with { Title = "Second CO" };

        // Act
        var result = await handler.Handle(duplicate, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CO_NUMBER");
    }

    [Fact]
    public async Task Handle_ValidCommand_PersistsToDatabase()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db);
        var handler = new CreateChangeOrderHandler(db);
        var command = new CreateChangeOrderCommand(
            SubcontractId: subcontract.Id,
            ChangeOrderNumber: "CO-PERSIST-001",
            Title: "Persist Test",
            Description: "Testing database persistence",
            Reason: "Test",
            Amount: 7500m,
            DaysExtension: 3,
            ReferenceNumber: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert - verify persisted
        var persisted = await db.Set<ChangeOrder>()
            .FirstOrDefaultAsync(co => co.Id == result.Value!.Id);
        persisted.Should().NotBeNull();
        persisted!.ChangeOrderNumber.Should().Be("CO-PERSIST-001");
        persisted.Amount.Should().Be(7500m);
        persisted.SubcontractId.Should().Be(subcontract.Id);
    }
}
