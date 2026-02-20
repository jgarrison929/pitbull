using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.PayrollExports;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/exports")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll Exports")]
public class PayrollExportsController(IPayrollExportService payrollExportService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListPayrollExportsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? payrollRunId,
        [FromQuery] PayrollExportFormat? format,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListPayrollExportsQuery query = new(payrollRunId, format, startDate, endDate, page, pageSize);
        var result = await payrollExportService.ListAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("generate")]
    [ProducesResponseType(typeof(PayrollExportDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Generate([FromBody] GeneratePayrollExportRequest request)
    {
        GeneratePayrollExportCommand command = new(request.PayrollRunId, request.Format, request.StartDate, request.EndDate);
        var result = await payrollExportService.GenerateAsync(command);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}/download")]
    [Produces("text/csv")]
    public async Task<IActionResult> Download(Guid id)
    {
        var result = await payrollExportService.DownloadAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        PayrollExportDownloadDto payload = result.Value!;
        byte[] bytes = Encoding.UTF8.GetBytes(payload.Content);
        return File(bytes, payload.ContentType, payload.FileName);
    }
}

public record GeneratePayrollExportRequest(
    Guid PayrollRunId,
    PayrollExportFormat Format,
    DateOnly? StartDate,
    DateOnly? EndDate);
