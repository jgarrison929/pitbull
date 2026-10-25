using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Api;

public class ProjectAssignmentsControllerTests
{
    private readonly Mock<IProjectAssignmentService> _serviceMock;
    private readonly ProjectAssignmentsController _controller;

    private static readonly Guid TestEmployeeId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();
    private static readonly Guid TestAssignmentId = Guid.NewGuid();

    public ProjectAssignmentsControllerTests()
    {
        _serviceMock = new Mock<IProjectAssignmentService>();
        _controller = new ProjectAssignmentsController(_serviceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static ProjectAssignmentDto CreateTestDto(Guid? id = null) => new(
        Id: id ?? TestAssignmentId,
        EmployeeId: TestEmployeeId,
        EmployeeName: "John Smith",
        EmployeeNumber: "EMP-001",
        ProjectId: TestProjectId,
        ProjectName: "Highway Bridge Repair",
        ProjectNumber: "PRJ-2026-001",
        Role: AssignmentRole.Worker,
        RoleDescription: "Worker",
        StartDate: new DateOnly(2026, 1, 15),
        EndDate: null,
        IsActive: true,
        Notes: "Assigned to concrete crew",
        CreatedAt: new DateTime(2026, 1, 15, 8, 0, 0, DateTimeKind.Utc),
        UpdatedAt: null
    );

    #region Assign

    [Fact]
    public async Task Assign_Success_Returns201WithAssignment()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.AssignEmployeeToProjectAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AssignmentRole>(),
                It.IsAny<DateOnly?>(), It.IsAny<DateOnly?>(), It.IsAny<string?>(),
                default))
            .ReturnsAsync(Result.Success(dto));

        var request = new AssignEmployeeRequest(
            EmployeeId: TestEmployeeId,
            ProjectId: TestProjectId,
            Role: AssignmentRole.Worker,
            StartDate: new DateOnly(2026, 1, 15),
            EndDate: null,
            Notes: "Assigned to concrete crew"
        );

