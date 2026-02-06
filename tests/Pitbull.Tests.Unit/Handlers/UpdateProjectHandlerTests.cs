using FluentAssertions;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.UpdateProject;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public sealed class UpdateProjectHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingProject_UpdatesProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Original Name",
            Number = "PRJ-001",
            Status = ProjectStatus.Bidding,
            Type = ProjectType.Commercial,
            ContractAmount = 500000m
        };
        db.Add(project);
        await db.SaveChangesAsync();

        var handler = new UpdateProjectHandler(db);
        var command = new UpdateProjectCommand(
            Id: project.Id,
            Name: "Updated Name",
            Number: "PRJ-001-REV",
            Description: "Updated description",
            Status: ProjectStatus.Active,
            Type: ProjectType.Industrial,
            Address: "123 Main St",
            City: "Los Angeles",
            State: "CA",
            ZipCode: "90001",
            ClientName: "New Client",
            ClientContact: "John Smith",
            ClientEmail: "john@client.com",
            ClientPhone: "555-1234",
            StartDate: new DateTime(2026, 3, 1),
            EstimatedCompletionDate: new DateTime(2026, 12, 31),
            ActualCompletionDate: null,
            ContractAmount: 750000m,
            ProjectManagerId: null,
            SuperintendentId: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Updated Name");
        result.Value.Status.Should().Be(ProjectStatus.Active);
        result.Value.Type.Should().Be(ProjectType.Industrial);
        result.Value.ContractAmount.Should().Be(750000m);
    }

    [Fact]
    public async Task Handle_WithNonExistentProject_ReturnsNotFoundError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new UpdateProjectHandler(db);
        var command = new UpdateProjectCommand(
            Id: Guid.NewGuid(),
            Name: "Test",
            Number: "PRJ-999",
            Description: null,
            Status: ProjectStatus.Bidding,
            Type: ProjectType.Commercial,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            ClientName: null,
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: null,
            EstimatedCompletionDate: null,
            ActualCompletionDate: null,
            ContractAmount: 0,
            ProjectManagerId: null,
            SuperintendentId: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_CanChangeStatus()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Status Test",
            Number = "PRJ-STATUS-001",
            Status = ProjectStatus.Active,
            ContractAmount = 100000m
        };
        db.Add(project);
        await db.SaveChangesAsync();

        var handler = new UpdateProjectHandler(db);
        var command = new UpdateProjectCommand(
            Id: project.Id,
            Name: "Status Test",
            Number: "PRJ-STATUS-001",
            Description: null,
            Status: ProjectStatus.Completed,
            Type: ProjectType.Commercial,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            ClientName: null,
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: null,
            EstimatedCompletionDate: null,
            ActualCompletionDate: new DateTime(2026, 6, 30),
            ContractAmount: 100000m,
            ProjectManagerId: null,
            SuperintendentId: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ProjectStatus.Completed);
    }

    [Fact]
    public void UpdateProjectCommand_CanBeCreated()
    {
        // Arrange & Act
        var command = new UpdateProjectCommand(
            Id: Guid.NewGuid(),
            Name: "Test",
            Number: "PRJ-001",
            Description: "Test description",
            Status: ProjectStatus.Active,
            Type: ProjectType.Residential,
            Address: "123 St",
            City: "City",
            State: "ST",
            ZipCode: "12345",
            ClientName: "Client",
            ClientContact: "Contact",
            ClientEmail: "email@test.com",
            ClientPhone: "555-0000",
            StartDate: new DateTime(2026, 1, 1),
            EstimatedCompletionDate: new DateTime(2026, 12, 31),
            ActualCompletionDate: null,
            ContractAmount: 1000000m,
            ProjectManagerId: null,
            SuperintendentId: null
        );

        // Assert
        command.Name.Should().Be("Test");
        command.ContractAmount.Should().Be(1000000m);
        command.Type.Should().Be(ProjectType.Residential);
    }
}
