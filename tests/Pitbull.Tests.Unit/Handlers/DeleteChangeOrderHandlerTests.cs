using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.DeleteChangeOrder;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class DeleteChangeOrderHandlerTests
{
    private static async Task<(Subcontract sub, ChangeOrder co)> CreateTestData(PitbullDbContext db, ChangeOrderStatus status = ChangeOrderStatus.Pending)
    {
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            SubcontractNumber = "SC-DEL-CO-001",
            SubcontractorName = "Test Sub",
            ScopeOfWork = "Test scope",
            OriginalValue = 100000m,
            CurrentValue = 100000m,
            RetainagePercent = 10m,
            Status = SubcontractStatus.Executed
        };
        db.Set<Subcontract>().Add(subcontract);

        var changeOrder = new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontract.Id,
            ChangeOrderNumber = "CO-001",
            Title = "Test CO",
            Description = "Test description",
            Amount = 5000m,
            Status = status,
            SubmittedDate = DateTime.UtcNow
        };
        db.Set<ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();

        return (subcontract, changeOrder);
    }

    [Fact]
    public async Task Handle_PendingChangeOrder_SoftDeletesSuccessfully()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, co) = await CreateTestData(db, ChangeOrderStatus.Pending);
        var handler = new DeleteChangeOrderHandler(db);
        var command = new DeleteChangeOrderCommand(co.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        // Query filter excludes soft-deleted, so check raw
        var deleted = await db.Set<ChangeOrder>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == co.Id);
        deleted.Should().NotBeNull();
        deleted!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new DeleteChangeOrderHandler(db);
        var command = new DeleteChangeOrderCommand(Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ApprovedChangeOrder_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, co) = await CreateTestData(db, ChangeOrderStatus.Approved);
        var handler = new DeleteChangeOrderHandler(db);
        var command = new DeleteChangeOrderCommand(co.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("CANNOT_DELETE");
    }
}
