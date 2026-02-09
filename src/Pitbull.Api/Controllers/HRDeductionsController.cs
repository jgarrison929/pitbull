using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateDeduction;
using Pitbull.HR.Features.DeleteDeduction;
using Pitbull.HR.Features.GetDeduction;
using Pitbull.HR.Features.ListDeductions;
using Pitbull.HR.Features.UpdateDeduction;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR Deductions - benefits, garnishments, union dues, 401k, etc.
/// </summary>
[ApiController]
[Route("api/hr/deductions")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - Deductions")]
public class HRDeductionsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(DeductionDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateDeductionCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "EMPLOYEE_NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetDeductionQuery(id));
        if (!result.IsSuccess) return NotFound(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId, [FromQuery] string? deductionCode, [FromQuery] bool? activeOnly,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new ListDeductionsQuery(employeeId, deductionCode, activeOnly) { Page = page, PageSize = pageSize };
        return Ok((await mediator.Send(query)).Value);
    }

    [HttpGet("employee/{employeeId:guid}/active")]
    [Cacheable(DurationSeconds = 120)]
    public async Task<IActionResult> GetActiveByEmployee(Guid employeeId)
    {
        var query = new ListDeductionsQuery(EmployeeId: employeeId, ActiveOnly: true) { PageSize = 50 };
        return Ok((await mediator.Send(query)).Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDeductionCommand command)
    {
        if (id != command.Id) return BadRequest(new { error = "Route ID does not match body ID" });
        var result = await mediator.Send(command);
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        return await mediator.Send(new DeleteDeductionCommand(id)) ? NoContent() : NotFound();
    }
}
