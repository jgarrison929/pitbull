using System.Security.Claims;
using FluentAssertions;
using Hangfire;
using Hangfire.Storage;
using Hangfire.Storage.Monitoring;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Api.Jobs;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Jobs;

public class JobsControllerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid CompanyId = Guid.NewGuid();

    private readonly Mock<IBackgroundJobClient> _jobClientMock = new();
    private readonly Mock<JobStorage> _jobStorageMock = new();
    private readonly Mock<IStorageConnection> _connectionMock = new();
    private readonly Mock<IMonitoringApi> _monitoringMock = new();
    private readonly TenantContext _tenantContext;
    private readonly CompanyContext _companyContext;
    private readonly JobsController _controller;

    public JobsControllerTests()
    {
        _tenantContext = new TenantContext { TenantId = TenantId };
        _companyContext = new CompanyContext { CompanyId = CompanyId };

        _jobStorageMock.Setup(s => s.GetConnection()).Returns(_connectionMock.Object);
        _jobStorageMock.Setup(s => s.GetMonitoringApi()).Returns(_monitoringMock.Object);

        _controller = new JobsController(
            _jobClientMock.Object,
            _jobStorageMock.Object,
            _tenantContext,
            _companyContext);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, "test-user")], "test"))
            }
        };
    }

    // ── Enqueue validation ──────────────────────────────────────────

    [Fact]
    public void Enqueue_PdfGeneration_MissingPdfParams_ReturnsBadRequest()
    {
        var request = new EnqueueJobRequest { JobType = JobType.PdfGeneration, PdfParams = null };

        var result = _controller.Enqueue(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public void Enqueue_AiBatch_MissingAiParams_ReturnsBadRequest()
    {
        var request = new EnqueueJobRequest { JobType = JobType.AiBatchProcessing, AiParams = null };

        var result = _controller.Enqueue(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public void Enqueue_ProjectCost_MissingProjectId_ReturnsBadRequest()
    {
        var request = new EnqueueJobRequest
        {
            JobType = JobType.PdfGeneration,
            PdfParams = new PdfGenerationParams { ReportType = PdfReportType.ProjectCost }
        };

        var result = _controller.Enqueue(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public void Enqueue_Wh347_MissingPayrollRunId_ReturnsBadRequest()
    {
        var request = new EnqueueJobRequest
        {
            JobType = JobType.PdfGeneration,
            PdfParams = new PdfGenerationParams { ReportType = PdfReportType.Wh347 }
        };

        var result = _controller.Enqueue(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public void Enqueue_SubmittalLog_MissingProjectId_ReturnsBadRequest()
    {
        var request = new EnqueueJobRequest
        {
            JobType = JobType.PdfGeneration,
            PdfParams = new PdfGenerationParams { ReportType = PdfReportType.SubmittalLog }
        };

        var result = _controller.Enqueue(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public void Enqueue_PunchList_MissingProjectId_ReturnsBadRequest()
    {
        var request = new EnqueueJobRequest
        {
            JobType = JobType.PdfGeneration,
            PdfParams = new PdfGenerationParams { ReportType = PdfReportType.PunchList }
        };

        var result = _controller.Enqueue(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public void Enqueue_UnknownJobType_ReturnsBadRequest()
    {
        var request = new EnqueueJobRequest { JobType = (JobType)999 };

        var result = _controller.Enqueue(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ── GetStatus tenant ownership ──────────────────────────────────

    [Fact]
    public void GetStatus_JobNotFound_Returns404()
    {
        _connectionMock.Setup(c => c.GetJobData("missing-123")).Returns((JobData)null!);

        var result = _controller.GetStatus("missing-123");

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public void GetStatus_DifferentTenant_Returns404()
    {
        var otherTenantId = Guid.NewGuid();
        _connectionMock.Setup(c => c.GetJobData("job-1"))
            .Returns(new JobData { CreatedAt = DateTime.UtcNow, State = "Succeeded" });
        _connectionMock.Setup(c => c.GetJobParameter("job-1", JobsController.TenantIdParam))
            .Returns(otherTenantId.ToString());

        var result = _controller.GetStatus("job-1");

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public void GetStatus_SameTenant_ReturnsOk()
    {
        _connectionMock.Setup(c => c.GetJobData("job-1"))
            .Returns(new JobData { CreatedAt = DateTime.UtcNow, State = "Succeeded" });
        _connectionMock.Setup(c => c.GetJobParameter("job-1", JobsController.TenantIdParam))
            .Returns(TenantId.ToString());
        _monitoringMock.Setup(m => m.JobDetails("job-1"))
            .Returns(new JobDetailsDto
            {
                History = [new StateHistoryDto { StateName = "Succeeded", CreatedAt = DateTime.UtcNow }]
            });

        var result = _controller.GetStatus("job-1");

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public void GetStatus_NullTenantParam_Returns404()
    {
        _connectionMock.Setup(c => c.GetJobData("job-2"))
            .Returns(new JobData { CreatedAt = DateTime.UtcNow, State = "Enqueued" });
        _connectionMock.Setup(c => c.GetJobParameter("job-2", JobsController.TenantIdParam))
            .Returns((string)null!);

        var result = _controller.GetStatus("job-2");

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public void GetStatus_InvalidGuidTenantParam_Returns404()
    {
        _connectionMock.Setup(c => c.GetJobData("job-3"))
            .Returns(new JobData { CreatedAt = DateTime.UtcNow, State = "Enqueued" });
        _connectionMock.Setup(c => c.GetJobParameter("job-3", JobsController.TenantIdParam))
            .Returns("not-a-guid");

        var result = _controller.GetStatus("job-3");

        result.Should().BeOfType<NotFoundObjectResult>();
    }
}
