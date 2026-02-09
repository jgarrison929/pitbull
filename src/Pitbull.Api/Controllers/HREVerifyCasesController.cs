using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEVerifyCase;
using Pitbull.HR.Features.DeleteEVerifyCase;
using Pitbull.HR.Features.GetEVerifyCase;
using Pitbull.HR.Features.ListEVerifyCases;
using Pitbull.HR.Features.UpdateEVerifyCase;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR E-Verify Cases - track employment authorization verification with DHS.
/// Required for federal contractors and certain states.
/// </summary>
[ApiController]
[Route("api/hr/everify-cases")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - E-Verify Cases")]
public class HREVerifyCasesController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(EVerifyCaseDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateEVerifyCaseCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode switch
            {
                "EMPLOYEE_NOT_FOUND" => NotFound(new { error = result.Error }),
                "I9_NOT_FOUND" => NotFound(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetEVerifyCaseQuery(id));
        if (!result.IsSuccess) return NotFound(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId, [FromQuery] EVerifyStatus? status, [FromQuery] bool? needsAction,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new ListEVerifyCasesQuery(employeeId, status, needsAction) { Page = page, PageSize = pageSize };
        return Ok((await mediator.Send(query)).Value);
    }

    /// <summary>
    /// Get E-Verify cases needing action (TNC pending with deadline)
    /// </summary>
    [HttpGet("needs-action")]
    [Cacheable(DurationSeconds = 300)]
    public async Task<IActionResult> GetNeedingAction()
    {
        var query = new ListEVerifyCasesQuery(NeedsAction: true) { PageSize = 100 };
        return Ok((await mediator.Send(query)).Value);
    }

    [HttpGet("employee/{employeeId:guid}")]
    [Cacheable(DurationSeconds = 120)]
    public async Task<IActionResult> GetByEmployee(Guid employeeId)
    {
        var query = new ListEVerifyCasesQuery(EmployeeId: employeeId) { PageSize = 10 };
        return Ok((await mediator.Send(query)).Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEVerifyCaseCommand command)
    {
        if (id != command.Id) return BadRequest(new { error = "Route ID does not match body ID" });
        var result = await mediator.Send(command);
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        return await mediator.Send(new DeleteEVerifyCaseCommand(id)) ? NoContent() : NotFound();
    }
}
