using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Api.Extensions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.OwnerChangeOrders;
using Pitbull.Contracts.Services;
using Pitbull.Core.CQRS;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manage owner change orders for projects. All endpoints require authentication.
/// Owner change orders track modifications to owner contract scope and value.
/// </summary>
[ApiController]
[Route("api/owner-change-orders")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Owner Change Orders")]
public class OwnerChangeOrdersController(IContractsService contractsService) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(OwnerChangeOrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateOwnerChangeOrderRequest request)
    {
        var command = new CreateOwnerChangeOrderCommand(
            ProjectId: request.ProjectId,
            ChangeOrderNumber: request.Number ?? request.ChangeOrderNumber ?? string.Empty,
            Title: request.Title,
            Description: request.Description,
            Reason: request.Reason,
            Amount: request.Amount,
            DaysExtension: request.DaysExtension,
            ReferenceNumber: request.ReferenceNumber,
            OwnerContractId: request.OwnerContractId,
            OriginatingRfiId: request.OriginatingRfiId,
            Status: request.Status ?? ChangeOrderStatus.Pending,
            ScheduleImpactDays: request.ScheduleImpactDays ?? request.DaysExtension,
            CostImpact: request.CostImpact,
            RequestedBy: request.RequestedBy,
            RequestDate: request.RequestDate ?? request.SubmittedDate,
            ApprovedDate: request.ApprovedDate
        );

        var result = await contractsService.CreateOwnerChangeOrderAsync(command);
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

    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 180)]
    [ProducesResponseType(typeof(OwnerChangeOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await contractsService.GetOwnerChangeOrderAsync(id);
        return this.HandleResult(result);
    }

    [HttpGet]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PagedResult<OwnerChangeOrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? projectId,
        [FromQuery] ChangeOrderStatus? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = new ListOwnerChangeOrdersQuery(projectId, status, search, page, pageSize);
        var result = await contractsService.ListOwnerChangeOrdersAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(OwnerChangeOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOwnerChangeOrderRequest request)
    {
        if (id != request.Id)
            return this.BadRequestError("Route ID does not match body ID");

        var command = new UpdateOwnerChangeOrderCommand(
            Id: request.Id,
            ChangeOrderNumber: request.Number ?? request.ChangeOrderNumber ?? string.Empty,
            Title: request.Title,
            Description: request.Description,
            Reason: request.Reason,
            Amount: request.Amount,
            DaysExtension: request.DaysExtension,
            Status: request.Status,
            ReferenceNumber: request.ReferenceNumber,
            OwnerContractId: request.OwnerContractId,
            ScheduleImpactDays: request.ScheduleImpactDays ?? request.DaysExtension,
            CostImpact: request.CostImpact,
            RequestedBy: request.RequestedBy,
            RequestDate: request.RequestDate ?? request.SubmittedDate,
            ApprovedDate: request.ApprovedDate
        );

        var result = await contractsService.UpdateOwnerChangeOrderAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Owner change order not found"),
                "DUPLICATE_CO_NUMBER" => this.BadRequestError(result.Error ?? "Duplicate change order number"),
                _ => this.BadRequestError(result.Error ?? "Invalid request")
            };
        }

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await contractsService.DeleteOwnerChangeOrderAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Owner change order not found")
                : this.BadRequestError(result.Error ?? "Delete failed");

        return NoContent();
    }
}

public record CreateOwnerChangeOrderRequest(
    Guid ProjectId,
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
    Guid? OwnerContractId = null,
    DateTime? RequestDate = null,
    DateTime? SubmittedDate = null,
    DateTime? ApprovedDate = null,
    Guid? OriginatingRfiId = null
);

public record UpdateOwnerChangeOrderRequest(
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
    Guid? OwnerContractId = null,
    DateTime? RequestDate = null,
    DateTime? SubmittedDate = null,
    DateTime? ApprovedDate = null
);