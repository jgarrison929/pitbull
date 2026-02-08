using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.CQRS;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.RFIs.Features.GetRfi;
using Pitbull.RFIs.Features.ListRfis;
using Pitbull.RFIs.Features.UpdateRfi;

namespace Pitbull.Api.Controllers;

/// <summary>
/// RFI (Request for Information) management for construction projects.
/// RFIs track formal questions about unclear construction documents.
/// All endpoints require authentication and are scoped to the authenticated user's tenant.
/// </summary>
[ApiController]
[Route("api/projects/{projectId:guid}/rfis")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("RFIs")]
public class RfisController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new RFI for the specified project
    /// </summary>
    /// <remarks>
    /// Creates a new Request for Information within the specified project.
    /// RFI numbers are automatically assigned sequentially within each project.
    ///
    /// Sample request:
    ///
    ///     POST /api/projects/{projectId}/rfis
    ///     {
    ///         "subject": "Foundation Depth Clarification",
    ///         "question": "Drawing A2.1 shows 36\" depth but specification calls for 42\". Please clarify.",
    ///         "priority": "High",
    ///         "dueDate": "2026-02-15",
    ///         "ballInCourtName": "John Architect"
    ///     }
    ///
    /// </remarks>
    /// <param name="projectId">The project ID to create the RFI in</param>
    /// <param name="request">RFI creation details</param>
    /// <returns>The newly created RFI</returns>
    /// <response code="201">RFI created successfully</response>
    /// <response code="400">Validation error (missing subject/question, invalid priority)</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(RfiDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
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
    /// <remarks>
    /// Returns the full details of a single RFI including its question, answer (if provided),
    /// status, priority, and assignment information.
    /// </remarks>
    /// <param name="projectId">The project ID containing the RFI</param>
    /// <param name="id">The RFI ID to retrieve</param>
    /// <returns>The requested RFI</returns>
    /// <response code="200">RFI found and returned</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">RFI not found in this project</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(RfiDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
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
    /// <remarks>
    /// Returns a paginated list of RFIs for the specified project.
    /// Results can be filtered by status, priority, ball-in-court assignee, or text search.
    ///
    /// **Filtering examples:**
    /// - `/api/projects/{projectId}/rfis?status=Open` - Only open RFIs
    /// - `/api/projects/{projectId}/rfis?priority=Critical` - Only critical priority
    /// - `/api/projects/{projectId}/rfis?search=foundation` - Search in subject/question
    /// - `/api/projects/{projectId}/rfis?ballInCourtUserId={userId}` - RFIs assigned to specific user
    ///
    /// Results are ordered by creation date (newest first).
    /// </remarks>
    /// <param name="projectId">The project ID to list RFIs for</param>
    /// <param name="status">Filter by status (Open, Answered, Closed)</param>
    /// <param name="priority">Filter by priority (Low, Normal, High, Critical)</param>
    /// <param name="ballInCourtUserId">Filter by ball-in-court user ID</param>
    /// <param name="search">Search text in subject and question fields</param>
    /// <param name="page">Page number (1-based, default: 1)</param>
    /// <param name="pageSize">Items per page (1-100, default: 25)</param>
    /// <returns>Paginated list of RFIs</returns>
    /// <response code="200">RFI list returned</response>
    /// <response code="400">Invalid filter parameters</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<RfiDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
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
    /// <remarks>
    /// Updates an RFI's details including subject, question, answer, status, and assignments.
    ///
    /// **Status transitions:**
    /// - Open → Answered (when answer is provided)
    /// - Answered → Closed (when RFI is resolved)
    /// - Any status → Open (to reopen an RFI)
    ///
    /// **Ball-in-court:**
    /// Indicates who needs to take action on the RFI. Updates automatically track who has the ball.
    ///
    /// Sample request:
    ///
    ///     PUT /api/projects/{projectId}/rfis/{id}
    ///     {
    ///         "subject": "Foundation Depth Clarification",
    ///         "question": "Drawing A2.1 shows 36\" depth but specification calls for 42\". Please clarify.",
    ///         "answer": "Use specification depth of 42\". Drawing will be revised in next issue.",
    ///         "status": "Answered",
    ///         "priority": "High"
    ///     }
    ///
    /// </remarks>
    /// <param name="projectId">The project ID containing the RFI</param>
    /// <param name="id">The RFI ID to update</param>
    /// <param name="request">Updated RFI details</param>
    /// <returns>The updated RFI</returns>
    /// <response code="200">RFI updated successfully</response>
    /// <response code="400">Validation error</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">RFI not found in this project</response>
    /// <response code="409">Conflict (concurrent update detected)</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(RfiDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
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
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "CONFLICT" => Conflict(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error })
            };
        }

        return Ok(result.Value);
    }
}

/// <summary>Request body for creating a new RFI</summary>
/// <param name="Subject">Brief subject line for the RFI (e.g., "Foundation Depth Clarification")</param>
/// <param name="Question">The detailed question being asked</param>
/// <param name="Priority">Priority level (Low, Normal, High, Critical). Default: Normal</param>
/// <param name="DueDate">When a response is needed by</param>
/// <param name="AssignedToUserId">User ID of person responsible for answering</param>
/// <param name="AssignedToName">Display name of person responsible for answering</param>
/// <param name="BallInCourtUserId">User ID of person who currently needs to take action</param>
/// <param name="BallInCourtName">Display name of person who currently needs to take action</param>
/// <param name="CreatedByName">Display name of person creating the RFI</param>
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

/// <summary>Request body for updating an existing RFI</summary>
/// <param name="Subject">Brief subject line for the RFI</param>
/// <param name="Question">The detailed question being asked</param>
/// <param name="Answer">The response to the RFI question</param>
/// <param name="Status">Current status (Open, Answered, Closed)</param>
/// <param name="Priority">Priority level (Low, Normal, High, Critical)</param>
/// <param name="DueDate">When a response is needed by</param>
/// <param name="AssignedToUserId">User ID of person responsible for answering</param>
/// <param name="AssignedToName">Display name of person responsible for answering</param>
/// <param name="BallInCourtUserId">User ID of person who currently needs to take action</param>
/// <param name="BallInCourtName">Display name of person who currently needs to take action</param>
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
