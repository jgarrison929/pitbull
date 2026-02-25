using Microsoft.Extensions.Logging;
using Pitbull.Api.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Jobs;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Jobs;

/// <summary>
/// Available PDF report types that can be generated as background jobs.
/// </summary>
public enum PdfReportType
{
    WipSchedule,
    ProjectCost,
    RetentionSummary,
    Wh347,
    AgedAr,
    SubmittalLog,
    PunchList
}

/// <summary>
/// Parameters for PDF generation job.
/// </summary>
public sealed class PdfGenerationParams
{
    public PdfReportType ReportType { get; init; }
    public Guid? ProjectId { get; init; }
    public Guid? PayrollRunId { get; init; }
}

/// <summary>
/// Background job that generates PDF reports via QuestPDF.
/// Idempotent: regenerating the same report simply overwrites the previous result.
/// </summary>
public sealed class PdfGenerationJob : BackgroundJobBase
{
    private readonly IPdfReportService _pdfReportService;

    public PdfGenerationJob(
        TenantContext tenantContext,
        CompanyContext companyContext,
        IPdfReportService pdfReportService,
        ILogger<PdfGenerationJob> logger)
        : base(tenantContext, companyContext, logger)
    {
        _pdfReportService = pdfReportService;
    }

    /// <summary>
    /// Entry point called by Hangfire. Restores tenant context and generates the PDF.
    /// </summary>
    public async Task<Result> RunWithParamsAsync(JobContext context, PdfGenerationParams parameters, CancellationToken ct)
    {
        InitializeContext(context);
        using var _ = BeginJobScope(context);

        Logger.LogInformation("Generating PDF report {ReportType} for tenant {TenantId}",
            parameters.ReportType, context.TenantId);

        byte[] pdfBytes = parameters.ReportType switch
        {
            PdfReportType.WipSchedule => await _pdfReportService.GenerateWipSchedulePdfAsync(ct),
            PdfReportType.ProjectCost when parameters.ProjectId.HasValue
                => await _pdfReportService.GenerateProjectCostSummaryPdfAsync(parameters.ProjectId.Value, ct),
            PdfReportType.RetentionSummary => await _pdfReportService.GenerateRetentionSummaryPdfAsync(ct),
            PdfReportType.Wh347 when parameters.PayrollRunId.HasValue
                => await _pdfReportService.GenerateWh347PdfAsync(parameters.PayrollRunId.Value, ct),
            PdfReportType.AgedAr => await _pdfReportService.GenerateAgedArPdfAsync(ct),
            PdfReportType.SubmittalLog when parameters.ProjectId.HasValue
                => await _pdfReportService.GenerateSubmittalLogPdfAsync(parameters.ProjectId.Value, ct),
            PdfReportType.PunchList when parameters.ProjectId.HasValue
                => await _pdfReportService.GeneratePunchListPdfAsync(parameters.ProjectId.Value, ct),
            _ => throw new ArgumentException($"Invalid report type or missing required parameter for {parameters.ReportType}")
        };

        Logger.LogInformation("Generated {ReportType} PDF: {Size} bytes", parameters.ReportType, pdfBytes.Length);

        return Result.Success();
    }
}
