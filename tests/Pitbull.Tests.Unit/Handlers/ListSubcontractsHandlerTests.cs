using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.ListSubcontracts;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class ListSubcontractsHandlerTests
{
    private async Task SeedSubcontracts(PitbullDbContext db, Guid projectId, int count)
    {
        for (int i = 1; i <= count; i++)
        {
            db.Set<Subcontract>().Add(new Subcontract
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                SubcontractNumber = $"SC-{i:D3}",
                SubcontractorName = $"Subcontractor {i}",
                ScopeOfWork = $"Scope {i}",
                OriginalValue = 50000m * i,
                CurrentValue = 50000m * i,
                RetainagePercent = 10m,
                Status = i % 2 == 0 ? SubcontractStatus.Executed : SubcontractStatus.Draft
            });
        }
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Handle_NoFilter_ReturnsAllSubcontracts()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        await SeedSubcontracts(db, projectId, 5);
        var handler = new ListSubcontractsHandler(db);
        var query = new ListSubcontractsQuery(projectId, null, null, 1, 20);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(5);
        result.Value.TotalCount.Should().Be(5);
    }

    [Fact]
    public async Task Handle_FilterByStatus_ReturnsMatchingSubcontracts()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        await SeedSubcontracts(db, projectId, 5);
        var handler = new ListSubcontractsHandler(db);
        var query = new ListSubcontractsQuery(projectId, SubcontractStatus.Executed, null, 1, 20);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2); // 2, 4 are Executed
        result.Value.Items.Should().AllSatisfy(s => s.Status.Should().Be(SubcontractStatus.Executed));
    }

    [Fact]
    public async Task Handle_EmptyProject_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new ListSubcontractsHandler(db);
        var query = new ListSubcontractsQuery(Guid.NewGuid(), null, null, 1, 20);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    // Note: Soft-delete query filter tests require PostgreSQL integration tests
    // InMemory provider doesn't fully support query filters with complex expressions

    [Fact]
    public async Task Handle_Pagination_ReturnsCorrectPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        await SeedSubcontracts(db, projectId, 10);
        var handler = new ListSubcontractsHandler(db);
        var query = new ListSubcontractsQuery(projectId, null, null, 2, 3); // Page 2, 3 per page

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.TotalCount.Should().Be(10);
        result.Value.Page.Should().Be(2);
        result.Value.PageSize.Should().Be(3);
    }
}
