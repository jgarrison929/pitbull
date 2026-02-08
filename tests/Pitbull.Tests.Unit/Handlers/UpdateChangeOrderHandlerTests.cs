using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class UpdateChangeOrderHandlerTests
{
    private async Task<ChangeOrder> CreateTestChangeOrder(PitbullDbContext db, Guid? subcontractId = null)
    {
        var changeOrder = new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontractId ?? Guid.NewGuid(),
            ChangeOrderNumber = "CO-UPDATE-001",
            Title = "Original Title",
            Description = "Original description",
            Reason = "Original reason",
            Amount = 10000m,
            DaysExtension = 3,
            Status = ChangeOrderStatus.Pending,
            SubmittedDate = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            ReferenceNumber = "REF-001"
        };
        db.Set<ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();
        return changeOrder;
    }

    private UpdateChangeOrderCommand CreateValidCommand(ChangeOrder co)
    {
        return new UpdateChangeOrderCommand(
            co.Id,
            co.ChangeOrderNumber,
            co.Title,
            co.Description,
            co.Reason,
            co.Amount,
            co.DaysExtension,
            co.Status,
            co.ReferenceNumber
        );
    }

    [Fact]
    public async Task Handle_ValidUpdate_UpdatesAllFields()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = await CreateTestChangeOrder(db);
        var handler = new UpdateChangeOrderHandler(db);
        var command = new UpdateChangeOrderCommand(
            changeOrder.Id,
            "CO-UPDATE-002",
            "Updated Title",
            "Updated description",
            "Updated reason",
            15000m,
            7,
            ChangeOrderStatus.Pending,
            "REF-002"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ChangeOrderNumber.Should().Be("CO-UPDATE-002");
        result.Value.Title.Should().Be("Updated Title");
        result.Value.Description.Should().Be("Updated description");
        result.Value.Reason.Should().Be("Updated reason");
        result.Value.Amount.Should().Be(15000m);
        result.Value.DaysExtension.Should().Be(7);
        result.Value.ReferenceNumber.Should().Be("REF-002");
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new UpdateChangeOrderHandler(db);
        var command = new UpdateChangeOrderCommand(
            Guid.NewGuid(),
            "CO-001",
            "Title",
            "Description",
            null,
            5000m,
            null,
            ChangeOrderStatus.Pending,
            null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_DuplicateCoNumber_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        var changeOrder1 = await CreateTestChangeOrder(db, subcontractId);
        
        // Create second CO with different number
        var changeOrder2 = new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontractId,
            ChangeOrderNumber = "CO-EXISTING",
            Title = "Existing CO",
            Description = "Existing",
            Amount = 5000m,
            Status = ChangeOrderStatus.Pending
        };
        db.Set<ChangeOrder>().Add(changeOrder2);
        await db.SaveChangesAsync();
        
        var handler = new UpdateChangeOrderHandler(db);
        // Try to update changeOrder1 with changeOrder2's number
        var command = new UpdateChangeOrderCommand(
            changeOrder1.Id,
            "CO-EXISTING", // duplicate
            changeOrder1.Title,
            changeOrder1.Description,
            changeOrder1.Reason,
            changeOrder1.Amount,
            changeOrder1.DaysExtension,
            changeOrder1.Status,
            changeOrder1.ReferenceNumber
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CO_NUMBER");
    }

    [Fact]
    public async Task Handle_SameCoNumberOnDifferentSubcontract_Succeeds()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId1 = Guid.NewGuid();
        var subcontractId2 = Guid.NewGuid();
        var changeOrder1 = await CreateTestChangeOrder(db, subcontractId1);
        
        // Create second CO with same number but different subcontract
        var changeOrder2 = new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontractId2, // different subcontract
            ChangeOrderNumber = "CO-SAME",
            Title = "Other Subcontract CO",
            Description = "Different subcontract",
            Amount = 5000m,
            Status = ChangeOrderStatus.Pending
        };
        db.Set<ChangeOrder>().Add(changeOrder2);
        await db.SaveChangesAsync();
        
        var handler = new UpdateChangeOrderHandler(db);
        // Update changeOrder1 with same number as changeOrder2 (different subcontract)
        var command = new UpdateChangeOrderCommand(
            changeOrder1.Id,
            "CO-SAME",
            changeOrder1.Title,
            changeOrder1.Description,
            changeOrder1.Reason,
            changeOrder1.Amount,
            changeOrder1.DaysExtension,
            changeOrder1.Status,
            changeOrder1.ReferenceNumber
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ChangeOrderNumber.Should().Be("CO-SAME");
    }

    [Fact]
    public async Task Handle_KeepSameCoNumber_Succeeds()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = await CreateTestChangeOrder(db);
        var handler = new UpdateChangeOrderHandler(db);
        var command = CreateValidCommand(changeOrder);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ChangeOrderNumber.Should().Be(changeOrder.ChangeOrderNumber);
    }

    [Fact]
    public async Task Handle_StatusChangeToPending_NoDateSet()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = await CreateTestChangeOrder(db);
        var handler = new UpdateChangeOrderHandler(db);
        var command = new UpdateChangeOrderCommand(
            changeOrder.Id,
            changeOrder.ChangeOrderNumber,
            changeOrder.Title,
            changeOrder.Description,
            changeOrder.Reason,
            changeOrder.Amount,
            changeOrder.DaysExtension,
            ChangeOrderStatus.Pending,
            changeOrder.ReferenceNumber
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ApprovedDate.Should().BeNull();
        result.Value.RejectedDate.Should().BeNull();
    }

    [Fact]
    public async Task Handle_StatusChangeToApproved_SetsApprovedDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = await CreateTestChangeOrder(db);
        var handler = new UpdateChangeOrderHandler(db);
        var command = new UpdateChangeOrderCommand(
            changeOrder.Id,
            changeOrder.ChangeOrderNumber,
            changeOrder.Title,
            changeOrder.Description,
            changeOrder.Reason,
            changeOrder.Amount,
            changeOrder.DaysExtension,
            ChangeOrderStatus.Approved,
            changeOrder.ReferenceNumber
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ChangeOrderStatus.Approved);
        result.Value.ApprovedDate.Should().NotBeNull();
        result.Value.ApprovedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Handle_StatusChangeToRejected_SetsRejectedDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = await CreateTestChangeOrder(db);
        var handler = new UpdateChangeOrderHandler(db);
        var command = new UpdateChangeOrderCommand(
            changeOrder.Id,
            changeOrder.ChangeOrderNumber,
            changeOrder.Title,
            changeOrder.Description,
            changeOrder.Reason,
            changeOrder.Amount,
            changeOrder.DaysExtension,
            ChangeOrderStatus.Rejected,
            changeOrder.ReferenceNumber
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ChangeOrderStatus.Rejected);
        result.Value.RejectedDate.Should().NotBeNull();
        result.Value.RejectedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Handle_AlreadyApproved_DoesNotUpdateApprovedDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var originalApprovedDate = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);
        var changeOrder = new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = Guid.NewGuid(),
            ChangeOrderNumber = "CO-APPROVED",
            Title = "Already Approved",
            Description = "Already approved CO",
            Amount = 20000m,
            Status = ChangeOrderStatus.Approved,
            ApprovedDate = originalApprovedDate,
            ApprovedBy = "Original Approver"
        };
        db.Set<ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();
        
        var handler = new UpdateChangeOrderHandler(db);
        var command = new UpdateChangeOrderCommand(
            changeOrder.Id,
            changeOrder.ChangeOrderNumber,
            "Updated Title",
            changeOrder.Description,
            changeOrder.Reason,
            25000m, // changed amount
            changeOrder.DaysExtension,
            ChangeOrderStatus.Approved, // same status
            changeOrder.ReferenceNumber
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ApprovedDate.Should().Be(originalApprovedDate);
    }

    [Fact]
    public async Task Handle_NegativeAmount_Succeeds()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = await CreateTestChangeOrder(db);
        var handler = new UpdateChangeOrderHandler(db);
        var command = new UpdateChangeOrderCommand(
            changeOrder.Id,
            changeOrder.ChangeOrderNumber,
            "Deduct CO",
            "Scope reduction",
            "Scope change",
            -5000m, // negative (deduct)
            null,
            ChangeOrderStatus.Pending,
            null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Amount.Should().Be(-5000m);
    }

    [Fact]
    public async Task Handle_UpdateVoidStatus_Succeeds()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = await CreateTestChangeOrder(db);
        var handler = new UpdateChangeOrderHandler(db);
        var command = new UpdateChangeOrderCommand(
            changeOrder.Id,
            changeOrder.ChangeOrderNumber,
            changeOrder.Title,
            changeOrder.Description,
            changeOrder.Reason,
            changeOrder.Amount,
            changeOrder.DaysExtension,
            ChangeOrderStatus.Void,
            changeOrder.ReferenceNumber
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ChangeOrderStatus.Void);
    }
}
