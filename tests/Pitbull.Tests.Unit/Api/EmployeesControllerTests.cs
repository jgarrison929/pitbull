using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Services;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateEmployee;
using Pitbull.TimeTracking.Features.GetEmployeeStats;
using Pitbull.TimeTracking.Features.ListEmployees;
using Pitbull.TimeTracking.Features.UpdateEmployee;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Api;

public class EmployeesControllerTests
{
    private readonly Mock<IEmployeeService> _serviceMock;
    private readonly EmployeesController _controller;

    private static readonly Guid TestId = Guid.NewGuid();
    private static readonly Guid TestSupervisorId = Guid.NewGuid();

    public EmployeesControllerTests()
    {
        _serviceMock = new Mock<IEmployeeService>();
        var cacheServiceMock = new Mock<ICacheService>();
        cacheServiceMock.Setup(c => c.GetOrCreateAsync(It.IsAny<string>(), It.IsAny<Func<Task<Result<PagedResult<EmployeeDto>>>>>(), It.IsAny<TimeSpan>()))
            .Returns<string, Func<Task<Result<PagedResult<EmployeeDto>>>>, TimeSpan>((_, factory, _) => factory());
        _controller = new EmployeesController(_serviceMock.Object, null!, cacheServiceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static EmployeeDto CreateTestDto(
        Guid? id = null,
        bool isActive = true) => new(
        Id: id ?? TestId,
        EmployeeNumber: "EMP-00001",
        FirstName: "John",
        LastName: "Smith",
        FullName: "John Smith",
        Email: "john.smith@example.com",
        Phone: "(555) 123-4567",
        Title: "Carpenter",
        Classification: EmployeeClassification.Hourly,
        BaseHourlyRate: 45.00m,
        IsActive: isActive,
        HireDate: new DateOnly(2026, 1, 15),
        TerminationDate: null,
        SupervisorId: TestSupervisorId,
        SupervisorName: "Jane Doe",
        CreatedAt: DateTime.UtcNow,
        UpdatedAt: null
    );

    private static ProjectAssignmentDto CreateTestAssignmentDto() => new(
        Id: Guid.NewGuid(),
        EmployeeId: TestId,
        EmployeeName: "John Smith",
        EmployeeNumber: "EMP-00001",
        ProjectId: Guid.NewGuid(),
        ProjectName: "Downtown Office",
        ProjectNumber: "PRJ-001",
        Role: AssignmentRole.Worker,
        RoleDescription: "Laborer",
        StartDate: new DateOnly(2026, 1, 15),
        EndDate: null,
        IsActive: true,
        Notes: null,
        CreatedAt: DateTime.UtcNow,
        UpdatedAt: null
    );

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithEmployee()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.CreateEmployeeAsync(It.IsAny<CreateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new CreateEmployeeRequest(
            EmployeeNumber: "EMP-00001",
            FirstName: "John",
            LastName: "Smith",
            Email: "john.smith@example.com",
            Phone: "(555) 123-4567",
            Title: "Carpenter",
            Classification: EmployeeClassification.Hourly,
            BaseHourlyRate: 45.00m,
            HireDate: new DateOnly(2026, 1, 15));

        var result = await _controller.Create(request);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        created.Value.Should().Be(dto);
        created.ActionName.Should().Be("GetById");
    }

    [Fact]
    public async Task Create_DuplicateEmployeeNumber_Returns409()
    {
        _serviceMock
            .Setup(s => s.CreateEmployeeAsync(It.IsAny<CreateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Failure<EmployeeDto>("Employee number already exists", "DUPLICATE"));

        var request = new CreateEmployeeRequest(
            EmployeeNumber: "EMP-00001",
            FirstName: "John",
            LastName: "Smith");

        var result = await _controller.Create(request);

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Create_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateEmployeeAsync(It.IsAny<CreateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Failure<EmployeeDto>("First name is required", "VALIDATION_ERROR"));

        var request = new CreateEmployeeRequest(
            EmployeeNumber: null,
            FirstName: "",
            LastName: "Smith");

        var result = await _controller.Create(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_PassesAllFieldsToService()
    {
        var supervisorId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.CreateEmployeeAsync(It.IsAny<CreateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new CreateEmployeeRequest(
            EmployeeNumber: "EMP-00099",
            FirstName: "Jane",
            LastName: "Doe",
            Email: "jane@example.com",
            Phone: "(555) 999-0000",
            Title: "Electrician",
            Classification: EmployeeClassification.Salaried,
            BaseHourlyRate: 55.00m,
            HireDate: new DateOnly(2026, 2, 1),
            SupervisorId: supervisorId,
            Notes: "Certified journeyman");

        await _controller.Create(request);

        _serviceMock.Verify(s => s.CreateEmployeeAsync(
            It.Is<CreateEmployeeCommand>(c =>
                c.FirstName == "Jane" &&
                c.LastName == "Doe" &&
                c.EmployeeNumber == "EMP-00099" &&
                c.Email == "jane@example.com" &&
                c.Phone == "(555) 999-0000" &&
                c.Title == "Electrician" &&
                c.Classification == EmployeeClassification.Salaried &&
                c.BaseHourlyRate == 55.00m &&
                c.HireDate == new DateOnly(2026, 2, 1) &&
                c.SupervisorId == supervisorId &&
                c.Notes == "Certified journeyman"),
            default), Times.Once);
    }

    [Fact]
    public async Task Create_InvalidSupervisor_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateEmployeeAsync(It.IsAny<CreateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Failure<EmployeeDto>("Supervisor not found", "INVALID_SUPERVISOR"));

        var request = new CreateEmployeeRequest(
            EmployeeNumber: null,
            FirstName: "John",
            LastName: "Smith",
            SupervisorId: Guid.NewGuid());

        var result = await _controller.Create(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetEmployeeAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeAsync(TestId, default))
            .ReturnsAsync(Result.Failure<EmployeeDto>("Employee not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeAsync(TestId, default))
            .ReturnsAsync(Result.Failure<EmployeeDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var pagedResult = new PagedResult<EmployeeDto>(
            new[] { CreateTestDto() }, TotalCount: 1, Page: 1, PageSize: 50);
        _serviceMock
            .Setup(s => s.GetEmployeesAsync(It.IsAny<ListEmployeesQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(pagedResult);
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var pagedResult = new PagedResult<EmployeeDto>(
            Array.Empty<EmployeeDto>(), 0, 2, 25);
        _serviceMock
            .Setup(s => s.GetEmployeesAsync(It.IsAny<ListEmployeesQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(true, EmployeeClassification.Hourly, "smith", 2, 25);

        _serviceMock.Verify(s => s.GetEmployeesAsync(
            It.Is<ListEmployeesQuery>(q =>
                q.IsActive == true &&
                q.Classification == EmployeeClassification.Hourly &&
                q.Search == "smith" &&
                q.Page == 2 &&
                q.PageSize == 25),
            default), Times.Once);
    }

    [Fact]
    public async Task List_DefaultPagination_PassesDefaults()
    {
        var pagedResult = new PagedResult<EmployeeDto>(
            Array.Empty<EmployeeDto>(), 0, 1, 50);
        _serviceMock
            .Setup(s => s.GetEmployeesAsync(It.IsAny<ListEmployeesQuery>(), default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.GetEmployeesAsync(
            It.Is<ListEmployeesQuery>(q =>
                q.Page == 1 &&
                q.PageSize == 50),
            default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetEmployeesAsync(It.IsAny<ListEmployeesQuery>(), default))
            .ReturnsAsync(Result.Failure<PagedResult<EmployeeDto>>("Invalid query"));

        var result = await _controller.List(null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region GetProjects

    [Fact]
    public async Task GetProjects_Success_Returns200()
    {
        var assignments = new[] { CreateTestAssignmentDto() };
        _serviceMock
            .Setup(s => s.GetEmployeeProjectsAsync(TestId, true, default))
            .ReturnsAsync(Result.Success<IEnumerable<ProjectAssignmentDto>>(assignments));

        var result = await _controller.GetProjects(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().BeEquivalentTo(assignments);
    }

    [Fact]
    public async Task GetProjects_ActiveOnlyDefault_PassesTrueToService()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeProjectsAsync(TestId, true, default))
            .ReturnsAsync(Result.Success<IEnumerable<ProjectAssignmentDto>>(
                Array.Empty<ProjectAssignmentDto>()));

        await _controller.GetProjects(TestId);

        _serviceMock.Verify(s => s.GetEmployeeProjectsAsync(TestId, true, default), Times.Once);
    }

    [Fact]
    public async Task GetProjects_ActiveOnlyFalse_PassesFalseToService()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeProjectsAsync(TestId, false, default))
            .ReturnsAsync(Result.Success<IEnumerable<ProjectAssignmentDto>>(
                Array.Empty<ProjectAssignmentDto>()));

        await _controller.GetProjects(TestId, activeOnly: false);

        _serviceMock.Verify(s => s.GetEmployeeProjectsAsync(TestId, false, default), Times.Once);
    }

    [Fact]
    public async Task GetProjects_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeProjectsAsync(TestId, true, default))
            .ReturnsAsync(Result.Failure<IEnumerable<ProjectAssignmentDto>>(
                "Employee not found", "NOT_FOUND"));

        var result = await _controller.GetProjects(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetProjects_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeProjectsAsync(TestId, true, default))
            .ReturnsAsync(Result.Failure<IEnumerable<ProjectAssignmentDto>>(
                "Database error", "DB_ERROR"));

        var result = await _controller.GetProjects(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.UpdateEmployeeAsync(It.IsAny<UpdateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new UpdateEmployeeRequest(
            FirstName: "John",
            LastName: "Smith",
            Title: "Lead Carpenter");

        var result = await _controller.Update(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateEmployeeAsync(It.IsAny<UpdateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Failure<EmployeeDto>("Employee not found", "NOT_FOUND"));

        var request = new UpdateEmployeeRequest(FirstName: "John", LastName: "Smith");

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_InvalidSupervisor_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateEmployeeAsync(It.IsAny<UpdateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Failure<EmployeeDto>("Supervisor not found", "INVALID_SUPERVISOR"));

        var request = new UpdateEmployeeRequest(
            FirstName: "John",
            LastName: "Smith",
            SupervisorId: Guid.NewGuid());

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateEmployeeAsync(It.IsAny<UpdateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Failure<EmployeeDto>("Database error", "DATABASE_ERROR"));

        var request = new UpdateEmployeeRequest(FirstName: "John", LastName: "Smith");

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_PassesIdFromRoute()
    {
        _serviceMock
            .Setup(s => s.UpdateEmployeeAsync(It.IsAny<UpdateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new UpdateEmployeeRequest(FirstName: "John", LastName: "Smith");

        await _controller.Update(TestId, request);

        _serviceMock.Verify(s => s.UpdateEmployeeAsync(
            It.Is<UpdateEmployeeCommand>(c => c.EmployeeId == TestId),
            default), Times.Once);
    }

    [Fact]
    public async Task Update_PassesAllFieldsToService()
    {
        var supervisorId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.UpdateEmployeeAsync(It.IsAny<UpdateEmployeeCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new UpdateEmployeeRequest(
            FirstName: "Jane",
            LastName: "Doe",
            Email: "jane@example.com",
            Phone: "(555) 999-0000",
            Title: "Electrician",
            Classification: EmployeeClassification.Contractor,
            BaseHourlyRate: 65.00m,
            HireDate: new DateOnly(2025, 6, 1),
            TerminationDate: new DateOnly(2026, 12, 31),
            SupervisorId: supervisorId,
            IsActive: false,
            Notes: "Contract ending");

        await _controller.Update(TestId, request);

        _serviceMock.Verify(s => s.UpdateEmployeeAsync(
            It.Is<UpdateEmployeeCommand>(c =>
                c.EmployeeId == TestId &&
                c.FirstName == "Jane" &&
                c.LastName == "Doe" &&
                c.Email == "jane@example.com" &&
                c.Phone == "(555) 999-0000" &&
                c.Title == "Electrician" &&
                c.Classification == EmployeeClassification.Contractor &&
                c.BaseHourlyRate == 65.00m &&
                c.HireDate == new DateOnly(2025, 6, 1) &&
                c.TerminationDate == new DateOnly(2026, 12, 31) &&
                c.SupervisorId == supervisorId &&
                c.IsActive == false &&
                c.Notes == "Contract ending"),
            default), Times.Once);
    }

    #endregion

    #region GetStats

    [Fact]
    public async Task GetStats_Success_Returns200()
    {
        var stats = new EmployeeStatsResponse(
            EmployeeId: TestId,
            FullName: "John Smith",
            EmployeeNumber: "EMP-00001",
            TotalHours: 240m,
            RegularHours: 200m,
            OvertimeHours: 32m,
            DoubleTimeHours: 8m,
            TotalEarnings: 12_600m,
            TimeEntryCount: 30,
            ApprovedEntryCount: 25,
            PendingEntryCount: 5,
            ProjectCount: 3,
            FirstEntryDate: new DateOnly(2026, 1, 15),
            LastEntryDate: new DateOnly(2026, 2, 14));

        _serviceMock
            .Setup(s => s.GetEmployeeStatsAsync(TestId, default))
            .ReturnsAsync(Result.Success(stats));

        var result = await _controller.GetStats(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(stats);
    }

    [Fact]
    public async Task GetStats_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeStatsAsync(TestId, default))
            .ReturnsAsync(Result.Failure<EmployeeStatsResponse>(
                "Employee not found", "EMPLOYEE_NOT_FOUND"));

        var result = await _controller.GetStats(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetStats_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeStatsAsync(TestId, default))
            .ReturnsAsync(Result.Failure<EmployeeStatsResponse>(
                "Database error", "DB_ERROR"));

        var result = await _controller.GetStats(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetStats_StatsError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeStatsAsync(TestId, default))
            .ReturnsAsync(Result.Failure<EmployeeStatsResponse>(
                "Failed to retrieve employee statistics", "EMPLOYEE_STATS_ERROR"));

        var result = await _controller.GetStats(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion
}
