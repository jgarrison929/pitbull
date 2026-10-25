using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;
using Pitbull.Billing.Features.CertifiedPayroll;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/certified")]
[Authorize(Policy = "Payroll.CertifiedReport")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Certified Payroll")]
public class CertifiedPayrollController(
    ICertifiedPayrollService certifiedPayrollService,
    IPdfReportService pdfReportService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListCertifiedPayrollReportsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? payrollRunId,
        [FromQuery] Guid? projectId,
        [FromQuery] CertifiedPayrollStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListCertifiedPayrollReportsQuery query = new(payrollRunId, projectId, status, page, pageSize);
        var result = await certifiedPayrollService.ListAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("generate")]
    [ProducesResponseType(typeof(CertifiedPayrollGenerateResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Generate([FromBody] GenerateCertifiedPayrollRequest request)
    {
        GenerateCertifiedPayrollCommand command = new(
            PayrollRunId: request.PayrollRunId,
            ProjectId: request.ProjectId,
            WeekEnding: request.WeekEnding);

        var result = await certifiedPayrollService.GenerateAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{payrollRunId:guid}/wh347-pdf")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadWh347Pdf(Guid payrollRunId, CancellationToken cancellationToken)
    {
        try
        {
            var bytes = await pdfReportService.GenerateWh347PdfAsync(payrollRunId, cancellationToken);
            return File(bytes, "application/pdf", $"WH-347-{payrollRunId:N}.pdf");
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Payroll run not found", code = "PAYROLL_RUN_NOT_FOUND" });
        }
    }
}

public record GenerateCertifiedPayrollRequest(
    Guid PayrollRunId,
    Guid ProjectId,
    DateOnly WeekEnding);
