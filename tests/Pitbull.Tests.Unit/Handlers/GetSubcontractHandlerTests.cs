using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.GetSubcontract;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetSubcontractHandlerTests
{
    private async Task<Subcontract> CreateTestSubcontract(PitbullDbContext db)
    {
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            SubcontractNumber = "SC-GET-001",
            SubcontractorName = "Get Test Sub",
            SubcontractorContact = "John Smith",
            SubcontractorEmail = "john@test.com",
            SubcontractorPhone = "555-1234",
            SubcontractorAddress = "123 Test St",
            ScopeOfWork = "Test scope of work",
            TradeCode = "03 - Concrete",
            OriginalValue = 150000m,
            CurrentValue = 165000m,
            BilledToDate = 50000m,
            PaidToDate = 45000m,
            RetainagePercent = 10m,
            RetainageHeld = 5000m,
            StartDate = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            CompletionDate = new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc),
            Status = SubcontractStatus.Executed,
            InsuranceExpirationDate = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            InsuranceCurrent = true,
            LicenseNumber = "LIC-12345",
            Notes = "Test notes"
        };
        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync();
        return subcontract;
    }

    [Fact]
    public async Task Handle_ExistingSubcontract_ReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db);
        var handler = new GetSubcontractHandler(db);
        var query = new GetSubcontractQuery(subcontract.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(subcontract.Id);
        result.Value.SubcontractNumber.Should().Be("SC-GET-001");
        result.Value.SubcontractorName.Should().Be("Get Test Sub");
        result.Value.OriginalValue.Should().Be(150000m);
        result.Value.CurrentValue.Should().Be(165000m);
        result.Value.BilledToDate.Should().Be(50000m);
        result.Value.Status.Should().Be(SubcontractStatus.Executed);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetSubcontractHandler(db);
        var query = new GetSubcontractQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    // Note: Soft-delete query filter tests require PostgreSQL integration tests
    // InMemory provider doesn't fully support query filters with complex expressions
}
