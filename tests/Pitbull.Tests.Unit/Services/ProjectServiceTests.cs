using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;
using Pitbull.Projects.Services;
using Pitbull.Tests.Unit.Helpers;
using System.Security.Claims;

namespace Pitbull.Tests.Unit.Services;

public class ProjectServiceTests
{
    private readonly Mock<IValidator<CreateProjectCommand>> _createValidatorMock;
    private readonly Mock<IValidator<UpdateProjectCommand>> _updateValidatorMock;
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock;
    private readonly Mock<ILogger<ProjectService>> _loggerMock;

    public ProjectServiceTests()
    {
        _createValidatorMock = new Mock<IValidator<CreateProjectCommand>>();
        _updateValidatorMock = new Mock<IValidator<UpdateProjectCommand>>();
        _httpContextAccessorMock = new Mock<IHttpContextAccessor>();
        _loggerMock = new Mock<ILogger<ProjectService>>();

        // Default to valid
        _createValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<CreateProjectCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());
        _updateValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<UpdateProjectCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());
    }

    private ProjectService CreateService(Pitbull.Core.Data.PitbullDbContext db) =>
        new(db, _createValidatorMock.Object, _updateValidatorMock.Object, _httpContextAccessorMock.Object, _loggerMock.Object);

    #region GetProjectAsync

    [Fact]
    public async Task GetProjectAsync_ExistingProject_ReturnsProjectDto()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Test Project",
            Number = "PRJ-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            ContractAmount = 1_000_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetProjectAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(project.Id);
        result.Value.Name.Should().Be("Test Project");
        result.Value.Status.Should().Be(ProjectStatus.Active);
    }

    [Fact]
    public async Task GetProjectAsync_NonExistentProject_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.GetProjectAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetProjectAsync_DeletedProject_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Deleted Project",
            Number = "PRJ-DEL-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            IsDeleted = true,
            DeletedAt = DateTime.UtcNow.AddDays(-1),
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetProjectAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region GetProjectsAsync

    [Fact]
    public async Task GetProjectsAsync_ReturnsPagedResults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        for (int i = 0; i < 25; i++)
        {
            db.Set<Project>().Add(new Project
            {
                Id = Guid.NewGuid(),
                Name = $"Project {i}",
                Number = $"PRJ-{i:D3}",
                Status = ProjectStatus.Active,
                Type = ProjectType.Commercial,
                CreatedAt = DateTime.UtcNow.AddMinutes(-i)
            });
        }
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListProjectsQuery(Status: null, Type: null, Search: null) { Page = 2, PageSize = 10 };

        // Act
        var result = await service.GetProjectsAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(10);
        result.Value.TotalCount.Should().Be(25);
        result.Value.Page.Should().Be(2);
    }

    [Fact]
    public async Task GetProjectsAsync_FiltersByStatus()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Active", Number = "P1", Status = ProjectStatus.Active, Type = ProjectType.Commercial, CreatedAt = DateTime.UtcNow });
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Complete", Number = "P2", Status = ProjectStatus.Completed, Type = ProjectType.Commercial, CreatedAt = DateTime.UtcNow });
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "OnHold", Number = "P3", Status = ProjectStatus.OnHold, Type = ProjectType.Commercial, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListProjectsQuery(Status: ProjectStatus.Active, Type: null, Search: null) { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetProjectsAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Name.Should().Be("Active");
    }

    [Fact]
    public async Task GetProjectsAsync_FiltersByType()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Commercial", Number = "P1", Status = ProjectStatus.Active, Type = ProjectType.Commercial, CreatedAt = DateTime.UtcNow });
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Residential", Number = "P2", Status = ProjectStatus.Active, Type = ProjectType.Residential, CreatedAt = DateTime.UtcNow });
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Infrastructure", Number = "P3", Status = ProjectStatus.Active, Type = ProjectType.Infrastructure, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListProjectsQuery(Status: null, Type: ProjectType.Infrastructure, Search: null) { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetProjectsAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Name.Should().Be("Infrastructure");
    }

    [Fact]
    public async Task GetProjectsAsync_SearchByNameNumberOrClient()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Highway Project", Number = "PRJ-HWY-001", ClientName = "ODOT", Status = ProjectStatus.Active, Type = ProjectType.Infrastructure, CreatedAt = DateTime.UtcNow });
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Office Building", Number = "PRJ-OFF-001", ClientName = "Acme Corp", Status = ProjectStatus.Active, Type = ProjectType.Commercial, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListProjectsQuery(Status: null, Type: null, Search: "ODOT") { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetProjectsAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Name.Should().Be("Highway Project");
    }

    [Fact]
    public async Task GetProjectsAsync_ExcludesDeletedProjects()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Active", Number = "P1", Status = ProjectStatus.Active, Type = ProjectType.Commercial, CreatedAt = DateTime.UtcNow });
        db.Set<Project>().Add(new Project { Id = Guid.NewGuid(), Name = "Deleted", Number = "P2", Status = ProjectStatus.Active, Type = ProjectType.Commercial, IsDeleted = true, DeletedAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var query = new ListProjectsQuery(Status: null, Type: null, Search: null) { Page = 1, PageSize = 10 };

        // Act
        var result = await service.GetProjectsAsync(query);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Name.Should().Be("Active");
    }

    #endregion

    #region CreateProjectAsync

    [Fact]
    public async Task CreateProjectAsync_ValidCommand_CreatesProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new CreateProjectCommand(
            Name: "New Project",
            Number: "PRJ-NEW-001",
            Description: "A new project",
            Type: ProjectType.Commercial,
            Address: "123 Main St",
            City: "Portland",
            State: "OR",
            ZipCode: "97201",
            ClientName: "Test Client",
            ClientContact: "John Doe",
            ClientEmail: "john@test.com",
            ClientPhone: "555-1234",
            StartDate: DateTime.UtcNow,
            EstimatedCompletionDate: DateTime.UtcNow.AddMonths(6),
            ContractAmount: 500_000m,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null
        );

        // Act
        var result = await service.CreateProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("New Project");
        result.Value.Status.Should().Be(ProjectStatus.PreConstruction);
        result.Value.City.Should().Be("Portland");
    }

    [Fact]
    public async Task CreateProjectAsync_ValidationFails_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        _createValidatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<CreateProjectCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("Name", "Name is required") }));

        var service = CreateService(db);
        var command = new CreateProjectCommand(
            Name: "",
            Number: "PRJ-001",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 0,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null
        );

        // Act
        var result = await service.CreateProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    #endregion

    #region UpdateProjectAsync

    [Fact]
    public async Task UpdateProjectAsync_ValidCommand_UpdatesProject()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Original",
            Number = "PRJ-001",
            Status = ProjectStatus.PreConstruction,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new UpdateProjectCommand(
            Id: project.Id,
            Name: "Updated Name",
            Number: "PRJ-001-REV",
            Description: "Updated",
            Status: ProjectStatus.Active,
            Type: ProjectType.Infrastructure,
            Address: "456 New St",
            City: "Seattle",
            State: "WA",
            ZipCode: "98101",
            ClientName: "New Client",
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: DateTime.UtcNow,
            EstimatedCompletionDate: DateTime.UtcNow.AddMonths(12),
            ActualCompletionDate: null,
            ContractAmount: 1_000_000m,
            ProjectManagerId: null,
            SuperintendentId: null
        );

        // Act
        var result = await service.UpdateProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Updated Name");
        result.Value.Status.Should().Be(ProjectStatus.Active);
        result.Value.City.Should().Be("Seattle");
    }

    [Fact]
    public async Task UpdateProjectAsync_NonExistentProject_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new UpdateProjectCommand(
            Id: Guid.NewGuid(),
            Name: "Name",
            Number: "NUM",
            Description: null,
            Status: ProjectStatus.Active,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null, ActualCompletionDate: null,
            ContractAmount: 0,
            ProjectManagerId: null, SuperintendentId: null
        );

        // Act
        var result = await service.UpdateProjectAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region DeleteProjectAsync

    [Fact]
    public async Task DeleteProjectAsync_ExistingProject_SoftDeletes()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "To Delete",
            Number = "PRJ-DEL-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.DeleteProjectAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var deleted = await db.Set<Project>().FindAsync(project.Id);
        deleted!.IsDeleted.Should().BeTrue();
        deleted.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteProjectAsync_WithAuthenticatedUser_SetsDeletedBy()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "To Delete",
            Number = "PRJ-DEL-002",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var claims = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "user-123")
        }, "Test"));
        var httpContext = new DefaultHttpContext { User = claims };
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);

        var service = CreateService(db);

        // Act
        var result = await service.DeleteProjectAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var deleted = await db.Set<Project>().FindAsync(project.Id);
        deleted!.DeletedBy.Should().Be("user-123");
    }

    [Fact]
    public async Task DeleteProjectAsync_NonExistentProject_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.DeleteProjectAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion
}