        var result = await _controller.Assign(request);

        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.StatusCode.Should().Be(201);
        createdResult.Value.Should().BeEquivalentTo(dto);
    }

    [Fact]
    public async Task Assign_EmployeeNotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.AssignEmployeeToProjectAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AssignmentRole>(),
                It.IsAny<DateOnly?>(), It.IsAny<DateOnly?>(), It.IsAny<string?>(),
                default))
            .ReturnsAsync(Result.Failure<ProjectAssignmentDto>("Employee not found", "EMPLOYEE_NOT_FOUND"));

        var request = new AssignEmployeeRequest(TestEmployeeId, TestProjectId);

        var result = await _controller.Assign(request);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Assign_ProjectNotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.AssignEmployeeToProjectAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AssignmentRole>(),
                It.IsAny<DateOnly?>(), It.IsAny<DateOnly?>(), It.IsAny<string?>(),
                default))
            .ReturnsAsync(Result.Failure<ProjectAssignmentDto>("Project not found", "PROJECT_NOT_FOUND"));

        var request = new AssignEmployeeRequest(TestEmployeeId, TestProjectId);

        var result = await _controller.Assign(request);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Assign_AlreadyAssigned_Returns409()
    {
        _serviceMock
            .Setup(s => s.AssignEmployeeToProjectAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AssignmentRole>(),
                It.IsAny<DateOnly?>(), It.IsAny<DateOnly?>(), It.IsAny<string?>(),
                default))
            .ReturnsAsync(Result.Failure<ProjectAssignmentDto>("Employee already assigned to this project", "ALREADY_ASSIGNED"));

        var request = new AssignEmployeeRequest(TestEmployeeId, TestProjectId);

        var result = await _controller.Assign(request);

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Assign_ValidationFailure_Returns400()
    {
        _serviceMock
            .Setup(s => s.AssignEmployeeToProjectAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AssignmentRole>(),
                It.IsAny<DateOnly?>(), It.IsAny<DateOnly?>(), It.IsAny<string?>(),
                default))
            .ReturnsAsync(Result.Failure<ProjectAssignmentDto>("End date must be after start date", "VALIDATION_FAILED"));

        var request = new AssignEmployeeRequest(
            TestEmployeeId, TestProjectId,
            StartDate: new DateOnly(2026, 12, 31),
            EndDate: new DateOnly(2026, 1, 1)
        );

        var result = await _controller.Assign(request);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Assign_PassesCorrectParametersToService()
    {
        var dto = CreateTestDto();
        Guid capturedEmployeeId = Guid.Empty;
        Guid capturedProjectId = Guid.Empty;
        AssignmentRole capturedRole = default;
        DateOnly? capturedStartDate = null;
        DateOnly? capturedEndDate = null;
        string? capturedNotes = null;

        _serviceMock
            .Setup(s => s.AssignEmployeeToProjectAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AssignmentRole>(),
                It.IsAny<DateOnly?>(), It.IsAny<DateOnly?>(), It.IsAny<string?>(),
                default))
            .Callback<Guid, Guid, AssignmentRole, DateOnly?, DateOnly?, string?, CancellationToken>(
                (empId, projId, role, start, end, notes, _) =>
                {
                    capturedEmployeeId = empId;
                    capturedProjectId = projId;
                    capturedRole = role;
                    capturedStartDate = start;
                    capturedEndDate = end;
                    capturedNotes = notes;
                })
            .ReturnsAsync(Result.Success(dto));

        var request = new AssignEmployeeRequest(
            EmployeeId: TestEmployeeId,
            ProjectId: TestProjectId,
            Role: AssignmentRole.Supervisor,
            StartDate: new DateOnly(2026, 3, 1),
            EndDate: new DateOnly(2026, 12, 31),
            Notes: "Lead supervisor"
        );

        await _controller.Assign(request);

        capturedEmployeeId.Should().Be(TestEmployeeId);
        capturedProjectId.Should().Be(TestProjectId);
        capturedRole.Should().Be(AssignmentRole.Supervisor);
        capturedStartDate.Should().Be(new DateOnly(2026, 3, 1));
        capturedEndDate.Should().Be(new DateOnly(2026, 12, 31));
        capturedNotes.Should().Be("Lead supervisor");
    }

    [Fact]
    public async Task Assign_Success_ReturnsCreatedAtActionPointingToGetByProject()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.AssignEmployeeToProjectAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<AssignmentRole>(),
                It.IsAny<DateOnly?>(), It.IsAny<DateOnly?>(), It.IsAny<string?>(),
                default))
            .ReturnsAsync(Result.Success(dto));

        var request = new AssignEmployeeRequest(TestEmployeeId, TestProjectId);

        var result = await _controller.Assign(request);

        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.ActionName.Should().Be("GetByProject");
        createdResult.RouteValues!["projectId"].Should().Be(TestProjectId);
    }

    #endregion

    #region GetByProject

    [Fact]
    public async Task GetByProject_Success_Returns200WithList()
    {
        var assignments = new List<ProjectAssignmentDto> { CreateTestDto(), CreateTestDto(Guid.NewGuid()) };
        _serviceMock
            .Setup(s => s.GetProjectAssignmentsAsync(TestProjectId, true, default))
            .ReturnsAsync(Result.Success<IReadOnlyList<ProjectAssignmentDto>>(assignments));

        var result = await _controller.GetByProject(TestProjectId);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        var returnedList = okResult.Value.Should().BeAssignableTo<IReadOnlyList<ProjectAssignmentDto>>().Subject;
        returnedList.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetByProject_DefaultsToActiveOnlyTrue()
    {
        var assignments = new List<ProjectAssignmentDto>();
        _serviceMock
            .Setup(s => s.GetProjectAssignmentsAsync(TestProjectId, true, default))
            .ReturnsAsync(Result.Success<IReadOnlyList<ProjectAssignmentDto>>(assignments));

        await _controller.GetByProject(TestProjectId);

        _serviceMock.Verify(s => s.GetProjectAssignmentsAsync(TestProjectId, true, default), Times.Once);
    }

    [Fact]
    public async Task GetByProject_Failure_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetProjectAssignmentsAsync(TestProjectId, true, default))
            .ReturnsAsync(Result.Failure<IReadOnlyList<ProjectAssignmentDto>>("Something went wrong"));

        var result = await _controller.GetByProject(TestProjectId);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    #endregion

    #region GetByEmployee

    [Fact]
    public async Task GetByEmployee_Success_Returns200WithList()
    {
        var assignments = new List<ProjectAssignmentDto> { CreateTestDto() };
        _serviceMock
            .Setup(s => s.GetEmployeeProjectsAsync(TestEmployeeId, true, null, default))
            .ReturnsAsync(Result.Success<IReadOnlyList<ProjectAssignmentDto>>(assignments));

        var result = await _controller.GetByEmployee(TestEmployeeId);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        var returnedList = okResult.Value.Should().BeAssignableTo<IReadOnlyList<ProjectAssignmentDto>>().Subject;
        returnedList.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetByEmployee_PassesActiveOnlyAndAsOfDateCorrectly()
    {
        var asOfDate = new DateOnly(2026, 6, 15);
        var assignments = new List<ProjectAssignmentDto>();
        _serviceMock
            .Setup(s => s.GetEmployeeProjectsAsync(TestEmployeeId, false, asOfDate, default))
            .ReturnsAsync(Result.Success<IReadOnlyList<ProjectAssignmentDto>>(assignments));

        await _controller.GetByEmployee(TestEmployeeId, activeOnly: false, asOfDate: asOfDate);

        _serviceMock.Verify(
            s => s.GetEmployeeProjectsAsync(TestEmployeeId, false, asOfDate, default),
            Times.Once);
    }

    [Fact]
    public async Task GetByEmployee_Failure_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetEmployeeProjectsAsync(TestEmployeeId, true, null, default))
            .ReturnsAsync(Result.Failure<IReadOnlyList<ProjectAssignmentDto>>("Query failed"));

        var result = await _controller.GetByEmployee(TestEmployeeId);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    #endregion

    #region Remove

    [Fact]
    public async Task Remove_Success_Returns204()
    {
        _serviceMock
            .Setup(s => s.RemoveAssignmentAsync(TestAssignmentId, null, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.Remove(TestAssignmentId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Remove_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.RemoveAssignmentAsync(TestAssignmentId, null, default))
            .ReturnsAsync(Result.Failure("Assignment not found", "NOT_FOUND"));

        var result = await _controller.Remove(TestAssignmentId);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Remove_AssignmentNotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.RemoveAssignmentAsync(TestAssignmentId, null, default))
            .ReturnsAsync(Result.Failure("Assignment not found", "ASSIGNMENT_NOT_FOUND"));

        var result = await _controller.Remove(TestAssignmentId);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Remove_OtherFailure_Returns400()
    {
        _serviceMock
            .Setup(s => s.RemoveAssignmentAsync(TestAssignmentId, null, default))
            .ReturnsAsync(Result.Failure("Cannot remove active assignment", "INVALID_STATE"));

        var result = await _controller.Remove(TestAssignmentId);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Remove_PassesEndDateToService()
    {
        var endDate = new DateOnly(2026, 3, 31);
        _serviceMock
            .Setup(s => s.RemoveAssignmentAsync(TestAssignmentId, endDate, default))
            .ReturnsAsync(Result.Success());

        await _controller.Remove(TestAssignmentId, endDate);

        _serviceMock.Verify(s => s.RemoveAssignmentAsync(TestAssignmentId, endDate, default), Times.Once);
    }

    #endregion

    #region RemoveByIds

    [Fact]
    public async Task RemoveByIds_Success_Returns204()
    {
        _serviceMock
            .Setup(s => s.RemoveAssignmentByIdsAsync(TestEmployeeId, TestProjectId, null, default))
            .ReturnsAsync(Result.Success());

        var result = await _controller.RemoveByIds(TestEmployeeId, TestProjectId);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task RemoveByIds_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.RemoveAssignmentByIdsAsync(TestEmployeeId, TestProjectId, null, default))
            .ReturnsAsync(Result.Failure("No active assignment found", "NOT_FOUND"));

        var result = await _controller.RemoveByIds(TestEmployeeId, TestProjectId);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RemoveByIds_OtherFailure_Returns400()
    {
        _serviceMock
            .Setup(s => s.RemoveAssignmentByIdsAsync(TestEmployeeId, TestProjectId, null, default))
            .ReturnsAsync(Result.Failure("Something went wrong", "INTERNAL_ERROR"));

        var result = await _controller.RemoveByIds(TestEmployeeId, TestProjectId);

        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task RemoveByIds_PassesEndDateToService()
    {
        var endDate = new DateOnly(2026, 6, 30);
        _serviceMock
            .Setup(s => s.RemoveAssignmentByIdsAsync(TestEmployeeId, TestProjectId, endDate, default))
            .ReturnsAsync(Result.Success());

        await _controller.RemoveByIds(TestEmployeeId, TestProjectId, endDate);

        _serviceMock.Verify(
            s => s.RemoveAssignmentByIdsAsync(TestEmployeeId, TestProjectId, endDate, default),
            Times.Once);
    }

    #endregion
}
