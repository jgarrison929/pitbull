using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.UpdateSubcontract;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class UpdateSubcontractHandlerTests
{
    private async Task<Subcontract> CreateTestSubcontract(PitbullDbContext db)
    {
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            SubcontractNumber = "SC-UPDATE-001",
            SubcontractorName = "Original Name",
            ScopeOfWork = "Original scope",
            OriginalValue = 100000m,
            CurrentValue = 100000m,
            RetainagePercent = 10m,
            Status = SubcontractStatus.Draft
        };
        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync();
        return subcontract;
    }

    [Fact]
    public async Task Handle_ValidUpdate_UpdatesSubcontract()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db);
        var handler = new UpdateSubcontractHandler(db);
        var command = new UpdateSubcontractCommand(
            Id: subcontract.Id,
            SubcontractNumber: "SC-UPDATE-001",
            SubcontractorName: "Updated Name",
            SubcontractorContact: "New Contact",
            SubcontractorEmail: "new@email.com",
            SubcontractorPhone: "555-9999",
            SubcontractorAddress: "456 New St",
            ScopeOfWork: "Updated scope of work",
            TradeCode: "05 - Steel",
            OriginalValue: 100000m,
            RetainagePercent: 5m,
            ExecutionDate: null,
            StartDate: new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc),
            CompletionDate: new DateTime(2026, 9, 30, 0, 0, 0, DateTimeKind.Utc),
            Status: SubcontractStatus.Executed,
            InsuranceExpirationDate: new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            InsuranceCurrent: true,
            LicenseNumber: "LIC-999",
            Notes: "Updated notes"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SubcontractorName.Should().Be("Updated Name");
        result.Value.ScopeOfWork.Should().Be("Updated scope of work");
        result.Value.RetainagePercent.Should().Be(5m);
        result.Value.Status.Should().Be(SubcontractStatus.Executed);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new UpdateSubcontractHandler(db);
        var command = new UpdateSubcontractCommand(
            Id: Guid.NewGuid(),
            SubcontractNumber: "SC-NOTFOUND",
            SubcontractorName: "Name",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Scope",
            TradeCode: null,
            OriginalValue: 100000m,
            RetainagePercent: 10m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_PartialUpdate_PreservesOtherFields()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var subcontract = await CreateTestSubcontract(db);
        var handler = new UpdateSubcontractHandler(db);
        var command = new UpdateSubcontractCommand(
            Id: subcontract.Id,
            SubcontractNumber: "SC-UPDATE-001",
            SubcontractorName: "Only Name Changed",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Original scope", // Keep same
            TradeCode: null,
            OriginalValue: 100000m,
            RetainagePercent: 10m, // Keep same
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            Status: SubcontractStatus.Draft,
            InsuranceExpirationDate: null,
            InsuranceCurrent: false,
            LicenseNumber: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SubcontractorName.Should().Be("Only Name Changed");
        result.Value.OriginalValue.Should().Be(100000m); // Preserved
        result.Value.SubcontractNumber.Should().Be("SC-UPDATE-001"); // Preserved
    }
}
