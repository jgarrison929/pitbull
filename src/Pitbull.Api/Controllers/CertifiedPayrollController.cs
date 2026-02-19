using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.CertifiedPayroll;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/certified")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Certified Payroll")]
public class CertifiedPayrollController(ICertifiedPayrollService certifiedPayrollService) : ControllerBase
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
}

public record GenerateCertifiedPayrollRequest(
    Guid PayrollRunId,
    Guid ProjectId,
    DateOnly WeekEnding);
