using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Api.Extensions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.DeleteSubcontract;
using Pitbull.Contracts.Features.GetSubcontract;
using Pitbull.Contracts.Features.ListSubcontracts;
using Pitbull.Contracts.Features.UpdateSubcontract;
using Pitbull.Core.CQRS;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manage subcontracts for construction projects. All endpoints require authentication.
/// Subcontracts are scoped to the authenticated user's tenant.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Subcontracts")]
public class SubcontractsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new subcontract
    /// </summary>
    /// <remarks>
    /// Creates a new subcontract agreement within the current tenant.
    /// The subcontract number must be unique within the tenant.
    ///
    /// Sample request:
    ///
    ///     POST /api/subcontracts
    ///     {
    ///         "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    ///         "subcontractNumber": "SC-2026-001",
    ///         "subcontractorName": "ABC Concrete Inc",
    ///         "scopeOfWork": "Concrete foundations and footings",
    ///         "tradeCode": "03 - Concrete",
    ///         "originalValue": 150000.00,
    ///         "retainagePercent": 10
    ///     }
    ///
    /// </remarks>
    /// <param name="command">Subcontract creation details</param>
    /// <returns>The newly created subcontract</returns>
    /// <response code="201">Subcontract created successfully</response>
    /// <response code="400">Validation error or duplicate subcontract number</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(SubcontractDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateSubcontractCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a subcontract by ID
    /// </summary>
    /// <remarks>
    /// Returns the full subcontract details including financial information.
    /// Only returns subcontracts within the authenticated user's tenant.
    /// </remarks>
    /// <param name="id">Subcontract unique identifier</param>
    /// <returns>Subcontract details</returns>
    /// <response code="200">Subcontract found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Subcontract not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 180)]
    [ProducesResponseType(typeof(SubcontractDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetSubcontractQuery(id));
        return this.HandleResult(result);
    }

    /// <summary>
    /// List subcontracts with filtering and pagination
    /// </summary>
    /// <remarks>
    /// Returns a paginated list of subcontracts for the current tenant.
    /// Supports filtering by project, status, and free-text search (matches subcontractor name and number).
    ///
    /// Example: `GET /api/subcontracts?projectId=xxx&amp;status=InProgress&amp;search=concrete&amp;page=1&amp;pageSize=25`
    /// </remarks>
    /// <param name="projectId">Filter by project ID</param>
    /// <param name="status">Filter by subcontract status (e.g., Draft, Executed, InProgress)</param>
    /// <param name="search">Free-text search across subcontractor name and number</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 20, max: 100)</param>
    /// <returns>Paginated list of subcontracts</returns>
    /// <response code="200">Returns paginated subcontract list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PagedResult<SubcontractDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? projectId,
        [FromQuery] SubcontractStatus? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = new ListSubcontractsQuery(projectId, status, search, page, pageSize);
        var result = await mediator.Send(query);
        
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Update an existing subcontract
    /// </summary>
    /// <remarks>
    /// Updates all fields of an existing subcontract. The ID in the URL must match the ID in the request body.
    /// Only subcontracts within the authenticated user's tenant can be updated.
    /// </remarks>
    /// <param name="id">Subcontract unique identifier</param>
    /// <param name="command">Updated subcontract details</param>
    /// <returns>The updated subcontract</returns>
    /// <response code="200">Subcontract updated successfully</response>
    /// <response code="400">Validation error or ID mismatch</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Subcontract not found</response>
    /// <response code="409">Concurrent modification detected - refresh and try again</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SubcontractDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSubcontractCommand command)
    {
        if (id != command.Id)
            return this.BadRequestError("Route ID does not match body ID");

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Subcontract not found"),
                "CONFLICT" => this.Error(409, result.Error ?? "Conflict occurred", "CONFLICT"),
                _ => this.BadRequestError(result.Error ?? "Invalid request")
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Delete a subcontract (soft delete)
    /// </summary>
    /// <remarks>
    /// Performs a soft delete on the subcontract. The record is not physically removed from the database
    /// but is marked as deleted and excluded from all queries.
    /// Associated change orders are also soft-deleted.
    /// </remarks>
    /// <param name="id">Subcontract unique identifier</param>
    /// <response code="204">Subcontract deleted successfully</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Subcontract not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteSubcontractCommand(id));
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" 
                ? this.NotFoundError(result.Error ?? "Subcontract not found") 
                : this.BadRequestError(result.Error ?? "Delete failed");

        return NoContent();
    }
}
