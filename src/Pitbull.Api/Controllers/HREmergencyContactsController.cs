using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmergencyContact;
using Pitbull.HR.Features.DeleteEmergencyContact;
using Pitbull.HR.Features.GetEmergencyContact;
using Pitbull.HR.Features.ListEmergencyContacts;
using Pitbull.HR.Features.UpdateEmergencyContact;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR Emergency Contact management - track employee emergency contacts.
/// </summary>
[ApiController]
[Route("api/hr/emergency-contacts")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - Emergency Contacts")]
public class HREmergencyContactsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new emergency contact for an employee
    /// </summary>
    /// <remarks>
    /// Priority is auto-assigned if not specified (next available number).
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(EmergencyContactDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create([FromBody] CreateEmergencyContactCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "EMPLOYEE_NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get an emergency contact by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(EmergencyContactDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetEmergencyContactQuery(id));
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND" 
                ? NotFound(new { error = result.Error }) 
                : BadRequest(new { error = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// List emergency contacts with optional employee filter
    /// </summary>
    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    [ProducesResponseType(typeof(PagedResult<EmergencyContactListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = new ListEmergencyContactsQuery(EmployeeId: employeeId)
        {
            Page = page,
            PageSize = pageSize
        };
        
        var result = await mediator.Send(query);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Get emergency contacts for a specific employee
    /// </summary>
    /// <remarks>
    /// Convenience endpoint that returns contacts ordered by priority.
    /// </remarks>
    [HttpGet("employee/{employeeId:guid}")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PagedResult<EmergencyContactListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListByEmployee(Guid employeeId)
    {
        var query = new ListEmergencyContactsQuery(EmployeeId: employeeId)
        {
            PageSize = 10
        };
        
        var result = await mediator.Send(query);
        return Ok(result.Value);
    }

    /// <summary>
    /// Update an emergency contact
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmergencyContactDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmergencyContactCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { error = "Route ID does not match body ID" });

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Delete (soft-delete) an emergency contact
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteEmergencyContactCommand(id));
        return result ? NoContent() : NotFound();
    }
}
