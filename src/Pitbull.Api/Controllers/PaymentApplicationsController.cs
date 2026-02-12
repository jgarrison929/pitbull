using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Api.Extensions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Contracts.Features.DeletePaymentApplication;
using Pitbull.Contracts.Features.GetPaymentApplication;
using Pitbull.Contracts.Features.ListPaymentApplications;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Core.CQRS;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manage payment applications (pay apps) for subcontracts. All endpoints require authentication.
/// Payment applications track billing progress and payment against subcontract value.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Payment Applications")]
public class PaymentApplicationsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Create a new payment application
    /// </summary>
    /// <remarks>
    /// Creates a new payment application for a subcontract. The application number
    /// is automatically assigned sequentially. Amounts are calculated based on
    /// previous applications and subcontract retainage percentage.
    ///
    /// Sample request:
    ///
    ///     POST /api/paymentapplications
    ///     {
    ///         "subcontractId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    ///         "periodStart": "2026-02-01",
    ///         "periodEnd": "2026-02-28",
    ///         "workCompletedThisPeriod": 25000.00,
    ///         "storedMaterials": 5000.00,
    ///         "invoiceNumber": "INV-2026-001"
    ///     }
    ///
    /// </remarks>
    /// <param name="command">Payment application creation details</param>
    /// <returns>The newly created payment application with calculated amounts</returns>
    /// <response code="201">Payment application created successfully</response>
    /// <response code="400">Validation error</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(PaymentApplicationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreatePaymentApplicationCommand command)
    {
        var result = await mediator.Send(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a payment application by ID
    /// </summary>
    /// <remarks>
    /// Returns the full payment application details including all calculated amounts.
    /// </remarks>
    /// <param name="id">Payment application unique identifier</param>
    /// <returns>Payment application details</returns>
    /// <response code="200">Payment application found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Payment application not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 180)]
    [ProducesResponseType(typeof(PaymentApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await mediator.Send(new GetPaymentApplicationQuery(id));
        return this.HandleResult(result);
    }

    /// <summary>
    /// List payment applications with filtering and pagination
    /// </summary>
    /// <remarks>
    /// Returns a paginated list of payment applications ordered by application number (descending).
    /// Supports filtering by subcontract and status.
    ///
    /// Example: `GET /api/paymentapplications?subcontractId=xxx&amp;status=Submitted&amp;page=1&amp;pageSize=25`
    /// </remarks>
    /// <param name="subcontractId">Filter by subcontract ID</param>
    /// <param name="status">Filter by status (e.g., Draft, Submitted, Approved, Paid)</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 20, max: 100)</param>
    /// <returns>Paginated list of payment applications</returns>
    /// <response code="200">Returns paginated payment application list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PagedResult<PaymentApplicationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? subcontractId,
        [FromQuery] PaymentApplicationStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = new ListPaymentApplicationsQuery(subcontractId, status, page, pageSize);
        var result = await mediator.Send(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Update a payment application
    /// </summary>
    /// <remarks>
    /// Updates payment application details. Status changes automatically set relevant dates.
    /// When marked as Paid, the subcontract's billing totals are updated.
    /// </remarks>
    /// <param name="id">Payment application unique identifier</param>
    /// <param name="command">Updated payment application details</param>
    /// <returns>The updated payment application</returns>
    /// <response code="200">Payment application updated successfully</response>
    /// <response code="400">Validation error or ID mismatch</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Payment application not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PaymentApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePaymentApplicationCommand command)
    {
        if (id != command.Id)
            return this.BadRequestError("Route ID does not match body ID");

        var result = await mediator.Send(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Payment application not found"),
                _ => this.BadRequestError(result.Error ?? "Invalid request")
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Delete a payment application (soft delete)
    /// </summary>
    /// <remarks>
    /// Performs a soft delete on the payment application.
    /// Only draft payment applications can be deleted.
    /// </remarks>
    /// <param name="id">Payment application unique identifier</param>
    /// <response code="204">Payment application deleted successfully</response>
    /// <response code="400">Cannot delete non-draft application</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Payment application not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await mediator.Send(new DeletePaymentApplicationCommand(id));
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Payment application not found"),
                "INVALID_STATUS" => this.BadRequestError(result.Error ?? "Cannot delete non-draft application"),
                _ => this.BadRequestError(result.Error ?? "Delete failed")
            };
        }

        return NoContent();
    }
}
