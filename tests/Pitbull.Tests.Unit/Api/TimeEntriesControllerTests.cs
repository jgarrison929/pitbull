using DotNetCore.CAP;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.ExportVistaTimesheet;
using Pitbull.TimeTracking.Features.GetLaborCostReport;
using Pitbull.TimeTracking.Features.GetTimeEntriesByProject;
using Pitbull.TimeTracking.Features.ListTimeEntries;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Features.GetReviewQueue;
using Pitbull.TimeTracking.Features.ReviewTimeEntries;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Api;

public class TimeEntriesControllerTests
{
    private readonly Mock<ITimeEntryService> _serviceMock;
    private readonly Mock<ICapPublisher> _capMock;
    private readonly Mock<ITenantContext> _tenantContextMock;
    private readonly Mock<ICompanyContext> _companyContextMock;
    private readonly TimeEntriesController _controller;

    private static readonly Guid TestId = Guid.NewGuid();
    private static readonly Guid TestEmployeeId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();
    private static readonly Guid TestCostCodeId = Guid.NewGuid();
    private static readonly Guid TestApproverId = Guid.NewGuid();
    private static readonly DateOnly TestDate = new(2026, 2, 15);

    public TimeEntriesControllerTests()
    {
        _serviceMock = new Mock<ITimeEntryService>();
        _capMock = new Mock<ICapPublisher>();
        _tenantContextMock = new Mock<ITenantContext>();
        _companyContextMock = new Mock<ICompanyContext>();
        _controller = new TimeEntriesController(_serviceMock.Object, _capMock.Object, _tenantContextMock.Object, _companyContextMock.Object);

        // Set up JWT claims so GetCurrentEmployeeIdAsync() resolves an approver
        var claims = new[] { new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "approver@test.com") };
        var identity = new System.Security.Claims.ClaimsIdentity(claims, "TestAuth");
        var principal = new System.Security.Claims.ClaimsPrincipal(identity);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        // Mock employee lookup for the JWT-resolved approver
        _serviceMock
            .Setup(s => s.GetEmployeeByEmailAsync("approver@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Employee { Id = TestApproverId, FirstName = "Test", LastName = "Approver", Email = "approver@test.com", IsActive = true });
    }

    private static TimeEntryDto CreateTestDto(
        Guid? id = null,
        TimeEntryStatus status = TimeEntryStatus.Draft) => new(
        Id: id ?? TestId,
        Date: TestDate,
        EmployeeId: TestEmployeeId,
        EmployeeName: "John Smith",
        ProjectId: TestProjectId,
        ProjectName: "Downtown Office",
        ProjectNumber: "PRJ-001",
        CostCodeId: TestCostCodeId,
        CostCodeDescription: "General Labor",
        PhaseId: null,
        PhaseName: null,
        EquipmentId: null,
        EquipmentName: null,
        EquipmentCode: null,
        EquipmentHours: 0,
        RegularHours: 8.0m,
        OvertimeHours: 0,
        DoubletimeHours: 0,
        TotalHours: 8.0m,
        Description: "Foundation formwork",
        Status: status,
        ApprovedById: null,
        ApprovedByName: null,
        ApprovedAt: null,
        ApprovalComments: null,
        RejectionReason: null,
        SubmittedById: null,
        SubmittedByName: null,
        SubmittedAt: null,
        CreatedAt: DateTime.UtcNow,
        UpdatedAt: null
    );

    #region Create

    [Fact]
    public async Task Create_Success_Returns201WithTimeEntry()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.CreateTimeEntryAsync(It.IsAny<CreateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new CreateTimeEntryRequest(
            TestDate, TestEmployeeId, TestProjectId, TestCostCodeId, 8.0m);

        var result = await _controller.Create(request);

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        created.Value.Should().Be(dto);
        created.ActionName.Should().Be("GetById");
    }

    [Fact]
    public async Task Create_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.CreateTimeEntryAsync(It.IsAny<CreateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Hours must be positive", "VALIDATION_ERROR"));

        var request = new CreateTimeEntryRequest(
            TestDate, TestEmployeeId, TestProjectId, TestCostCodeId, -1.0m);

        var result = await _controller.Create(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Create_PassesAllFieldsToService()
    {
        var phaseId = Guid.NewGuid();
        var equipmentId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.CreateTimeEntryAsync(It.IsAny<CreateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new CreateTimeEntryRequest(
            TestDate, TestEmployeeId, TestProjectId, TestCostCodeId,
            8.0m, 2.0m, 1.0m, "Desc", phaseId, equipmentId, 3.5m);

        await _controller.Create(request);

        _serviceMock.Verify(s => s.CreateTimeEntryAsync(
            It.Is<CreateTimeEntryCommand>(c =>
                c.Date == TestDate &&
                c.EmployeeId == TestEmployeeId &&
                c.ProjectId == TestProjectId &&
                c.CostCodeId == TestCostCodeId &&
                c.RegularHours == 8.0m &&
                c.OvertimeHours == 2.0m &&
                c.DoubletimeHours == 1.0m &&
                c.Description == "Desc" &&
                c.PhaseId == phaseId &&
                c.EquipmentId == equipmentId &&
                c.EquipmentHours == 3.5m),
            default), Times.Once);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetTimeEntryAsync(TestId, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetById(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetTimeEntryAsync(TestId, default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Time entry not found", "NOT_FOUND"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetTimeEntryAsync(TestId, default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Database error", "DB_ERROR"));

        var result = await _controller.GetById(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var listResult = new ListTimeEntriesResult(
            new[] { CreateTestDto() }, TotalCount: 1, Page: 1, PageSize: 25, TotalPages: 1);
        _serviceMock
            .Setup(s => s.ListTimeEntriesAsync(null, null, null, null, null, 1, 25, null, default))
            .ReturnsAsync(Result.Success(listResult));

        var result = await _controller.List(null, null, null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(listResult);
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var listResult = new ListTimeEntriesResult(
            Array.Empty<TimeEntryDto>(), 0, 2, 10, 0);
        _serviceMock
            .Setup(s => s.ListTimeEntriesAsync(
                TestProjectId, TestEmployeeId, TestDate, TestDate,
                TimeEntryStatus.Approved, 2, 10, null, default))
            .ReturnsAsync(Result.Success(listResult));

        await _controller.List(TestProjectId, TestEmployeeId, TestDate, TestDate,
            TimeEntryStatus.Approved, 2, 10);

        _serviceMock.Verify(s => s.ListTimeEntriesAsync(
            TestProjectId, TestEmployeeId, TestDate, TestDate,
            TimeEntryStatus.Approved, 2, 10, null, default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.ListTimeEntriesAsync(null, null, null, null, null, 1, 25, null, default))
            .ReturnsAsync(Result.Failure<ListTimeEntriesResult>("Invalid page", "VALIDATION_ERROR"));

        var result = await _controller.List(null, null, null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Update

    [Fact]
    public async Task Update_Success_Returns200()
    {
        var dto = CreateTestDto(status: TimeEntryStatus.Submitted);
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new UpdateTimeEntryRequest(RegularHours: 9.0m);

        var result = await _controller.Update(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Time entry not found", "NOT_FOUND"));

        var request = new UpdateTimeEntryRequest(RegularHours: 9.0m);

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_Unauthorized_Returns403()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Not authorized", "UNAUTHORIZED"));

        var request = new UpdateTimeEntryRequest(RegularHours: 9.0m);

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task Update_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Cannot modify approved entry", "INVALID_STATUS"));

        var request = new UpdateTimeEntryRequest(RegularHours: 9.0m);

        var result = await _controller.Update(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_PassesAllFieldsToService()
    {
        var phaseId = Guid.NewGuid();
        var equipmentId = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new UpdateTimeEntryRequest(
            RegularHours: 9.0m,
            OvertimeHours: 1.5m,
            DoubletimeHours: 0.5m,
            Description: "Updated",
            NewStatus: TimeEntryStatus.Submitted,
            ApproverId: TestApproverId,
            ApproverNotes: "Looks good",
            PhaseId: phaseId,
            EquipmentId: equipmentId,
            EquipmentHours: 2.0m);

        await _controller.Update(TestId, request);

        _serviceMock.Verify(s => s.UpdateTimeEntryAsync(
            It.Is<UpdateTimeEntryCommand>(c =>
                c.TimeEntryId == TestId &&
                c.RegularHours == 9.0m &&
                c.OvertimeHours == 1.5m &&
                c.DoubletimeHours == 0.5m &&
                c.Description == "Updated" &&
                c.NewStatus == TimeEntryStatus.Submitted &&
                c.ApproverId == TestApproverId &&
                c.ApproverNotes == "Looks good" &&
                c.PhaseId == phaseId &&
                c.EquipmentId == equipmentId &&
                c.EquipmentHours == 2.0m),
            default), Times.Once);
    }

    #endregion

    #region Approve

    [Fact]
    public async Task Approve_Success_Returns200()
    {
        var dto = CreateTestDto(status: TimeEntryStatus.Approved);
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new ApproveTimeEntryRequest("Approved");

        var result = await _controller.Approve(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Approve_SetsCorrectStatusAndApproverFields()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto(status: TimeEntryStatus.Approved)));

        var request = new ApproveTimeEntryRequest("Well done");

        await _controller.Approve(TestId, request);

        _serviceMock.Verify(s => s.UpdateTimeEntryAsync(
            It.Is<UpdateTimeEntryCommand>(c =>
                c.TimeEntryId == TestId &&
                c.NewStatus == TimeEntryStatus.Approved &&
                c.ApproverId == TestApproverId &&
                c.ApproverNotes == "Well done"),
            default), Times.Once);
    }

    [Fact]
    public async Task Approve_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Not found", "NOT_FOUND"));

        var request = new ApproveTimeEntryRequest();

        var result = await _controller.Approve(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Approve_Unauthorized_Returns403()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Not authorized", "UNAUTHORIZED"));

        var request = new ApproveTimeEntryRequest();

        var result = await _controller.Approve(TestId, request);

        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task Approve_InvalidStatus_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Entry must be Submitted to approve", "INVALID_STATUS"));

        var request = new ApproveTimeEntryRequest();

        var result = await _controller.Approve(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Approve_AdminWithoutEmployeeRecord_Uses_JwtUserId()
    {
        // Arrange: admin user with no employee record
        var adminUserId = Guid.NewGuid();
        var adminController = CreateControllerForAdminWithoutEmployee(adminUserId);

        var dto = CreateTestDto(status: TimeEntryStatus.Approved);
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new ApproveTimeEntryRequest("Admin approved");

        // Act
        var result = await adminController.Approve(TestId, request);

        // Assert — should succeed using JWT user ID as approver
        result.Should().BeOfType<OkObjectResult>();
        _serviceMock.Verify(s => s.UpdateTimeEntryAsync(
            It.Is<UpdateTimeEntryCommand>(c =>
                c.TimeEntryId == TestId &&
                c.NewStatus == TimeEntryStatus.Approved &&
                c.ApproverId == adminUserId &&
                c.ApproverNotes == "Admin approved"),
            default), Times.Once);
    }

    [Fact]
    public async Task Approve_NonAdminWithoutEmployeeRecord_Returns400()
    {
        // Arrange: non-admin user with no employee record
        var controller = CreateControllerForNonAdminWithoutEmployee();

        var request = new ApproveTimeEntryRequest("Should fail");

        // Act
        var result = await controller.Approve(TestId, request);

        // Assert — 400 with NO_EMPLOYEE_RECORD, not 401
        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Approve_AdminWithoutEmployeeOrJwtClaim_Throws()
    {
        // Arrange: admin user with no employee record AND no NameIdentifier claim
        var controller = CreateControllerForAdminWithoutEmployeeOrClaim();

        var request = new ApproveTimeEntryRequest("Should throw");

        // Act & Assert — explicit failure, not silent Guid.Empty
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => controller.Approve(TestId, request));
    }

    #endregion

    #region Reject

    [Fact]
    public async Task Reject_Success_Returns200()
    {
        var dto = CreateTestDto(status: TimeEntryStatus.Rejected);
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new RejectTimeEntryRequest("Hours look wrong");

        var result = await _controller.Reject(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Reject_SetsCorrectStatusAndReason()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(CreateTestDto(status: TimeEntryStatus.Rejected)));

        var request = new RejectTimeEntryRequest("Incorrect project");

        await _controller.Reject(TestId, request);

        _serviceMock.Verify(s => s.UpdateTimeEntryAsync(
            It.Is<UpdateTimeEntryCommand>(c =>
                c.TimeEntryId == TestId &&
                c.NewStatus == TimeEntryStatus.Rejected &&
                c.ApproverId == TestApproverId &&
                c.ApproverNotes == "Incorrect project"),
            default), Times.Once);
    }

    [Fact]
    public async Task Reject_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Not found", "NOT_FOUND"));

        var request = new RejectTimeEntryRequest("Reason");

        var result = await _controller.Reject(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Reject_Unauthorized_Returns403()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Not authorized", "UNAUTHORIZED"));

        var request = new RejectTimeEntryRequest("Reason");

        var result = await _controller.Reject(TestId, request);

        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task Reject_InvalidStatus_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Entry must be Submitted to reject", "INVALID_STATUS"));

        var request = new RejectTimeEntryRequest("Reason");

        var result = await _controller.Reject(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Reject_AdminWithoutEmployeeRecord_UsesJwtUserId()
    {
        var adminUserId = Guid.NewGuid();
        var adminController = CreateControllerForAdminWithoutEmployee(adminUserId);

        var dto = CreateTestDto(status: TimeEntryStatus.Rejected);
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Success(dto));

        var request = new RejectTimeEntryRequest("Admin rejected");

        var result = await adminController.Reject(TestId, request);

        result.Should().BeOfType<OkObjectResult>();
        _serviceMock.Verify(s => s.UpdateTimeEntryAsync(
            It.Is<UpdateTimeEntryCommand>(c =>
                c.ApproverId == adminUserId &&
                c.NewStatus == TimeEntryStatus.Rejected),
            default), Times.Once);
    }

    [Fact]
    public async Task Reject_NonAdminWithoutEmployeeRecord_Returns400()
    {
        var controller = CreateControllerForNonAdminWithoutEmployee();
        var request = new RejectTimeEntryRequest("Should fail");

        var result = await controller.Reject(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region ReviewQueue

    [Fact]
    public async Task GetReviewQueue_AdminWithoutEmployee_ReturnsAllSubmitted()
    {
        var adminController = CreateControllerForAdminWithoutEmployee(Guid.NewGuid());

        var queueResult = new ReviewQueueResult(
            StartDate: TestDate, EndDate: TestDate.AddDays(6),
            TotalEntries: 5, TotalProjects: 2, TotalRegularHours: 40,
            TotalOvertimeHours: 0, TotalDoubletimeHours: 0, TotalHours: 40,
            Groups: []);
        _serviceMock
            .Setup(s => s.GetReviewQueueAsync(null, null, null, null, null, default))
            .ReturnsAsync(Result.Success(queueResult));

        var result = await adminController.GetReviewQueue(null, null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(queueResult);

        // Verify null was passed as employeeId (admin sees all)
        _serviceMock.Verify(s => s.GetReviewQueueAsync(
            null, null, null, null, null, default), Times.Once);
    }

    [Fact]
    public async Task GetReviewQueue_NonAdminWithEmployee_PassesEmployeeId()
    {
        var queueResult = new ReviewQueueResult(
            StartDate: TestDate, EndDate: TestDate.AddDays(6),
            TotalEntries: 2, TotalProjects: 1, TotalRegularHours: 16,
            TotalOvertimeHours: 0, TotalDoubletimeHours: 0, TotalHours: 16,
            Groups: []);
        _serviceMock
            .Setup(s => s.GetReviewQueueAsync(null, null, null, null, TestApproverId, default))
            .ReturnsAsync(Result.Success(queueResult));

        var result = await _controller.GetReviewQueue(null, null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(queueResult);

        // Verify employee ID was passed (non-admin filtered to their projects)
        _serviceMock.Verify(s => s.GetReviewQueueAsync(
            null, null, null, null, TestApproverId, default), Times.Once);
    }

    [Fact]
    public async Task GetReviewQueue_NonAdminWithoutEmployee_Returns400()
    {
        var controller = CreateControllerForNonAdminWithoutEmployee();

        var result = await controller.GetReviewQueue(null, null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region Helpers

    private TimeEntriesController CreateControllerForAdminWithoutEmployee(Guid adminUserId)
    {
        var claims = new[]
        {
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "admin@test.com"),
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "Admin"),
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, adminUserId.ToString())
        };
        var identity = new System.Security.Claims.ClaimsIdentity(claims, "TestAuth");
        var principal = new System.Security.Claims.ClaimsPrincipal(identity);

        var controller = new TimeEntriesController(
            _serviceMock.Object, _capMock.Object, _tenantContextMock.Object, _companyContextMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        // No employee record for this admin
        _serviceMock
            .Setup(s => s.GetEmployeeByEmailAsync("admin@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Employee?)null);

        return controller;
    }

    private TimeEntriesController CreateControllerForAdminWithoutEmployeeOrClaim()
    {
        // Admin role but NO NameIdentifier claim — simulates a misconfigured JWT
        var claims = new[]
        {
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "badmin@test.com"),
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "Admin")
        };
        var identity = new System.Security.Claims.ClaimsIdentity(claims, "TestAuth");
        var principal = new System.Security.Claims.ClaimsPrincipal(identity);

        var controller = new TimeEntriesController(
            _serviceMock.Object, _capMock.Object, _tenantContextMock.Object, _companyContextMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        _serviceMock
            .Setup(s => s.GetEmployeeByEmailAsync("badmin@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Employee?)null);

        return controller;
    }

    private TimeEntriesController CreateControllerForNonAdminWithoutEmployee()
    {
        var claims = new[]
        {
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "noemployee@test.com"),
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "User")
        };
        var identity = new System.Security.Claims.ClaimsIdentity(claims, "TestAuth");
        var principal = new System.Security.Claims.ClaimsPrincipal(identity);

        var controller = new TimeEntriesController(
            _serviceMock.Object, _capMock.Object, _tenantContextMock.Object, _companyContextMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        // No employee record
        _serviceMock
            .Setup(s => s.GetEmployeeByEmailAsync("noemployee@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Employee?)null);

        return controller;
    }

    #endregion
}
