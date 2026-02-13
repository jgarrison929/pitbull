using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.DeleteSubcontract;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class DeleteSubcontractHandlerTests
{
    private static async Task<Subcontract> CreateTestSubcontract(PitbullDbContext db, SubcontractStatus status = SubcontractStatus.Draft)
    {
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            SubcontractNumber = $"SC-{Guid.NewGuid():N}"[..15],
            SubcontractorName = "Test Subcontractor",
            ScopeOfWork = "Test scope",
            OriginalValue = 100000m,
            CurrentValue = 100000m,
            RetainagePercent = 10m,
            Status = status
        };
        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync();
        return subcontract;
    }

    [Fact]
    public async Task Handle_DraftSubcontract_SoftDeletesSuccessfully()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db, SubcontractStatus.Draft);
        var handler = new DeleteSubcontractHandler(db);
        var command = new DeleteSubcontractCommand(subcontract.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        // Query filter excludes soft-deleted, so check raw
        var deleted = await db.Set<Subcontract>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == subcontract.Id);
        deleted.Should().NotBeNull();
        deleted!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new DeleteSubcontractHandler(db);
        var command = new DeleteSubcontractCommand(Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_ExecutedSubcontract_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db, SubcontractStatus.Executed);
        var handler = new DeleteSubcontractHandler(db);
        var command = new DeleteSubcontractCommand(subcontract.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("CANNOT_DELETE");
    }
}
