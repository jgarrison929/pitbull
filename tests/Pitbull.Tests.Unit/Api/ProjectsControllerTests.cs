using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Services;
using Pitbull.Core.CQRS;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.GetProjectRfiCostSummary;
using Pitbull.Projects.Features.GetProjectStats;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;
using Pitbull.Projects.Services;

namespace Pitbull.Tests.Unit.Api;

public class ProjectsControllerTests
{
    private readonly Mock<IProjectService> _projectServiceMock;
    private readonly Mock<IAiInsightsService> _aiServiceMock;
    private readonly ProjectsController _controller;

    private static readonly Guid TestId = Guid.NewGuid();
    private static readonly Guid TestManagerId = Guid.NewGuid();

    public ProjectsControllerTests()
    {
        _projectServiceMock = new Mock<IProjectService>();
        _aiServiceMock = new Mock<IAiInsightsService>();
        var cacheServiceMock = new Mock<ICacheService>();
        // Default mock: always pass through to factory
        cacheServiceMock.Setup(c => c.GetOrCreateAsync(It.IsAny<string>(), It.IsAny<Func<Task<Result<PagedResult<ProjectDto>>>>>(), It.IsAny<TimeSpan>()))
            .Returns<string, Func<Task<Result<PagedResult<ProjectDto>>>>, TimeSpan>((_, factory, _) => factory());
        _controller = new ProjectsController(_projectServiceMock.Object, _aiServiceMock.Object, cacheServiceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static ProjectDto CreateTestDto(Guid? id = null) => new(
        Id: id ?? TestId,
        Name: "Downtown Office",
        Number: "PRJ-001",
        Description: "Office renovation",
        Status: ProjectStatus.Active,
        Type: ProjectType.Commercial,
        Address: "123 Main St",
        City: "Fresno",
        State: "CA",
        ZipCode: "93721",
        ClientName: "Acme Corp",
        ClientContact: "John Doe",
        ClientEmail: "john@acme.com",
        ClientPhone: "555-1234",
        StartDate: DateTime.UtcNow,
        EstimatedCompletionDate: DateTime.UtcNow.AddMonths(6),
        ActualCompletionDate: null,
        ContractAmount: 2_500_000m,
        ProjectManagerId: TestManagerId,
        SuperintendentId: null,
        SourceBidId: null,
        CreatedAt: DateTime.UtcNow
    );

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithProject()
    {
        var dto = CreateTestDto();
        _projectServiceMock
            .Setup(s => s.CreateProjectAsync(It.IsAny<CreateProjectCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new CreateProjectCommand(
            "Downtown Office", "PRJ-001", "Office renovation",
            ProjectType.Commercial, null, null, null, null,
            "Acme Corp", null, null, null, null, null, 2_500_000m, null, null, null);

        var result = await _controller.Create(command);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        created.Value.Should().Be(dto);
        created.ActionName.Should().Be("GetById");
    }

    [Fact]
    public async Task Create_ValidationError_Returns400()
    {
        _projectServiceMock
            .Setup(s => s.CreateProjectAsync(It.IsAny<CreateProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ProjectDto>("Duplicate project number", "DUPLICATE"));

        var command = new CreateProjectCommand(
            "Test", "PRJ-001", null, ProjectType.Commercial,
            null, null, null, null, null, null, null, null, null, null, 0, null, null, null);

        var result = await _controller.Create(command);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto();
        _projectServiceMock
            .Setup(s => s.GetProjectAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _projectServiceMock
            .Setup(s => s.GetProjectAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ProjectDto>("Project not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _projectServiceMock
            .Setup(s => s.GetProjectAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ProjectDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var pagedResult = new PagedResult<ProjectDto>(
            new[] { CreateTestDto() }, 1, 1, 10);
        _projectServiceMock
            .Setup(s => s.GetProjectsAsync(It.IsAny<ListProjectsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(pagedResult);
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var pagedResult = new PagedResult<ProjectDto>(
            Array.Empty<ProjectDto>(), 0, 1, 10);
        _projectServiceMock
            .Setup(s => s.GetProjectsAsync(It.IsAny<ListProjectsQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(
            ProjectStatus.Active,
            ProjectType.Commercial,
            "bridge",
            unbilled: false,
            budgetAlert: false,
            budgetAlertPercent: 75,
            page: 2,
            pageSize: 25);

        _projectServiceMock.Verify(s => s.GetProjectsAsync(
            It.Is<ListProjectsQuery>(q =>
                q.Status == ProjectStatus.Active &&
                q.Type == ProjectType.Commercial &&
                q.Search == "bridge" &&
                q.Page == 2 &&
                q.PageSize == 25),
            default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _projectServiceMock
            .Setup(s => s.GetProjectsAsync(It.IsAny<ListProjectsQuery>(), default))
            .ReturnsAsync(Result.Failure<PagedResult<ProjectDto>>("Invalid query"));

        var result = await _controller.List(null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto();
        _projectServiceMock
            .Setup(s => s.UpdateProjectAsync(It.IsAny<UpdateProjectCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var command = new UpdateProjectCommand(
            Guid.Empty, "Updated", "PRJ-001", null, ProjectStatus.Active,
            ProjectType.Commercial, null, null, null, null, null, null, null, null,
            null, null, null, 3_000_000m, null, null);

        var result = await _controller.Update(TestId, command);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Update_SetsIdFromRoute()
    {
        _projectServiceMock
            .Setup(s => s.UpdateProjectAsync(It.IsAny<UpdateProjectCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var command = new UpdateProjectCommand(
            Guid.Empty, "Updated", "PRJ-001", null, ProjectStatus.Active,
            ProjectType.Commercial, null, null, null, null, null, null, null, null,
            null, null, null, 3_000_000m, null, null);

        await _controller.Update(TestId, command);

        _projectServiceMock.Verify(s => s.UpdateProjectAsync(
            It.Is<UpdateProjectCommand>(c => c.Id == TestId),
            default), Times.Once);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _projectServiceMock
            .Setup(s => s.UpdateProjectAsync(It.IsAny<UpdateProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ProjectDto>("Project not found", "NOT_FOUND"));

        var command = new UpdateProjectCommand(
            TestId, "Updated", "PRJ-001", null, ProjectStatus.Active,
            ProjectType.Commercial, null, null, null, null, null, null, null, null,
            null, null, null, 3_000_000m, null, null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_Conflict_Returns409()
    {
        _projectServiceMock
            .Setup(s => s.UpdateProjectAsync(It.IsAny<UpdateProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ProjectDto>("Concurrent modification", "CONFLICT"));

        var command = new UpdateProjectCommand(
            TestId, "Updated", "PRJ-001", null, ProjectStatus.Active,
            ProjectType.Commercial, null, null, null, null, null, null, null, null,
            null, null, null, 3_000_000m, null, null);

        var result = await _controller.Update(TestId, command);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Update_ValidationError_Returns400()
    {
        _projectServiceMock
            .Setup(s => s.UpdateProjectAsync(It.IsAny<UpdateProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ProjectDto>("Name is required", "VALIDATION_ERROR"));

        var command = new UpdateProjectCommand(
            TestId, "", "PRJ-001", null, ProjectStatus.Active,
            ProjectType.Commercial, null, null, null, null, null, null, null, null,
            null, null, null, 0, null, null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _projectServiceMock
            .Setup(s => s.UpdateProjectAsync(It.IsAny<UpdateProjectCommand>(), default))
            .ReturnsAsync(Result.Failure<ProjectDto>("Unknown error", "UNKNOWN"));

        var command = new UpdateProjectCommand(
            TestId, "Test", "PRJ-001", null, ProjectStatus.Active,
            ProjectType.Commercial, null, null, null, null, null, null, null, null,
            null, null, null, 0, null, null);

        var result = await _controller.Update(TestId, command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Delete

    [Fact]
    public async Task Delete_Success_Returns204()
    {
        _projectServiceMock
            .Setup(s => s.DeleteProjectAsync(TestId, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        _projectServiceMock
            .Setup(s => s.DeleteProjectAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Project not found", "NOT_FOUND"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_OtherError_Returns400()
    {
        _projectServiceMock
            .Setup(s => s.DeleteProjectAsync(TestId, default))
            .ReturnsAsync(Result.Failure("Cannot delete", "HAS_DEPENDENCIES"));

        var result = await _controller.Delete(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region GetAiSummary

    [Fact]
    public async Task GetAiSummary_Success_Returns200()
    {
        var dto = CreateTestDto();
        _projectServiceMock
            .Setup(s => s.GetProjectAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var aiResult = new AiProjectSummaryResult
        {
            Success = true,
            Summary = "Project is on track",
            HealthScore = 85,
            HealthStatus = "Good"
        };
        _aiServiceMock
            .Setup(s => s.GetProjectSummaryAsync(TestId, default))
            .ReturnsAsync(aiResult);

        var result = await _controller.GetAiSummary(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(aiResult);
    }

    [Fact]
    public async Task GetAiSummary_ProjectNotFound_Returns404()
    {
        _projectServiceMock
            .Setup(s => s.GetProjectAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ProjectDto>("Project not found", "NOT_FOUND"));

        var result = await _controller.GetAiSummary(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetAiSummary_AiNotConfigured_Returns503()
    {
        var dto = CreateTestDto();
        _projectServiceMock
            .Setup(s => s.GetProjectAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        _aiServiceMock
            .Setup(s => s.GetProjectSummaryAsync(TestId, default))
            .ReturnsAsync(new AiProjectSummaryResult
            {
                Success = false,
                Error = "AI service not configured"
            });

        var result = await _controller.GetAiSummary(TestId);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task GetAiSummary_AiError_Returns503()
    {
        var dto = CreateTestDto();
        _projectServiceMock
            .Setup(s => s.GetProjectAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        _aiServiceMock
            .Setup(s => s.GetProjectSummaryAsync(TestId, default))
            .ReturnsAsync(new AiProjectSummaryResult
            {
                Success = false,
                Error = "Claude API timeout"
            });

        var result = await _controller.GetAiSummary(TestId);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task GetAiSummary_AiReturnsNotFound_Returns404()
    {
        var dto = CreateTestDto();
        _projectServiceMock
            .Setup(s => s.GetProjectAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        _aiServiceMock
            .Setup(s => s.GetProjectSummaryAsync(TestId, default))
            .ReturnsAsync(new AiProjectSummaryResult
            {
                Success = false,
                Error = "Project not found in analysis data"
            });

        var result = await _controller.GetAiSummary(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region GetStats

    [Fact]
    public async Task GetStats_Success_Returns200()
    {
        var stats = new ProjectStatsResponse(
            TestId, "Downtown", "PRJ-001",
            TotalHours: 240m, RegularHours: 200m, OvertimeHours: 40m, DoubleTimeHours: 0,
            TotalLaborCost: 12000m, TimeEntryCount: 30, ApprovedEntryCount: 25,
            PendingEntryCount: 5, AssignedEmployeeCount: 8,
            FirstEntryDate: new DateOnly(2026, 1, 15), LastEntryDate: new DateOnly(2026, 2, 14));

        _projectServiceMock
            .Setup(s => s.GetProjectStatsAsync(TestId, default))
            .ReturnsAsync(Result.Success(stats));

        var result = await _controller.GetStats(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(stats);
    }

    [Fact]
    public async Task GetStats_NotFound_Returns404()
    {
        _projectServiceMock
            .Setup(s => s.GetProjectStatsAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ProjectStatsResponse>("Project not found", "PROJECT_NOT_FOUND"));

        var result = await _controller.GetStats(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetStats_OtherError_Returns400()
    {
        _projectServiceMock
            .Setup(s => s.GetProjectStatsAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ProjectStatsResponse>("Database error", "DB_ERROR"));

        var result = await _controller.GetStats(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region GetRfiCostSummary

    [Fact]
    public async Task GetRfiCostSummary_Success_Returns200()
    {
        var summary = new ProjectRfiCostSummaryDto(
            TestId, "Downtown", "PRJ-001",
            TotalRfis: 12, OpenRfis: 3, RfisWithCostImpact: 8, OverdueRfis: 1,
            TotalDirectCost: 150_000m, TotalDelayCost: 173_500m, TotalCost: 323_500m,
            TotalDelayDays: 45, AverageResolutionDays: 7.5,
            TopCostlyRfis: new List<TopCostlyRfiDto>());

        _projectServiceMock
            .Setup(s => s.GetProjectRfiCostSummaryAsync(TestId, default))
            .ReturnsAsync(Result.Success(summary));

        var result = await _controller.GetRfiCostSummary(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(summary);
    }

    [Fact]
    public async Task GetRfiCostSummary_NotFound_Returns404()
    {
        _projectServiceMock
            .Setup(s => s.GetProjectRfiCostSummaryAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ProjectRfiCostSummaryDto>("Project not found", "PROJECT_NOT_FOUND"));

        var result = await _controller.GetRfiCostSummary(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetRfiCostSummary_OtherError_Returns400()
    {
        _projectServiceMock
            .Setup(s => s.GetProjectRfiCostSummaryAsync(TestId, default))
            .ReturnsAsync(Result.Failure<ProjectRfiCostSummaryDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetRfiCostSummary(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion
}
