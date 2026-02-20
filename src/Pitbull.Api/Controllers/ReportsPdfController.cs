using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/reports/pdf")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/pdf")]
[Tags("Reports PDF")]
public class ReportsPdfController(IPdfReportService pdfReportService, ILogger<ReportsPdfController> logger) : ControllerBase
{
    [HttpGet("wip-schedule")]
    public async Task<IActionResult> WipSchedule(CancellationToken cancellationToken)
    {
        var bytes = await pdfReportService.GenerateWipSchedulePdfAsync(cancellationToken);
        return File(bytes, "application/pdf", $"wip-schedule-{DateTime.UtcNow:yyyyMMdd}.pdf");
    }

    [HttpGet("project-cost/{projectId:guid}")]
    public async Task<IActionResult> ProjectCost(Guid projectId, CancellationToken cancellationToken)
    {
        try
        {
            var bytes = await pdfReportService.GenerateProjectCostSummaryPdfAsync(projectId, cancellationToken);
            return File(bytes, "application/pdf", $"project-cost-{projectId}.pdf");
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message, code = "NOT_FOUND" });
        }
    }

    [HttpGet("retention-summary")]
    public async Task<IActionResult> RetentionSummary(CancellationToken cancellationToken)
    {
        var bytes = await pdfReportService.GenerateRetentionSummaryPdfAsync(cancellationToken);
        return File(bytes, "application/pdf", $"retention-summary-{DateTime.UtcNow:yyyyMMdd}.pdf");
    }

    [HttpGet("wh347/{payrollRunId:guid}")]
    public async Task<IActionResult> Wh347(Guid payrollRunId, CancellationToken cancellationToken)
    {
        try
        {
            var bytes = await pdfReportService.GenerateWh347PdfAsync(payrollRunId, cancellationToken);
            return File(bytes, "application/pdf", $"wh347-{payrollRunId}.pdf");
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message, code = "NOT_FOUND" });
        }
    }

    [HttpGet("aged-ar")]
    public async Task<IActionResult> AgedAr(CancellationToken cancellationToken)
    {
        try
        {
            var bytes = await pdfReportService.GenerateAgedArPdfAsync(cancellationToken);
            return File(bytes, "application/pdf", $"aged-ar-{DateTime.UtcNow:yyyyMMdd}.pdf");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate aged AR PDF");
            return BadRequest(new { error = "Failed to generate aged AR", code = "PDF_ERROR" });
        }
    }
}
