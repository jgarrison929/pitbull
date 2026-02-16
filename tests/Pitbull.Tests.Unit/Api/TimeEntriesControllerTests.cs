using FluentAssertions;
using MassTransit;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.ExportVistaTimesheet;
using Pitbull.TimeTracking.Features.GetLaborCostReport;
using Pitbull.TimeTracking.Features.GetTimeEntriesByProject;
using Pitbull.TimeTracking.Features.ListTimeEntries;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Api;

public class TimeEntriesControllerTests
{
    private readonly Mock<ITimeEntryService> _serviceMock;
    private readonly Mock<IBus> _busMock;
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
        _busMock = new Mock<IBus>();
        _controller = new TimeEntriesController(_serviceMock.Object, _busMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
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
            .Setup(s => s.ListTimeEntriesAsync(null, null, null, null, null, 1, 25, default))
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
                TimeEntryStatus.Approved, 2, 10, default))
            .ReturnsAsync(Result.Success(listResult));

        await _controller.List(TestProjectId, TestEmployeeId, TestDate, TestDate,
            TimeEntryStatus.Approved, 2, 10);

        _serviceMock.Verify(s => s.ListTimeEntriesAsync(
            TestProjectId, TestEmployeeId, TestDate, TestDate,
            TimeEntryStatus.Approved, 2, 10, default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.ListTimeEntriesAsync(null, null, null, null, null, 1, 25, default))
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

        var request = new ApproveTimeEntryRequest(TestApproverId, "Approved");

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

        var request = new ApproveTimeEntryRequest(TestApproverId, "Well done");

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

        var request = new ApproveTimeEntryRequest(TestApproverId);

        var result = await _controller.Approve(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Approve_Unauthorized_Returns403()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Not authorized", "UNAUTHORIZED"));

        var request = new ApproveTimeEntryRequest(TestApproverId);

        var result = await _controller.Approve(TestId, request);

        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task Approve_InvalidStatus_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Entry must be Submitted to approve", "INVALID_STATUS"));

        var request = new ApproveTimeEntryRequest(TestApproverId);

        var result = await _controller.Approve(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
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

        var request = new RejectTimeEntryRequest(TestApproverId, "Hours look wrong");

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

        var request = new RejectTimeEntryRequest(TestApproverId, "Incorrect project");

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

        var request = new RejectTimeEntryRequest(TestApproverId, "Reason");

        var result = await _controller.Reject(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Reject_Unauthorized_Returns403()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Not authorized", "UNAUTHORIZED"));

        var request = new RejectTimeEntryRequest(TestApproverId, "Reason");

        var result = await _controller.Reject(TestId, request);

        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task Reject_InvalidStatus_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateTimeEntryAsync(It.IsAny<UpdateTimeEntryCommand>(), default))
            .ReturnsAsync(Result.Failure<TimeEntryDto>("Entry must be Submitted to reject", "INVALID_STATUS"));

        var request = new RejectTimeEntryRequest(TestApproverId, "Reason");

        var result = await _controller.Reject(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region GetCostReport

    [Fact]
    public async Task GetCostReport_Success_Returns200()
    {
        var report = new LaborCostReportResponse
        {
            DateRange = new DateRangeInfo(TestDate, TestDate),
            TotalCost = new LaborCostSummary(),
            ByProject = Array.Empty<ProjectCostSummary>()
        };
        _serviceMock
            .Setup(s => s.GetLaborCostReportAsync(null, null, null, true, default))
            .ReturnsAsync(Result.Success(report));

        var result = await _controller.GetCostReport(null, null, null, true);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(report);
    }

    [Fact]
    public async Task GetCostReport_WithProjectFilter_PassesToService()
    {
        var report = new LaborCostReportResponse
        {
            DateRange = new DateRangeInfo(TestDate, TestDate),
            TotalCost = new LaborCostSummary(),
            ByProject = Array.Empty<ProjectCostSummary>()
        };
        _serviceMock
            .Setup(s => s.GetLaborCostReportAsync(TestProjectId, TestDate, TestDate, false, default))
            .ReturnsAsync(Result.Success(report));

        await _controller.GetCostReport(TestProjectId, TestDate, TestDate, false);

        _serviceMock.Verify(s => s.GetLaborCostReportAsync(
            TestProjectId, TestDate, TestDate, false, default), Times.Once);
    }

    [Fact]
    public async Task GetCostReport_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetLaborCostReportAsync(TestProjectId, null, null, true, default))
            .ReturnsAsync(Result.Failure<LaborCostReportResponse>("Project not found", "NOT_FOUND"));

        var result = await _controller.GetCostReport(TestProjectId, null, null, true);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetCostReport_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetLaborCostReportAsync(null, null, null, true, default))
            .ReturnsAsync(Result.Failure<LaborCostReportResponse>("Database error", "DB_ERROR"));

        var result = await _controller.GetCostReport(null, null, null, true);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region GetByProject

    [Fact]
    public async Task GetByProject_Success_Returns200()
    {
        var projectResult = new ProjectTimeEntriesResult(
            TestProjectId, "Downtown", "PRJ-001",
            new[] { CreateTestDto() }, 1, 1, 50, 1);
        _serviceMock
            .Setup(s => s.GetTimeEntriesByProjectAsync(
                TestProjectId, null, null, null, false, 1, 50, default))
            .ReturnsAsync(Result.Success(projectResult));

        var result = await _controller.GetByProject(TestProjectId, null, null, null, false);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(projectResult);
    }

    [Fact]
    public async Task GetByProject_WithFilters_PassesToService()
    {
        var projectResult = new ProjectTimeEntriesResult(
            TestProjectId, "Downtown", "PRJ-001",
            Array.Empty<TimeEntryDto>(), 0, 2, 10, 0);
        _serviceMock
            .Setup(s => s.GetTimeEntriesByProjectAsync(
                TestProjectId, TestDate, TestDate, TimeEntryStatus.Approved, true, 2, 10, default))
            .ReturnsAsync(Result.Success(projectResult));

        await _controller.GetByProject(TestProjectId, TestDate, TestDate,
            TimeEntryStatus.Approved, true, 2, 10);

        _serviceMock.Verify(s => s.GetTimeEntriesByProjectAsync(
            TestProjectId, TestDate, TestDate, TimeEntryStatus.Approved, true, 2, 10, default),
            Times.Once);
    }

    [Fact]
    public async Task GetByProject_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.GetTimeEntriesByProjectAsync(
                TestProjectId, null, null, null, false, 1, 50, default))
            .ReturnsAsync(Result.Failure<ProjectTimeEntriesResult>("Project not found", "NOT_FOUND"));

        var result = await _controller.GetByProject(TestProjectId, null, null, null, false);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetByProject_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetTimeEntriesByProjectAsync(
                TestProjectId, null, null, null, false, 1, 50, default))
            .ReturnsAsync(Result.Failure<ProjectTimeEntriesResult>("Database error", "DB_ERROR"));

        var result = await _controller.GetByProject(TestProjectId, null, null, null, false);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region ExportVista

    [Fact]
    public async Task ExportVista_Success_ReturnsCsvFile()
    {
        var export = new VistaExportResult
        {
            CsvContent = "Header1,Header2\nVal1,Val2",
            FileName = "vista-export-2026-02-15.csv",
            RowCount = 1,
            TotalHours = 8.0m,
            StartDate = TestDate,
            EndDate = TestDate,
            EmployeeCount = 1,
            ProjectCount = 1
        };
        _serviceMock
            .Setup(s => s.ExportVistaTimesheetAsync(TestDate, TestDate, null, default))
            .ReturnsAsync(Result.Success(export));

        var result = await _controller.ExportVista(TestDate, TestDate);

        var file = result.Should().BeOfType<FileContentResult>().Subject;
        file.ContentType.Should().Be("text/csv");
        file.FileDownloadName.Should().Be("vista-export-2026-02-15.csv");
        var content = System.Text.Encoding.UTF8.GetString(file.FileContents);
        content.Should().Contain("Header1,Header2");
    }

    [Fact]
    public async Task ExportVista_AcceptJson_ReturnsMetadata()
    {
        var export = new VistaExportResult
        {
            CsvContent = "Header1,Header2\nVal1,Val2",
            FileName = "vista-export-2026-02-15.csv",
            RowCount = 1,
            TotalHours = 8.0m,
            StartDate = TestDate,
            EndDate = TestDate,
            EmployeeCount = 1,
            ProjectCount = 1
        };
        _serviceMock
            .Setup(s => s.ExportVistaTimesheetAsync(TestDate, TestDate, null, default))
            .ReturnsAsync(Result.Success(export));

        // Set Accept header to application/json
        _controller.ControllerContext.HttpContext.Request.Headers.Accept = "application/json";

        var result = await _controller.ExportVista(TestDate, TestDate);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task ExportVista_InvalidDateRange_Returns400()
    {
        var start = new DateOnly(2026, 2, 20);
        var end = new DateOnly(2026, 2, 10); // end before start
        _serviceMock
            .Setup(s => s.ExportVistaTimesheetAsync(start, end, null, default))
            .ReturnsAsync(Result.Failure<VistaExportResult>(
                "Start date must be before end date", "INVALID_DATE_RANGE"));

        var result = await _controller.ExportVista(start, end);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ExportVista_DateRangeTooLarge_Returns400()
    {
        var start = new DateOnly(2026, 1, 1);
        var end = new DateOnly(2026, 3, 15); // >31 days
        _serviceMock
            .Setup(s => s.ExportVistaTimesheetAsync(start, end, null, default))
            .ReturnsAsync(Result.Failure<VistaExportResult>(
                "Date range cannot exceed 31 days", "DATE_RANGE_TOO_LARGE"));

        var result = await _controller.ExportVista(start, end);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ExportVista_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.ExportVistaTimesheetAsync(TestDate, TestDate, null, default))
            .ReturnsAsync(Result.Failure<VistaExportResult>(
                "No approved entries found", "NOT_FOUND"));

        var result = await _controller.ExportVista(TestDate, TestDate);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task ExportVista_WithProjectFilter_PassesToService()
    {
        var export = new VistaExportResult
        {
            CsvContent = "data",
            FileName = "export.csv",
            StartDate = TestDate,
            EndDate = TestDate
        };
        _serviceMock
            .Setup(s => s.ExportVistaTimesheetAsync(TestDate, TestDate, TestProjectId, default))
            .ReturnsAsync(Result.Success(export));

        await _controller.ExportVista(TestDate, TestDate, TestProjectId);

        _serviceMock.Verify(s => s.ExportVistaTimesheetAsync(
            TestDate, TestDate, TestProjectId, default), Times.Once);
    }

    #endregion
}
