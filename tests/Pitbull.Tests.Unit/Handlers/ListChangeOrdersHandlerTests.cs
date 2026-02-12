using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.ListChangeOrders;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ListChangeOrdersHandlerTests
{
    private async Task SeedChangeOrders(PitbullDbContext db, Guid subcontractId)
    {
        var changeOrders = new[]
        {
            new ChangeOrder
            {
                Id = Guid.NewGuid(),
                SubcontractId = subcontractId,
                ChangeOrderNumber = "CO-001",
                Title = "Foundation Extra",
                Description = "Extra foundation work",
                Amount = 15000m,
                Status = ChangeOrderStatus.Approved,
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            },
            new ChangeOrder
            {
                Id = Guid.NewGuid(),
                SubcontractId = subcontractId,
                ChangeOrderNumber = "CO-002",
                Title = "Electrical Upgrade",
                Description = "Upgrade electrical panel",
                Amount = 8500m,
                Status = ChangeOrderStatus.Pending,
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            },
            new ChangeOrder
            {
                Id = Guid.NewGuid(),
                SubcontractId = subcontractId,
                ChangeOrderNumber = "CO-003",
                Title = "Plumbing Deduct",
                Description = "Removed scope item",
                Amount = -3500m,
                Status = ChangeOrderStatus.Rejected,
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            }
        };

        db.Set<ChangeOrder>().AddRange(changeOrders);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Handle_ReturnsAllChangeOrders()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedChangeOrders(db, subcontractId);
        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(null, null, null);

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
        await SeedChangeOrders(db, subcontractId1);

        // Add one more for different subcontract
        db.Set<ChangeOrder>().Add(new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontractId2,
            ChangeOrderNumber = "CO-OTHER",
            Title = "Other CO",
            Description = "Different subcontract",
            Amount = 5000m,
            Status = ChangeOrderStatus.Pending
        });
        await db.SaveChangesAsync();

        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(subcontractId1, null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(3);
        result.Value.Items.Should().OnlyContain(co => co.SubcontractId == subcontractId1);
    }

    [Fact]
    public async Task Handle_FilterByStatus_ReturnsMatchingOnly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedChangeOrders(db, subcontractId);
        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(null, ChangeOrderStatus.Pending, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().Status.Should().Be(ChangeOrderStatus.Pending);
    }

    [Fact]
    public async Task Handle_SearchByTitle_ReturnsMatchingOnly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedChangeOrders(db, subcontractId);
        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(null, null, "Electrical");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().Title.Should().Be("Electrical Upgrade");
    }

    [Fact]
    public async Task Handle_SearchByCoNumber_ReturnsMatchingOnly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedChangeOrders(db, subcontractId);
        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(null, null, "CO-003");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().ChangeOrderNumber.Should().Be("CO-003");
    }

    [Fact]
    public async Task Handle_Pagination_ReturnsCorrectPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedChangeOrders(db, subcontractId);
        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(null, null, null, Page: 1, PageSize: 2);

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
    public async Task Handle_OrdersByCreatedAtDescending()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontractId = Guid.NewGuid();
        await SeedChangeOrders(db, subcontractId);
        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(null, null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var items = result.Value!.Items.ToList();
        // CO-003 is newest (created most recently)
        items[0].ChangeOrderNumber.Should().Be("CO-003");
        items[1].ChangeOrderNumber.Should().Be("CO-002");
        items[2].ChangeOrderNumber.Should().Be("CO-001");
    }

    [Fact]
    public async Task Handle_EmptyDatabase_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(null, null, null);

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
        await SeedChangeOrders(db, subcontractId);
        var handler = new ListChangeOrdersHandler(db);
        var query = new ListChangeOrdersQuery(subcontractId, ChangeOrderStatus.Approved, "Foundation");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().Title.Should().Be("Foundation Extra");
        result.Value.Items.Single().Status.Should().Be(ChangeOrderStatus.Approved);
    }
}
