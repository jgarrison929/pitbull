using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.GetChangeOrder;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetChangeOrderHandlerTests
{
    private async Task<ChangeOrder> CreateTestChangeOrder(PitbullDbContext db, Guid? subcontractId = null)
    {
        var changeOrder = new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontractId ?? Guid.NewGuid(),
            ChangeOrderNumber = "CO-GET-001",
            Title = "Test Change Order",
            Description = "Test description for change order",
            Reason = "Field condition",
            Amount = 15000m,
            DaysExtension = 5,
            Status = ChangeOrderStatus.Pending,
            SubmittedDate = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            ReferenceNumber = "REF-001"
        };
        db.Set<ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();
        return changeOrder;
    }

    [Fact]
    public async Task Handle_ExistingChangeOrder_ReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = await CreateTestChangeOrder(db);
        var handler = new GetChangeOrderHandler(db);
        var query = new GetChangeOrderQuery(changeOrder.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(changeOrder.Id);
        result.Value.ChangeOrderNumber.Should().Be("CO-GET-001");
        result.Value.Title.Should().Be("Test Change Order");
        result.Value.Amount.Should().Be(15000m);
        result.Value.DaysExtension.Should().Be(5);
        result.Value.Status.Should().Be(ChangeOrderStatus.Pending);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetChangeOrderHandler(db);
        var query = new GetChangeOrderQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ApprovedChangeOrder_ReturnsApprovalDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = Guid.NewGuid(),
            ChangeOrderNumber = "CO-APPROVED-001",
            Title = "Approved CO",
            Description = "Approved change order",
            Amount = 25000m,
            Status = ChangeOrderStatus.Approved,
            SubmittedDate = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            ApprovedDate = new DateTime(2026, 1, 20, 0, 0, 0, DateTimeKind.Utc),
            ApprovedBy = "John Manager"
        };
        db.Set<ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();

        var handler = new GetChangeOrderHandler(db);
        var query = new GetChangeOrderQuery(changeOrder.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ChangeOrderStatus.Approved);
        result.Value.ApprovedDate.Should().Be(new DateTime(2026, 1, 20, 0, 0, 0, DateTimeKind.Utc));
        result.Value.ApprovedBy.Should().Be("John Manager");
    }

    [Fact]
    public async Task Handle_RejectedChangeOrder_ReturnsRejectionDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var changeOrder = new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = Guid.NewGuid(),
            ChangeOrderNumber = "CO-REJECTED-001",
            Title = "Rejected CO",
            Description = "Rejected change order",
            Amount = 50000m,
            Status = ChangeOrderStatus.Rejected,
            SubmittedDate = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            RejectedDate = new DateTime(2026, 1, 22, 0, 0, 0, DateTimeKind.Utc),
            RejectedBy = "Sarah Director",
            RejectionReason = "Budget exceeded"
        };
        db.Set<ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();

        var handler = new GetChangeOrderHandler(db);
        var query = new GetChangeOrderQuery(changeOrder.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ChangeOrderStatus.Rejected);
        result.Value.RejectedDate.Should().Be(new DateTime(2026, 1, 22, 0, 0, 0, DateTimeKind.Utc));
        result.Value.RejectedBy.Should().Be("Sarah Director");
        result.Value.RejectionReason.Should().Be("Budget exceeded");
    }
}
