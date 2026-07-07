using System.Security.Claims;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services;
using Pitbull.Projects.Services;
using Pitbull.RFIs.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace Pitbull.Tests.Unit.Services;

public class ProjectServiceTests
{
    private readonly Mock<IValidator<CreateProjectCommand>> _createValidatorMock;
    private readonly Mock<IValidator<UpdateProjectCommand>> _updateValidatorMock;
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock;
    private readonly Mock<ICompanyContext> _companyContextMock;
    private readonly Mock<IProjectTeamAssignmentService> _teamAssignmentServiceMock;
    private readonly Mock<ILogger<ProjectService>> _loggerMock;

    public ProjectServiceTests()
    {
        _createValidatorMock = new Mock<IValidator<CreateProjectCommand>>();
        _updateValidatorMock = new Mock<IValidator<UpdateProjectCommand>>();
        _httpContextAccessorMock = new Mock<IHttpContextAccessor>();
        _companyContextMock = new Mock<ICompanyContext>();
        _companyContextMock.Setup(c => c.IsResolved).Returns(false);
        _teamAssignmentServiceMock = new Mock<IProjectTeamAssignmentService>();
        _teamAssignmentServiceMock
            .Setup(s => s.AssignTeamMembersAsync(
                It.IsAny<Guid>(),
                It.IsAny<IReadOnlyList<ProjectTeamMemberRequest>>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success<(Guid? ProjectManagerId, Guid? SuperintendentId)>((null, null)));
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
        new(db, _companyContextMock.Object, _teamAssignmentServiceMock.Object, _createValidatorMock.Object, _updateValidatorMock.Object, _httpContextAccessorMock.Object, _loggerMock.Object);

    private ProjectService CreateServiceWithRealTeamAssignment(Pitbull.Core.Data.PitbullDbContext db) =>
        new(
            db,
            _companyContextMock.Object,
            new ProjectTeamAssignmentService(db, NullLogger<ProjectTeamAssignmentService>.Instance),
            _createValidatorMock.Object,
            _updateValidatorMock.Object,
            _httpContextAccessorMock.Object,
            _loggerMock.Object);

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

    [Fact]
    public async Task CreateProjectAsync_WithExplicitPhases_PersistsPhases()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new CreateProjectCommand(
            Name: "Phased Project",
            Number: "PRJ-PHASE-001",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 100_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null,
            Phases:
            [
                new CreateProjectPhaseInput("Foundation", "03000", 25_000m),
                new CreateProjectPhaseInput("Framing", "06000", 35_000m)
            ]);

        var result = await service.CreateProjectAsync(command);

        result.IsSuccess.Should().BeTrue();
        var phases = await db.Set<Phase>()
            .Where(p => p.ProjectId == result.Value!.Id)
            .OrderBy(p => p.SortOrder)
            .ToListAsync();
        phases.Should().HaveCount(2);
        phases[0].Name.Should().Be("Foundation");
        phases[0].CostCode.Should().Be("03000");
        phases[1].Name.Should().Be("Framing");
    }

    [Fact]
    public async Task CreateProjectAsync_WithAutoCreatePhases_CreatesDefaultPhases()
    {
        using var db = TestDbContextFactory.Create();
        _companyContextMock.Setup(c => c.IsResolved).Returns(true);
        _companyContextMock.Setup(c => c.CompanyId).Returns(TestDbContextFactory.TestCompanyId);

        db.Set<Company>().Add(new Company
        {
            Id = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Code = "01",
            Name = "Test Company",
            ProjectSettings = new ProjectSettings { AutoCreatePhases = true }
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var command = new CreateProjectCommand(
            Name: "Auto Phases",
            Number: "PRJ-AUTO-001",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 50_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var result = await service.CreateProjectAsync(command);

        result.IsSuccess.Should().BeTrue();
        var phases = await db.Set<Phase>().Where(p => p.ProjectId == result.Value!.Id).ToListAsync();
        phases.Should().HaveCount(3);
        phases.Select(p => p.Name).Should().Contain(["Preconstruction", "Construction", "Closeout"]);
    }

    [Fact]
    public async Task CreateProjectAsync_WithTeamMembers_PersistsProjectAssignments()
    {
        using var db = TestDbContextFactory.Create();
        _companyContextMock.Setup(c => c.IsResolved).Returns(true);
        _companyContextMock.Setup(c => c.CompanyId).Returns(TestDbContextFactory.TestCompanyId);

        var employeeId = Guid.NewGuid();
        db.Set<Employee>().Add(new Employee
        {
            Id = employeeId,
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP-TEAM-1",
            FirstName = "Alex",
            LastName = "Manager",
            Email = "alex.manager@example.com",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var service = CreateServiceWithRealTeamAssignment(db);
        var command = new CreateProjectCommand(
            Name: "Team Project",
            Number: "PRJ-TEAM-001",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: DateTime.UtcNow, EstimatedCompletionDate: null,
            ContractAmount: 75_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null,
            TeamMembers:
            [
                new CreateProjectTeamMemberInput(employeeId, "Project Manager", AssignmentRole.Manager)
            ]);

        var result = await service.CreateProjectAsync(command);

        result.IsSuccess.Should().BeTrue($"create failed: {result.Error} ({result.ErrorCode})");
        result.Value!.ProjectManagerId.Should().Be(employeeId);

        var assignments = await db.Set<ProjectAssignment>()
            .Where(a => a.ProjectId == result.Value.Id)
            .ToListAsync();
        assignments.Should().HaveCount(1);
        assignments[0].EmployeeId.Should().Be(employeeId);
        assignments[0].Role.Should().Be(AssignmentRole.Manager);
        assignments[0].IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task CreateProjectAsync_ActivateOnCreate_SetsActiveStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new CreateProjectCommand(
            Name: "Immediate Active",
            Number: "PRJ-ACT-001",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 200_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null,
            ActivateOnCreate: true);

        var result = await service.CreateProjectAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ProjectStatus.Active);
        result.Value.StartDate.Should().NotBeNull();
    }

    #endregion

    #region ActivateProjectAsync

    [Fact]
    public async Task ActivateProjectAsync_PreConstruction_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Activate Me",
            Number = "PRJ-ACT-002",
            Status = ProjectStatus.PreConstruction,
            Type = ProjectType.Commercial,
            ContractAmount = 150_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.ActivateProjectAsync(project.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ProjectStatus.Active);
        result.Value.StartDate.Should().NotBeNull();
    }

    [Fact]
    public async Task ActivateProjectAsync_AlreadyActive_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Already Active",
            Number = "PRJ-ACT-003",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            ContractAmount = 100_000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.ActivateProjectAsync(project.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ActivateProjectAsync_RequiresBudget_WhenCompanySettingEnabled()
    {
        using var db = TestDbContextFactory.Create();
        _companyContextMock.Setup(c => c.IsResolved).Returns(true);
        _companyContextMock.Setup(c => c.CompanyId).Returns(TestDbContextFactory.TestCompanyId);

        db.Set<Company>().Add(new Company
        {
            Id = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Code = "01",
            Name = "Test Company",
            ProjectSettings = new ProjectSettings { RequireBudgetBeforeActivation = true }
        });

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "No Budget",
            Number = "PRJ-ACT-004",
            Status = ProjectStatus.PreConstruction,
            Type = ProjectType.Commercial,
            ContractAmount = 0m,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.ActivateProjectAsync(project.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("BUDGET_REQUIRED");
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

    #region GetProjectRfiCostSummaryAsync

    [Fact]
    public async Task GetProjectRfiCostSummaryAsync_ExistingProject_ReturnsSummary()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Cost Summary Test",
            Number = "PRJ-COST-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetProjectRfiCostSummaryAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.ProjectId.Should().Be(project.Id);
        result.Value.ProjectName.Should().Be("Cost Summary Test");
        result.Value.TotalRfis.Should().Be(0);
    }

    [Fact]
    public async Task GetProjectRfiCostSummaryAsync_NonExistentProject_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.GetProjectRfiCostSummaryAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PROJECT_NOT_FOUND");
    }

    [Fact]
    public async Task GetProjectRfiCostSummaryAsync_WithRfis_CountsCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "RFI Test Project",
            Number = "PRJ-RFI-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);

        // Add RFIs in different statuses
        db.Set<Rfi>().Add(new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Open RFI 1",
            Question = "Question",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal,
            ProjectId = project.Id,
            CreatedAt = DateTime.UtcNow
        });
        db.Set<Rfi>().Add(new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 2,
            Subject = "Open RFI 2",
            Question = "Question",
            Status = RfiStatus.Open,
            Priority = RfiPriority.High,
            ProjectId = project.Id,
            DueDate = DateTime.UtcNow.AddDays(-5), // Overdue
            CreatedAt = DateTime.UtcNow.AddDays(-10)
        });
        db.Set<Rfi>().Add(new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 3,
            Subject = "Closed RFI",
            Question = "Question",
            Status = RfiStatus.Closed,
            Priority = RfiPriority.Normal,
            ProjectId = project.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-20),
            ClosedAt = DateTime.UtcNow.AddDays(-10)
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetProjectRfiCostSummaryAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalRfis.Should().Be(3);
        result.Value.OpenRfis.Should().Be(2);
        result.Value.OverdueRfis.Should().Be(1); // Only the one with past due date
    }

    [Fact]
    public async Task GetProjectRfiCostSummaryAsync_WithChangeOrders_CalculatesCostsCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "CO Test Project",
            Number = "PRJ-CO-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);

        // Create a subcontract for change orders
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SubcontractNumber = "SC-001",
            SubcontractorName = "Test Contractor",
            ScopeOfWork = "Test work",
            OriginalValue = 100000m,
            CurrentValue = 100000m,
            Status = SubcontractStatus.Executed,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Subcontract>().Add(subcontract);

        var rfi1 = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "RFI with cost impact",
            Question = "Question",
            Status = RfiStatus.Closed,
            Priority = RfiPriority.High,
            ProjectId = project.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            ClosedAt = DateTime.UtcNow.AddDays(-20)
        };
        db.Set<Rfi>().Add(rfi1);

        var rfi2 = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 2,
            Subject = "RFI without cost impact",
            Question = "Question",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal,
            ProjectId = project.Id,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Rfi>().Add(rfi2);

        // Add change orders linked to rfi1
        db.Set<ChangeOrder>().Add(new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontract.Id,
            ChangeOrderNumber = "CO-001",
            Title = "Foundation change",
            Amount = 25000m,
            DelayDays = 5,
            DelayCost = 10000m,
            Status = ChangeOrderStatus.Approved,
            OriginatingRfiId = rfi1.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-25)
        });
        db.Set<ChangeOrder>().Add(new ChangeOrder
        {
            Id = Guid.NewGuid(),
            SubcontractId = subcontract.Id,
            ChangeOrderNumber = "CO-002",
            Title = "Additional work",
            Amount = 15000m,
            DelayDays = 3,
            DelayCost = 5000m,
            Status = ChangeOrderStatus.Approved,
            OriginatingRfiId = rfi1.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-20)
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetProjectRfiCostSummaryAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalRfis.Should().Be(2);
        result.Value.RfisWithCostImpact.Should().Be(1); // Only rfi1 has linked COs
        result.Value.TotalDirectCost.Should().Be(40000m); // 25000 + 15000
        result.Value.TotalDelayCost.Should().Be(15000m); // 10000 + 5000
        result.Value.TotalCost.Should().Be(55000m);
        result.Value.TotalDelayDays.Should().Be(8); // 5 + 3
        result.Value.TopCostlyRfis.Should().HaveCount(1);
        result.Value.TopCostlyRfis[0].TotalCost.Should().Be(55000m);
    }

    [Fact]
    public async Task GetProjectRfiCostSummaryAsync_CalculatesAverageResolutionDays()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Resolution Test",
            Number = "PRJ-RES-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Project>().Add(project);

        // Add closed RFIs with different resolution times
        db.Set<Rfi>().Add(new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Quick RFI",
            Question = "Question",
            Status = RfiStatus.Closed,
            Priority = RfiPriority.Normal,
            ProjectId = project.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            ClosedAt = DateTime.UtcNow.AddDays(-5) // 5 days to resolve
        });
        db.Set<Rfi>().Add(new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 2,
            Subject = "Slow RFI",
            Question = "Question",
            Status = RfiStatus.Closed,
            Priority = RfiPriority.Normal,
            ProjectId = project.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-25),
            ClosedAt = DateTime.UtcNow.AddDays(-10) // 15 days to resolve
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);

        // Act
        var result = await service.GetProjectRfiCostSummaryAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.AverageResolutionDays.Should().Be(10.0); // (5 + 15) / 2
    }

    #endregion
}
