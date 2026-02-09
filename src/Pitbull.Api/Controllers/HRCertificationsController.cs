using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateCertification;
using Pitbull.HR.Features.DeleteCertification;
using Pitbull.HR.Features.GetCertification;
using Pitbull.HR.Features.ListCertifications;
using Pitbull.HR.Features.UpdateCertification;

namespace Pitbull.Api.Controllers;

/// <summary>
/// HR Certification management - track employee certifications and licenses.
/// Supports expiration tracking and compliance enforcement.
/// </summary>
[ApiController]
[Route("api/hr/certifications")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("HR - Certifications")]
public class HRCertificationsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new certification for an employee
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CertificationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateCertificationCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "EMPLOYEE_NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                "DUPLICATE_CERTIFICATION" => Conflict(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a certification by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(CertificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetCertificationQuery(id));
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "NOT_FOUND" 
                ? NotFound(new { error = result.Error }) 
                : BadRequest(new { error = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// List certifications with filtering and pagination
    /// </summary>
    /// <remarks>
    /// Filter options:
    /// - employeeId: Filter by specific employee
    /// - certificationTypeCode: Filter by certification type (e.g., "OSHA10", "CDL")
    /// - status: Filter by status (Pending, Verified, Invalid, Expired, Revoked)
    /// - expiringSoon: Only show certifications expiring within 90 days
    /// - expired: Only show expired certifications
    /// </remarks>
    [HttpGet]
    [Cacheable(DurationSeconds = 60)]
    [ProducesResponseType(typeof(PagedResult<CertificationListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId,
        [FromQuery] string? certificationTypeCode,
        [FromQuery] CertificationStatus? status,
        [FromQuery] bool? expiringSoon,
        [FromQuery] bool? expired,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = new ListCertificationsQuery(
            EmployeeId: employeeId,
            CertificationTypeCode: certificationTypeCode,
            Status: status,
            ExpiringSoon: expiringSoon,
            Expired: expired)
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
    /// Get certifications expiring soon (within 90 days)
    /// </summary>
    /// <remarks>
    /// Convenience endpoint for compliance dashboards.
    /// Returns certifications ordered by expiration date (soonest first).
    /// </remarks>
    [HttpGet("expiring")]
    [Cacheable(DurationSeconds = 300)]
    [ProducesResponseType(typeof(PagedResult<CertificationListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListExpiring([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = new ListCertificationsQuery(ExpiringSoon: true)
        {
            Page = page,
            PageSize = pageSize
        };
        
        var result = await mediator.Send(query);
        return Ok(result.Value);
    }

    /// <summary>
    /// Update a certification
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CertificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCertificationCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { error = "Route ID does not match body ID" });

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "DUPLICATE_CERTIFICATION" => Conflict(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error })
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Delete (soft-delete) a certification
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteCertificationCommand(id));
        return result ? NoContent() : NotFound();
    }
}
