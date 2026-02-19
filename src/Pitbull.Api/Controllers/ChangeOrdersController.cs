using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Api.Extensions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.ListChangeOrders;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Contracts.Services;
using Pitbull.Core.CQRS;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manage change orders for subcontracts. All endpoints require authentication.
/// Change orders track modifications to subcontract scope and value.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Change Orders")]
public class ChangeOrdersController(IContractsService contractsService) : ControllerBase
{
    /// <summary>
    /// Create a new change order
    /// </summary>
    /// <remarks>
    /// Creates a new change order for a subcontract.
    /// The change order number must be unique within the subcontract.
    /// New change orders are created with Pending status.
    ///
    /// Sample request:
    ///
    ///     POST /api/changeorders
    ///     {
    ///         "subcontractId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    ///         "changeOrderNumber": "CO-001",
    ///         "title": "Additional Foundation Work",
    ///         "description": "Extended footings required due to soil conditions",
    ///         "reason": "Field condition",
    ///         "amount": 15000.00,
    ///         "daysExtension": 5
    ///     }
    ///
    /// </remarks>
    /// <param name="request">Change order creation details</param>
    /// <returns>The newly created change order</returns>
    /// <response code="201">Change order created successfully</response>
    /// <response code="400">Validation error or duplicate change order number</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(ChangeOrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateChangeOrderRequest request)
    {
        try
        {
            var command = new CreateChangeOrderCommand(
                SubcontractId: request.SubcontractId,
                ChangeOrderNumber: request.Number ?? request.ChangeOrderNumber ?? string.Empty,
                Title: request.Title,
                Description: request.Description,
                Reason: request.Reason,
                Amount: request.Amount,
                DaysExtension: request.DaysExtension,
                ReferenceNumber: request.ReferenceNumber,
                OriginatingRfiId: request.OriginatingRfiId,
                Status: request.Status ?? ChangeOrderStatus.Pending,
                ScheduleImpactDays: request.ScheduleImpactDays ?? request.DaysExtension,
                CostImpact: request.CostImpact,
                RequestedBy: request.RequestedBy,
                RequestDate: request.RequestDate ?? request.SubmittedDate,
                ApprovedDate: request.ApprovedDate
            );

            var result = await contractsService.CreateChangeOrderAsync(command);
            if (!result.IsSuccess)
            {
                return result.ErrorCode switch
                {
                    "NOT_FOUND" => NotFound(new { error = result.Error, code = "NOT_FOUND" }),
                    _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
                };
            }

            return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "Failed to create change order", code = "DATABASE_ERROR" });
        }
    }

    [NonAction]
    public Task<IActionResult> Create(CreateChangeOrderCommand command) =>
        Create(new CreateChangeOrderRequest(
            SubcontractId: command.SubcontractId,
            Title: command.Title,
            Description: command.Description,
            Amount: command.Amount,
            Number: command.ChangeOrderNumber,
            ChangeOrderNumber: command.ChangeOrderNumber,
            Status: command.Status,
            ScheduleImpactDays: command.ScheduleImpactDays,
            DaysExtension: command.DaysExtension,
            CostImpact: command.CostImpact,
            RequestedBy: command.RequestedBy,
            Reason: command.Reason,
            ReferenceNumber: command.ReferenceNumber,
            RequestDate: command.RequestDate,
            SubmittedDate: command.RequestDate,
            ApprovedDate: command.ApprovedDate,
            OriginatingRfiId: command.OriginatingRfiId
        ));

    /// <summary>
    /// Get a change order by ID
    /// </summary>
    /// <remarks>
    /// Returns the full change order details including status and approval information.
    /// </remarks>
    /// <param name="id">Change order unique identifier</param>
    /// <returns>Change order details</returns>
    /// <response code="200">Change order found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Change order not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 180)]
    [ProducesResponseType(typeof(ChangeOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await contractsService.GetChangeOrderAsync(id);
        return this.HandleResult(result);
    }

    /// <summary>
    /// List change orders with filtering and pagination
    /// </summary>
    /// <remarks>
    /// Returns a paginated list of change orders.
    /// Supports filtering by subcontract, status, and free-text search (matches title and CO number).
    ///
    /// Example: `GET /api/changeorders?subcontractId=xxx&amp;status=Pending&amp;page=1&amp;pageSize=25`
    /// </remarks>
    /// <param name="subcontractId">Filter by subcontract ID</param>
    /// <param name="status">Filter by status (e.g., Pending, Approved, Rejected)</param>
    /// <param name="search">Free-text search across title and change order number</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 20, max: 100)</param>
    /// <returns>Paginated list of change orders</returns>
    /// <response code="200">Returns paginated change order list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PagedResult<ChangeOrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? subcontractId,
        [FromQuery] ChangeOrderStatus? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = new ListChangeOrdersQuery(subcontractId, status, search, page, pageSize);
        var result = await contractsService.ListChangeOrdersAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Update an existing change order
    /// </summary>
    /// <remarks>
    /// Updates change order details. Status changes will automatically set
    /// approval/rejection dates when transitioning to Approved or Rejected status.
    /// </remarks>
    /// <param name="id">Change order unique identifier</param>
    /// <param name="request">Updated change order details</param>
    /// <returns>The updated change order</returns>
    /// <response code="200">Change order updated successfully</response>
    /// <response code="400">Validation error or ID mismatch</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Change order not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ChangeOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateChangeOrderRequest request)
    {
        if (id != request.Id)
            return this.BadRequestError("Route ID does not match body ID");

        var command = new UpdateChangeOrderCommand(
            Id: request.Id,
            ChangeOrderNumber: request.Number ?? request.ChangeOrderNumber ?? string.Empty,
            Title: request.Title,
            Description: request.Description,
            Reason: request.Reason,
            Amount: request.Amount,
            DaysExtension: request.DaysExtension,
            Status: request.Status,
            ReferenceNumber: request.ReferenceNumber,
            ScheduleImpactDays: request.ScheduleImpactDays ?? request.DaysExtension,
            CostImpact: request.CostImpact,
            RequestedBy: request.RequestedBy,
            RequestDate: request.RequestDate ?? request.SubmittedDate,
            ApprovedDate: request.ApprovedDate
        );

        var result = await contractsService.UpdateChangeOrderAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Change order not found"),
                "DUPLICATE_CO_NUMBER" => this.BadRequestError(result.Error ?? "Duplicate change order number"),
                _ => this.BadRequestError(result.Error ?? "Invalid request")
            };
        }

        return Ok(result.Value);
    }

    [NonAction]
    public Task<IActionResult> Update(Guid id, UpdateChangeOrderCommand command) =>
        Update(id, new UpdateChangeOrderRequest(
            Id: command.Id,
            Title: command.Title,
            Description: command.Description,
            Amount: command.Amount,
            Status: command.Status,
            Number: command.ChangeOrderNumber,
            ChangeOrderNumber: command.ChangeOrderNumber,
            ScheduleImpactDays: command.ScheduleImpactDays,
            DaysExtension: command.DaysExtension,
            CostImpact: command.CostImpact,
            RequestedBy: command.RequestedBy,
            Reason: command.Reason,
            ReferenceNumber: command.ReferenceNumber,
            RequestDate: command.RequestDate,
            SubmittedDate: command.RequestDate,
            ApprovedDate: command.ApprovedDate
        ));

    /// <summary>
    /// Delete a change order (soft delete)
    /// </summary>
    /// <remarks>
    /// Performs a soft delete on the change order.
    /// </remarks>
    /// <param name="id">Change order unique identifier</param>
    /// <response code="204">Change order deleted successfully</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Change order not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await contractsService.DeleteChangeOrderAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Change order not found")
                : this.BadRequestError(result.Error ?? "Delete failed");

        return NoContent();
    }
}

public record CreateChangeOrderRequest(
    Guid SubcontractId,
    string Title,
    string Description,
    decimal Amount,
    string? Number = null,
    string? ChangeOrderNumber = null,
    ChangeOrderStatus? Status = null,
    int? ScheduleImpactDays = null,
    int? DaysExtension = null,
    decimal? CostImpact = null,
    string? RequestedBy = null,
    string? Reason = null,
    string? ReferenceNumber = null,
    DateTime? RequestDate = null,
    DateTime? SubmittedDate = null,
    DateTime? ApprovedDate = null,
    Guid? OriginatingRfiId = null
);

public record UpdateChangeOrderRequest(
    Guid Id,
    string Title,
    string Description,
    decimal Amount,
    ChangeOrderStatus Status,
    string? Number = null,
    string? ChangeOrderNumber = null,
    int? ScheduleImpactDays = null,
    int? DaysExtension = null,
    decimal? CostImpact = null,
    string? RequestedBy = null,
    string? Reason = null,
    string? ReferenceNumber = null,
    DateTime? RequestDate = null,
    DateTime? SubmittedDate = null,
    DateTime? ApprovedDate = null
);
