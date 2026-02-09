using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmploymentEpisode;
using Pitbull.HR.Features.DeleteEmploymentEpisode;
using Pitbull.HR.Features.GetEmploymentEpisode;
using Pitbull.HR.Features.ListEmploymentEpisodes;
using Pitbull.HR.Features.UpdateEmploymentEpisode;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR Employment Episodes - track hire/termination/rehire cycles.
/// Construction industry has 60%+ turnover; rehire-first is the norm.
/// </summary>
[ApiController]
[Route("api/hr/employment-episodes")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - Employment Episodes")]
public class HREmploymentEpisodesController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new employment episode (hire/rehire an employee)
    /// </summary>
    /// <remarks>
    /// Creates a new employment period. Episode number auto-increments.
    /// Cannot create if employee has an active (non-terminated) episode.
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(EmploymentEpisodeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateEmploymentEpisodeCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "EMPLOYEE_NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                "ACTIVE_EPISODE_EXISTS" => Conflict(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get an employment episode by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(EmploymentEpisodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetEmploymentEpisodeQuery(id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return Ok(result.Value);
    }

    /// <summary>
    /// List employment episodes
    /// </summary>
    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    [ProducesResponseType(typeof(PagedResult<EmploymentEpisodeListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId,
        [FromQuery] bool? currentOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = new ListEmploymentEpisodesQuery(EmployeeId: employeeId, CurrentOnly: currentOnly)
        {
            Page = page,
            PageSize = pageSize
        };
        var result = await mediator.Send(query);
        return Ok(result.Value);
    }

    /// <summary>
    /// Get employment history for a specific employee
    /// </summary>
    [HttpGet("employee/{employeeId:guid}")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PagedResult<EmploymentEpisodeListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListByEmployee(Guid employeeId)
    {
        var query = new ListEmploymentEpisodesQuery(EmployeeId: employeeId) { PageSize = 50 };
        var result = await mediator.Send(query);
        return Ok(result.Value);
    }

    /// <summary>
    /// Update an employment episode (terminate/separate)
    /// </summary>
    /// <remarks>
    /// Primarily used to record termination details: date, reason, rehire eligibility.
    /// </remarks>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmploymentEpisodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmploymentEpisodeCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { error = "Route ID does not match body ID" });
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });
        return Ok(result.Value);
    }

    /// <summary>
    /// Delete (soft-delete) an employment episode
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteEmploymentEpisodeCommand(id));
        return result ? NoContent() : NotFound();
    }
}
