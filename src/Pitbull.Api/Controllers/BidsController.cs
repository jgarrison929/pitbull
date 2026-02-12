using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.ConvertBidToProject;
using Pitbull.Bids.Features.DeleteBid;
using Pitbull.Bids.Features.GetBid;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Core.CQRS;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manage construction bids and estimates. All endpoints require authentication.
/// Bids are scoped to the authenticated user's tenant and can be converted to projects when won.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Bids")]
public class BidsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new bid
    /// </summary>
    /// <remarks>
    /// Creates a new bid/estimate within the current tenant.
    /// The bid number must be unique within the tenant.
    /// Note: enum values in JSON request bodies are numeric by default (System.Text.Json).
    /// Optionally include line items for detailed cost breakdown.
    ///
    /// Sample request:
    ///
    ///     POST /api/bids
    ///     {
    ///         "name": "Highway Bridge Estimate",
    ///         "number": "BID-2026-005",
    ///         "estimatedValue": 500000.00,
    ///         "bidDate": "2026-02-15",
    ///         "dueDate": "2026-03-01",
    ///         "owner": "John Doe",
    ///         "items": [
    ///             {
    ///                 "description": "Concrete work",
    ///                 "category": 1,
    ///                 "quantity": 500,
    ///                 "unitCost": 125.00
    ///             }
    ///         ]
    ///     }
    ///
    /// </remarks>
    /// <param name="command">Bid creation details with optional line items</param>
    /// <returns>The newly created bid</returns>
    /// <response code="201">Bid created successfully</response>
    /// <response code="400">Validation error or duplicate bid number</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(BidDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateBidCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a bid by ID
    /// </summary>
    /// <remarks>
    /// Returns the full bid details including all line items.
    /// Only returns bids within the authenticated user's tenant.
    /// </remarks>
    /// <param name="id">Bid unique identifier</param>
    /// <returns>Bid details with line items</returns>
    /// <response code="200">Bid found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Bid not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 180)] // Cache for 3 minutes (bids change less frequently)
    [ProducesResponseType(typeof(BidDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetBidQuery(id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// List bids with filtering and pagination
    /// </summary>
    /// <remarks>
    /// Returns a paginated list of bids for the current tenant.
    /// Supports filtering by status and free-text search (matches name and number).
    ///
    /// Example: `GET /api/bids?status=Submitted&amp;search=highway&amp;page=1&amp;pageSize=25`
    /// </remarks>
    /// <param name="status">Filter by bid status (e.g., Draft, Submitted, Won, Lost)</param>
    /// <param name="search">Free-text search across bid name and number</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 10, max: 100)</param>
    /// <returns>Paginated list of bids</returns>
    /// <response code="200">Returns paginated bid list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [Cacheable(DurationSeconds = 120)] // Cache for 2 minutes (list data changes more frequently)
    [ProducesResponseType(typeof(PagedResult<BidDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] BidStatus? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = new ListBidsQuery(status, search)
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
    /// Update an existing bid
    /// </summary>
    /// <remarks>
    /// Updates all fields of an existing bid including line items.
    /// The ID in the URL must match the ID in the request body.
    /// Only bids within the authenticated user's tenant can be updated.
    /// </remarks>
    /// <param name="id">Bid unique identifier</param>
    /// <param name="command">Updated bid details</param>
    /// <returns>The updated bid</returns>
    /// <response code="200">Bid updated successfully</response>
    /// <response code="400">Validation error or ID mismatch</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Bid not found</response>
    /// <response code="409">Concurrent modification detected - refresh and try again</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(BidDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBidCommand command)
    {
        if (id != command.Id)
            return BadRequest(new { error = "Route ID does not match body ID" });

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

    /// <summary>
    /// Convert a won bid to a project
    /// </summary>
    /// <remarks>
    /// Converts a bid with status "Won" into a new project.
    /// The bid must have a status of "Won" and must not have already been converted.
    /// A new project is created with data carried over from the bid.
    ///
    /// Sample request:
    ///
    ///     POST /api/bids/{id}/convert-to-project
    ///     {
    ///         "projectNumber": "PRJ-2026-010"
    ///     }
    ///
    /// </remarks>
    /// <param name="id">Bid unique identifier (must have status "Won")</param>
    /// <param name="request">Conversion details including the new project number</param>
    /// <returns>Conversion result with new project details</returns>
    /// <response code="200">Bid converted to project successfully</response>
    /// <response code="400">Bid is not in "Won" status</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Bid not found</response>
    /// <response code="409">Bid has already been converted to a project</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost("{id:guid}/convert-to-project")]
    [ProducesResponseType(typeof(ConvertBidToProjectResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ConvertToProject(Guid id, [FromBody] ConvertToProjectRequest request)
    {
        var result = await mediator.Send(new ConvertBidToProjectCommand(id, request.ProjectNumber));
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                "INVALID_STATUS" => BadRequest(new { error = result.Error, code = result.ErrorCode }),
                "ALREADY_CONVERTED" => Conflict(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error })
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Delete a bid (soft delete)
    /// </summary>
    /// <remarks>
    /// Performs a soft delete on the bid. The record is not physically removed from the database
    /// but is marked as deleted and excluded from all queries.
    /// Only bids within the authenticated user's tenant can be deleted.
    /// </remarks>
    /// <param name="id">Bid unique identifier</param>
    /// <returns>No content on successful deletion</returns>
    /// <response code="204">Bid deleted successfully</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Bid not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteBidCommand(id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" ? NotFound(new { error = result.Error }) : BadRequest(new { error = result.Error });

        return NoContent();
    }
}

/// <summary>
/// Request to convert a won bid into a project
/// </summary>
/// <param name="ProjectNumber">Unique project number for the new project (e.g., "PRJ-2026-010")</param>
public record ConvertToProjectRequest(string ProjectNumber);
