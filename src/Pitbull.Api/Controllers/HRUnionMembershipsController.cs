using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateUnionMembership;
using Pitbull.HR.Features.DeleteUnionMembership;
using Pitbull.HR.Features.GetUnionMembership;
using Pitbull.HR.Features.ListUnionMemberships;
using Pitbull.HR.Features.UpdateUnionMembership;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR Union Memberships - track union affiliation, dispatch, and fringe rates.
/// Essential for construction companies working with union labor.
/// </summary>
[ApiController]
[Route("api/hr/union-memberships")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - Union Memberships")]
public class HRUnionMembershipsController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(UnionMembershipDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateUnionMembershipCommand command)
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
        var result = await mediator.Send(new GetUnionMembershipQuery(id));
        if (!result.IsSuccess) return NotFound(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId, [FromQuery] string? unionLocal, [FromQuery] bool? activeOnly,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new ListUnionMembershipsQuery(employeeId, unionLocal, activeOnly) { Page = page, PageSize = pageSize };
        return Ok((await mediator.Send(query)).Value);
    }

    [HttpGet("employee/{employeeId:guid}")]
    [Cacheable(DurationSeconds = 120)]
    public async Task<IActionResult> GetByEmployee(Guid employeeId)
    {
        var query = new ListUnionMembershipsQuery(EmployeeId: employeeId, ActiveOnly: true) { PageSize = 10 };
        return Ok((await mediator.Send(query)).Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUnionMembershipCommand command)
    {
        if (id != command.Id) return BadRequest(new { error = "Route ID does not match body ID" });
        var result = await mediator.Send(command);
        if (!result.IsSuccess) return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        return await mediator.Send(new DeleteUnionMembershipCommand(id)) ? NoContent() : NotFound();
    }
}
