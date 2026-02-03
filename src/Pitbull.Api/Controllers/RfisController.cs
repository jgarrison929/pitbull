using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.RFIs.Features.GetRfi;
using Pitbull.RFIs.Features.ListRfis;
using Pitbull.RFIs.Features.UpdateRfi;

namespace Pitbull.Api.Controllers;

/// <summary>
/// RFI (Request for Information) management for construction projects.
/// RFIs track formal questions about unclear construction documents.
/// </summary>
[ApiController]
[Route("api/projects/{projectId:guid}/rfis")]
[Authorize]
[EnableRateLimiting("api")]
public class RfisController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new RFI for the specified project
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateRfiRequest request)
    {
        var command = new CreateRfiCommand(
            projectId,
            request.Subject,
            request.Question,
            request.Priority,
            request.DueDate,
            request.AssignedToUserId,
            request.AssignedToName,
            request.BallInCourtUserId,
            request.BallInCourtName,
            request.CreatedByName
        );

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById),
            new { projectId, id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a specific RFI by ID within a project
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid projectId, Guid id)
    {
        var result = await mediator.Send(new GetRfiQuery(projectId, id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// List RFIs for a project with optional filtering
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        Guid projectId,
        [FromQuery] RfiStatus? status,
        [FromQuery] RfiPriority? priority,
        [FromQuery] Guid? ballInCourtUserId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var query = new ListRfisQuery(projectId, status, priority, ballInCourtUserId, search)
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
    /// Update an existing RFI
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid projectId, Guid id, [FromBody] UpdateRfiRequest request)
    {
        var command = new UpdateRfiCommand(
            id,
            projectId,
            request.Subject,
            request.Question,
            request.Answer,
            request.Status,
            request.Priority,
            request.DueDate,
            request.AssignedToUserId,
            request.AssignedToName,
            request.BallInCourtUserId,
            request.BallInCourtName
        );

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }
}

// Request DTOs
public record CreateRfiRequest(
    string Subject,
    string Question,
    RfiPriority Priority = RfiPriority.Normal,
    DateTime? DueDate = null,
    Guid? AssignedToUserId = null,
    string? AssignedToName = null,
    Guid? BallInCourtUserId = null,
    string? BallInCourtName = null,
    string? CreatedByName = null
);

public record UpdateRfiRequest(
    string Subject,
    string Question,
    string? Answer,
    RfiStatus Status,
    RfiPriority Priority,
    DateTime? DueDate = null,
    Guid? AssignedToUserId = null,
    string? AssignedToName = null,
    Guid? BallInCourtUserId = null,
    string? BallInCourtName = null
);