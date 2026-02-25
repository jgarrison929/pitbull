using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Api.Jobs;
using Pitbull.Api.Services;
using Pitbull.Core.Jobs;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Jobs;

public class PdfGenerationJobTests
{
    private static readonly Guid TenantId = TestDbContextFactory.TestTenantId;
    private static readonly Guid CompanyId = TestDbContextFactory.TestCompanyId;

    private static JobContext CreateJobContext() => new()
    {
        TenantId = TenantId,
        CompanyId = CompanyId,
        UserId = "test-user"
    };

    private static (PdfGenerationJob job, TenantContext tenant, CompanyContext company) CreateJob(
        IPdfReportService? pdfService = null)
    {
        var tenant = new TenantContext();
        var company = new CompanyContext();
        var mockPdf = pdfService ?? new Mock<IPdfReportService>().Object;
        var job = new PdfGenerationJob(tenant, company, mockPdf, NullLogger<PdfGenerationJob>.Instance);
        return (job, tenant, company);
    }

    [Fact]
    public async Task RunWithParamsAsync_WipSchedule_CallsPdfService()
    {
        var mockPdf = new Mock<IPdfReportService>();
        mockPdf.Setup(s => s.GenerateWipSchedulePdfAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new byte[] { 1, 2, 3 });

        var (job, _, _) = CreateJob(mockPdf.Object);

        var result = await job.RunWithParamsAsync(
            CreateJobContext(),
            new PdfGenerationParams { ReportType = PdfReportType.WipSchedule },
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        mockPdf.Verify(s => s.GenerateWipSchedulePdfAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RunWithParamsAsync_ProjectCost_PassesProjectId()
    {
        var projectId = Guid.NewGuid();
        var mockPdf = new Mock<IPdfReportService>();
        mockPdf.Setup(s => s.GenerateProjectCostSummaryPdfAsync(projectId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new byte[] { 4, 5 });

        var (job, _, _) = CreateJob(mockPdf.Object);

        var result = await job.RunWithParamsAsync(
            CreateJobContext(),
            new PdfGenerationParams { ReportType = PdfReportType.ProjectCost, ProjectId = projectId },
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        mockPdf.Verify(s => s.GenerateProjectCostSummaryPdfAsync(projectId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RunWithParamsAsync_AgedAr_CallsPdfService()
    {
        var mockPdf = new Mock<IPdfReportService>();
        mockPdf.Setup(s => s.GenerateAgedArPdfAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new byte[] { 6, 7, 8 });

        var (job, _, _) = CreateJob(mockPdf.Object);

        var result = await job.RunWithParamsAsync(
            CreateJobContext(),
            new PdfGenerationParams { ReportType = PdfReportType.AgedAr },
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        mockPdf.Verify(s => s.GenerateAgedArPdfAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RunWithParamsAsync_ProjectCostWithoutProjectId_ThrowsArgumentException()
    {
        var (job, _, _) = CreateJob();

        var act = () => job.RunWithParamsAsync(
            CreateJobContext(),
            new PdfGenerationParams { ReportType = PdfReportType.ProjectCost },
            CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RunWithParamsAsync_SetsTenantContext()
    {
        var mockPdf = new Mock<IPdfReportService>();
        mockPdf.Setup(s => s.GenerateWipSchedulePdfAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new byte[] { 1 });

        var (job, tenant, company) = CreateJob(mockPdf.Object);

        await job.RunWithParamsAsync(
            CreateJobContext(),
            new PdfGenerationParams { ReportType = PdfReportType.WipSchedule },
            CancellationToken.None);

        tenant.TenantId.Should().Be(TenantId);
        company.CompanyId.Should().Be(CompanyId);
    }

    [Fact]
    public void InheritsFromBackgroundJobBase()
    {
        typeof(PdfGenerationJob).BaseType.Should().Be(typeof(BackgroundJobBase));
    }
}
