using System.Text;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.PayrollExports;
using Pitbull.Billing.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Tests.Unit.Api;

public class PayrollExportsControllerTests
{
    private readonly Mock<IPayrollExportService> _serviceMock;
    private readonly PayrollExportsController _controller;

    private static readonly Guid TestExportId = Guid.NewGuid();
    private static readonly Guid TestRunId = Guid.NewGuid();

    public PayrollExportsControllerTests()
    {
        _serviceMock = new Mock<IPayrollExportService>();
        _controller = new PayrollExportsController(_serviceMock.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    [Fact]
    public async Task List_Returns200_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListPayrollExportsQuery>(), default))
            .ReturnsAsync(Result.Success(new ListPayrollExportsResult([CreateDto()], 1, 1, 25, 1)));

        IActionResult result = await _controller.List(TestRunId, PayrollExportFormat.Csv, null, null, 1, 25);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task List_Returns400_WhenFailure()
    {
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListPayrollExportsQuery>(), default))
            .ReturnsAsync(Result.Failure<ListPayrollExportsResult>("bad", "BAD"));

        IActionResult result = await _controller.List(null, null, null, null, 1, 25);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_PassesFiltersToService()
    {
        _serviceMock.Setup(x => x.ListAsync(It.IsAny<ListPayrollExportsQuery>(), default))
            .ReturnsAsync(Result.Success(new ListPayrollExportsResult([], 0, 1, 25, 0)));

        DateOnly start = new(2026, 2, 1);
        DateOnly end = new(2026, 2, 15);
        await _controller.List(TestRunId, PayrollExportFormat.Adp, start, end, 3, 10);

        _serviceMock.Verify(x => x.ListAsync(
            It.Is<ListPayrollExportsQuery>(q => q.PayrollRunId == TestRunId && q.Format == PayrollExportFormat.Adp && q.StartDate == start && q.EndDate == end && q.Page == 3 && q.PageSize == 10),
            default), Times.Once);
    }

    [Fact]
    public async Task Generate_Returns200_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.GenerateAsync(It.IsAny<GeneratePayrollExportCommand>(), default)).ReturnsAsync(Result.Success(CreateDto()));

        IActionResult result = await _controller.Generate(new GeneratePayrollExportRequest(TestRunId, PayrollExportFormat.Csv, null, null));

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Generate_Returns404_WhenRunMissing()
    {
        _serviceMock.Setup(x => x.GenerateAsync(It.IsAny<GeneratePayrollExportCommand>(), default))
            .ReturnsAsync(Result.Failure<PayrollExportDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.Generate(new GeneratePayrollExportRequest(TestRunId, PayrollExportFormat.Csv, null, null));

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Generate_Returns400_WhenFailure()
    {
        _serviceMock.Setup(x => x.GenerateAsync(It.IsAny<GeneratePayrollExportCommand>(), default))
            .ReturnsAsync(Result.Failure<PayrollExportDto>("bad", "BAD"));

        IActionResult result = await _controller.Generate(new GeneratePayrollExportRequest(TestRunId, PayrollExportFormat.Csv, null, null));

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Generate_PassesCommandValues()
    {
        _serviceMock.Setup(x => x.GenerateAsync(It.IsAny<GeneratePayrollExportCommand>(), default)).ReturnsAsync(Result.Success(CreateDto()));

        DateOnly start = new(2026, 2, 1);
        DateOnly end = new(2026, 2, 15);
        await _controller.Generate(new GeneratePayrollExportRequest(TestRunId, PayrollExportFormat.Paychex, start, end));

        _serviceMock.Verify(x => x.GenerateAsync(
            It.Is<GeneratePayrollExportCommand>(c => c.PayrollRunId == TestRunId && c.Format == PayrollExportFormat.Paychex && c.StartDate == start && c.EndDate == end),
            default), Times.Once);
    }

    [Fact]
    public async Task Download_ReturnsFile_WhenSuccessful()
    {
        _serviceMock.Setup(x => x.DownloadAsync(TestExportId, default))
            .ReturnsAsync(Result.Success(new PayrollExportDownloadDto("export.csv", "text/csv", "h1,h2\na,b")));

        IActionResult result = await _controller.Download(TestExportId);

        var file = result.Should().BeOfType<FileContentResult>().Subject;
        file.ContentType.Should().Be("text/csv");
        file.FileDownloadName.Should().Be("export.csv");
        Encoding.UTF8.GetString(file.FileContents).Should().Contain("h1,h2");
    }

    [Fact]
    public async Task Download_Returns404_WhenMissing()
    {
        _serviceMock.Setup(x => x.DownloadAsync(TestExportId, default))
            .ReturnsAsync(Result.Failure<PayrollExportDownloadDto>("missing", "NOT_FOUND"));

        IActionResult result = await _controller.Download(TestExportId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Download_Returns400_WhenFailure()
    {
        _serviceMock.Setup(x => x.DownloadAsync(TestExportId, default))
            .ReturnsAsync(Result.Failure<PayrollExportDownloadDto>("bad", "BAD"));

        IActionResult result = await _controller.Download(TestExportId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    private static PayrollExportDto CreateDto()
    {
        return new PayrollExportDto(
            Id: TestExportId,
            PayrollRunId: TestRunId,
            Format: PayrollExportFormat.Csv,
            FormatName: "Csv",
            ExportedAt: DateTime.UtcNow,
            FilePath: "exports/payroll/test.csv",
            FileName: "test.csv",
            LineCount: 2,
            TotalGross: 1000m,
            TotalNet: 800m,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: null);
    }
}
