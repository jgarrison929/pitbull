using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class CreateProjectHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesProjectAndReturnsDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateProjectHandler(db);
        var command = new CreateProjectCommand(
            Name: "Highway Bridge Repair",
            Number: "PRJ-2026-001",
            Description: "Bridge repair on I-5",
            Type: ProjectType.Infrastructure,
            Address: "123 Bridge Rd",
            City: "Portland",
            State: "OR",
            ZipCode: "97201",
            ClientName: "ODOT",
            ClientContact: "Jane Doe",
            ClientEmail: "jane@odot.gov",
            ClientPhone: "503-555-1234",
            StartDate: new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            EstimatedCompletionDate: new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            ContractAmount: 1_500_000m,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Name.Should().Be("Highway Bridge Repair");
        result.Value.Number.Should().Be("PRJ-2026-001");
        result.Value.Status.Should().Be(ProjectStatus.Bidding);
        result.Value.Type.Should().Be(ProjectType.Infrastructure);
        result.Value.ContractAmount.Should().Be(1_500_000m);
        result.Value.City.Should().Be("Portland");
        result.Value.ClientEmail.Should().Be("jane@odot.gov");
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Handle_ValidCommand_PersistsProjectToDatabase()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateProjectHandler(db);
        var command = new CreateProjectCommand(
            Name: "Office Build",
            Number: "PRJ-2026-002",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 500_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null
        );

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        var saved = await db.Set<Project>().FirstOrDefaultAsync();
        saved.Should().NotBeNull();
        saved!.Name.Should().Be("Office Build");
        saved.TenantId.Should().Be(TestDbContextFactory.TestTenantId);
    }

    [Fact]
    public async Task Handle_MinimalFields_CreatesProjectWithDefaults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateProjectHandler(db);
        var command = new CreateProjectCommand(
            Name: "Minimal Project",
            Number: "PRJ-MIN-001",
            Description: null,
            Type: ProjectType.Other,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 0m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ProjectStatus.Bidding);
        result.Value.ContractAmount.Should().Be(0m);
        result.Value.Description.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WithSourceBidId_LinksProjectToBid()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateProjectHandler(db);
        var sourceBidId = Guid.NewGuid();
        var command = new CreateProjectCommand(
            Name: "Converted Project",
            Number: "PRJ-CONV-001",
            Description: "From bid",
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 250_000m,
            ProjectManagerId: null, SuperintendentId: null,
            SourceBidId: sourceBidId
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SourceBidId.Should().Be(sourceBidId);
    }

    [Fact]
    public async Task Handle_SetsCreatedAtTimestamp()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateProjectHandler(db);
        var before = DateTime.UtcNow;
        var command = new CreateProjectCommand(
            Name: "Timestamped Project",
            Number: "PRJ-TS-001",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 100_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Value!.CreatedAt.Should().BeOnOrAfter(before);
        result.Value.CreatedAt.Should().BeOnOrBefore(DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_SetsTenantIdFromContext()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateProjectHandler(db);
        var command = new CreateProjectCommand(
            Name: "Tenant Test",
            Number: "PRJ-TEN-001",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 0m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null
        );

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        var project = await db.Set<Project>().FirstAsync();
        project.TenantId.Should().Be(TestDbContextFactory.TestTenantId);
    }
}
