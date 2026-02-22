using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Extensions;
using Pitbull.Core.Entities;
using Pitbull.Core.Features.Feedback;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/feedback")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Feedback")]
public class FeedbackController(
    IFeedbackService feedbackService,
    ICompanyContext companyContext) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(FeedbackDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateFeedbackApiRequest request, CancellationToken cancellationToken)
    {
        if (!companyContext.IsResolved)
            return this.BadRequestError("Company context required");

        if (string.IsNullOrWhiteSpace(request.Category) || string.IsNullOrWhiteSpace(request.Message))
            return this.BadRequestError("Category and message are required");

        if (request.Message.Length > 4000)
            return this.BadRequestError("Message cannot exceed 4000 characters");

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var userRole = !string.IsNullOrWhiteSpace(request.UserRole)
            ? request.UserRole
            : User.FindFirstValue(ClaimTypes.Role) ?? "Unknown";

        if (!Enum.TryParse<FeedbackType>(request.Type, true, out var feedbackType))
            feedbackType = FeedbackType.General;

        var created = await feedbackService.CreateAsync(
            new CreateFeedbackRequest(
                Page: request.Page,
                UserRole: userRole,
                Category: request.Category,
                Message: request.Message,
                ContactEmail: request.ContactEmail,
                Type: feedbackType,
                ScreenshotUrl: request.ScreenshotUrl,
                BrowserInfo: request.BrowserInfo),
            userId,
            cancellationToken);

        return Created($"/api/feedback/{created.Id}", created);
    }

    [HttpGet]
    [Authorize(Policy = "Admin.Settings")]
    [ProducesResponseType(typeof(IReadOnlyList<FeedbackDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(
        [FromQuery] string? category,
        [FromQuery] FeedbackStatus? status,
        [FromQuery] FeedbackType? type,
        [FromQuery] DateTime? dateFromUtc,
        [FromQuery] DateTime? dateToUtc,
        CancellationToken cancellationToken)
    {
        if (!companyContext.IsResolved)
            return this.BadRequestError("Company context required");

        var items = await feedbackService.ListAsync(
            new FeedbackListQuery(category, status, dateFromUtc, dateToUtc, type),
            cancellationToken);

        return Ok(items);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = "Admin.Settings")]
    [ProducesResponseType(typeof(FeedbackDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateFeedbackStatusRequest request, CancellationToken cancellationToken)
    {
        if (!companyContext.IsResolved)
            return this.BadRequestError("Company context required");

        var updated = await feedbackService.UpdateStatusAsync(id, request.Status, cancellationToken);
        if (updated is null)
            return this.NotFoundError("Feedback entry not found");

        return Ok(updated);
    }

    [HttpPost("bulk-status")]
    [Authorize(Policy = "Admin.Settings")]
    [ProducesResponseType(typeof(BulkStatusUpdateResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> BulkUpdateStatus([FromBody] BulkUpdateFeedbackStatusRequest request, CancellationToken cancellationToken)
    {
        if (!companyContext.IsResolved)
            return this.BadRequestError("Company context required");

        if (request.Ids.Count == 0)
            return this.BadRequestError("At least one feedback ID is required");

        if (request.Ids.Count > 100)
            return this.BadRequestError("Cannot update more than 100 items at once");

        var updatedCount = await feedbackService.BulkUpdateStatusAsync(request.Ids, request.Status, cancellationToken);
        return Ok(new BulkStatusUpdateResult(updatedCount));
    }
}

public sealed record CreateFeedbackApiRequest(
    string Page,
    string UserRole,
    string Category,
    string Message,
    string? ContactEmail,
    string? Type = null,
    string? ScreenshotUrl = null,
    string? BrowserInfo = null);

public sealed record UpdateFeedbackStatusRequest(FeedbackStatus Status);

public sealed record BulkUpdateFeedbackStatusRequest(List<Guid> Ids, FeedbackStatus Status);

public sealed record BulkStatusUpdateResult(int UpdatedCount);
