using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateWithholdingElection;
using Pitbull.HR.Features.DeleteWithholdingElection;
using Pitbull.HR.Features.GetWithholdingElection;
using Pitbull.HR.Features.ListWithholdingElections;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR Tax Withholding Elections - Federal W-4 and State equivalents.
/// Uses effective dating - creating new election auto-expires the previous one.
/// </summary>
[ApiController]
[Route("api/hr/withholding-elections")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - Withholding Elections")]
public class HRWithholdingElectionsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new withholding election (W-4 or state equivalent)
    /// </summary>
    /// <remarks>
    /// Creating a new election automatically expires any existing election
    /// for the same jurisdiction (effective the day before the new one).
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(WithholdingElectionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create([FromBody] CreateWithholdingElectionCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "EMPLOYEE_NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(WithholdingElectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetWithholdingElectionQuery(id));
        if (!result.IsSuccess) return NotFound(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    [ProducesResponseType(typeof(PagedResult<WithholdingElectionListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId,
        [FromQuery] string? taxJurisdiction,
        [FromQuery] bool? currentOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = new ListWithholdingElectionsQuery(employeeId, taxJurisdiction, currentOnly) { Page = page, PageSize = pageSize };
        var result = await mediator.Send(query);
        return Ok(result.Value);
    }

    /// <summary>
    /// Get current withholding elections for an employee
    /// </summary>
    [HttpGet("employee/{employeeId:guid}/current")]
    [Cacheable(DurationSeconds = 120)]
    public async Task<IActionResult> GetCurrentByEmployee(Guid employeeId)
    {
        var query = new ListWithholdingElectionsQuery(EmployeeId: employeeId, CurrentOnly: true) { PageSize = 60 };
        var result = await mediator.Send(query);
        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteWithholdingElectionCommand(id));
        return result ? NoContent() : NotFound();
    }
}
