using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateI9Record;
using Pitbull.HR.Features.DeleteI9Record;
using Pitbull.HR.Features.GetI9Record;
using Pitbull.HR.Features.ListI9Records;
using Pitbull.HR.Features.UpdateI9Record;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR I-9 Employment Eligibility Verification records.
/// Required for all US employees within 3 days of hire.
/// </summary>
[ApiController]
[Route("api/hr/i9-records")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - I-9 Records")]
public class HRI9RecordsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(I9RecordDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateI9RecordCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode switch
            {
                "EMPLOYEE_NOT_FOUND" => NotFound(new { error = result.Error }),
                "I9_EXISTS" => Conflict(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetI9RecordQuery(id));
        if (!result.IsSuccess) return NotFound(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId, [FromQuery] I9Status? status, [FromQuery] bool? needsReverification,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new ListI9RecordsQuery(employeeId, status, needsReverification) { Page = page, PageSize = pageSize };
        return Ok((await mediator.Send(query)).Value);
    }

    /// <summary>
    /// Get I-9 records needing reverification (work auth expiring within 90 days)
    /// </summary>
    [HttpGet("reverification-needed")]
    [Cacheable(DurationSeconds = 300)]
    public async Task<IActionResult> GetNeedingReverification()
    {
        var query = new ListI9RecordsQuery(NeedsReverification: true) { PageSize = 100 };
        return Ok((await mediator.Send(query)).Value);
    }

    [HttpGet("employee/{employeeId:guid}")]
    [Cacheable(DurationSeconds = 120)]
    public async Task<IActionResult> GetByEmployee(Guid employeeId)
    {
        var query = new ListI9RecordsQuery(EmployeeId: employeeId) { PageSize = 5 };
        return Ok((await mediator.Send(query)).Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateI9RecordCommand command)
    {
        if (id != command.Id) return BadRequest(new { error = "Route ID does not match body ID" });
        var result = await mediator.Send(command);
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        return await mediator.Send(new DeleteI9RecordCommand(id)) ? NoContent() : NotFound();
    }
}
