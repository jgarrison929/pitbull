using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.DeleteProject;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class DeleteProjectHandlerTests
{
    [Fact]
    public async Task Handle_ValidProject_SoftDeletesSuccessfully()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var project = new Project
        {
            Name = "Test Project",
            Number = "PRJ-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            ContractAmount = 100000,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();
        
        var handler = new DeleteProjectHandler(db);
        var command = new DeleteProjectCommand(project.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
        
        // Verify project is soft deleted
        var deletedProject = await db.Set<Project>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == project.Id);
        deletedProject.Should().NotBeNull();
        deletedProject!.IsDeleted.Should().BeTrue();
        deletedProject.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        
        // Note: In-memory database may not fully respect query filters
        // The important thing is that IsDeleted = true and DeletedAt is set
    }

    [Fact]
    public async Task Handle_NonExistentProject_ReturnsNotFoundFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new DeleteProjectHandler(db);
        var command = new DeleteProjectCommand(Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Be("Project not found");
    }

    [Fact]
    public async Task Handle_AlreadyDeletedProject_ReturnsNotFoundFailure()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        using var db = TestDbContextFactory.Create(dbName: dbName);
        var project = new Project
        {
            Name = "Test Project",
            Number = "PRJ-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            ContractAmount = 100000,
            IsDeleted = true,
            DeletedAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();
        
        var handler = new DeleteProjectHandler(db);
        var command = new DeleteProjectCommand(project.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Be("Project not found");
    }
}