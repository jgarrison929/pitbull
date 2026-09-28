using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Payroll.Features.PayrollRuns;
using Pitbull.Payroll.Features.PrevailingWageValidation;
using Pitbull.Payroll.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/payroll/runs")]
[Authorize(Policy = "Payroll.Process")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payroll Runs")]
public class PayrollRunsController(
    IPayrollRunService payrollRunService,
    IPrevailingWageValidationService prevailingWageValidationService,
    IPayrollGlPostingService payrollGlPostingService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListPayrollRunsResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] PayrollRunStatus? status,
        [FromQuery] Guid? payPeriodId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        ListPayrollRunsQuery query = new(status, payPeriodId, page, pageSize);
        var result = await payrollRunService.GetPayrollRunsAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await payrollRunService.GetPayrollRunAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreatePayrollRunRequest request)
    {
        CreatePayrollRunCommand command = new(request.RunDate, request.PayPeriodId);
        var result = await payrollRunService.CreatePayrollRunAsync(command);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePayrollRunRequest request)
    {
        UpdatePayrollRunCommand command = new(id, request.RunDate, request.Status);
        var result = await payrollRunService.UpdatePayrollRunAsync(command);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("generate")]
    [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Generate([FromBody] GeneratePayrollRunRequest request)
    {
        GeneratePayrollRunCommand command = new(request.RunDate, request.PayPeriodId);
        var result = await payrollRunService.GeneratePayrollRunAsync(command);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var result = await payrollRunService.ApprovePayrollRunAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/validate-prevailing-wage")]
    [Authorize(Policy = "Payroll.Process")]
    [ProducesResponseType(typeof(PrevailingWageValidationResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ValidatePrevailingWage(Guid id, CancellationToken cancellationToken)
    {
        var result = await prevailingWageValidationService.ValidatePayrollRunAsync(
            new ValidatePayrollRunPrevailingWageQuery(id),
            cancellationToken);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/post")]
    [Authorize(Policy = "Payroll.PostGL")]
    [ProducesResponseType(typeof(PayrollGlPostResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> PostToGl(Guid id, CancellationToken cancellationToken)
    {
        string? userId = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        Guid? postedBy = Guid.TryParse(userId, out Guid parsed) ? parsed : null;

        var result = await payrollGlPostingService.PostToGlAsync(id, postedBy, cancellationToken);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/export")]
    [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Export(Guid id)
    {
        var result = await payrollRunService.ExportPayrollRunAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await payrollRunService.DeletePayrollRunAsync(id);

        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

public record CreatePayrollRunRequest(DateOnly RunDate, Guid PayPeriodId);

public record UpdatePayrollRunRequest(
    DateOnly? RunDate = null,
    PayrollRunStatus? Status = null);

public record GeneratePayrollRunRequest(DateOnly RunDate, Guid PayPeriodId);
