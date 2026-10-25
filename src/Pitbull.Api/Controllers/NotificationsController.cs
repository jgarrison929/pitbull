using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Notifications.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Notifications")]
public class NotificationsController(INotificationService notificationService) : ControllerBase
{
    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return claim != null && Guid.TryParse(claim.Value, out var id) ? id : null;
    }

    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await notificationService.GetAllAsync(userId.Value, page, pageSize);
        return Ok(result.Value);
    }

    [HttpGet("unread")]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnread()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await notificationService.GetUnreadAsync(userId.Value);
        return Ok(result.Value);
    }

    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await notificationService.GetUnreadCountAsync(userId.Value);
        return Ok(new { count = result.Value });
    }

    [HttpPost]
    [Authorize(Policy = "Admin.Settings")]
    [ProducesResponseType(typeof(NotificationDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateNotificationRequest request)
    {
        // Match EF HasMaxLength on notifications (Title 200 / Message 1000 / RelatedEntityType 100).
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { error = "Title and message are required", code = "VALIDATION_ERROR" });
        if (request.Title.Length > 200)
            return BadRequest(new { error = "Title cannot exceed 200 characters", code = "VALIDATION_ERROR" });
        if (request.Message.Length > 1000)
            return BadRequest(new { error = "Message cannot exceed 1000 characters", code = "VALIDATION_ERROR" });
        if (request.RelatedEntityType is { Length: > 100 })
            return BadRequest(new { error = "RelatedEntityType cannot exceed 100 characters", code = "VALIDATION_ERROR" });

        var command = new CreateNotificationCommand(
            request.UserId,
            request.Title,
            request.Message,
            request.Type,
            request.RelatedEntityType,
            request.RelatedEntityId
        );

        var result = await notificationService.CreateAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetAll), null, result.Value);
    }

    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await notificationService.MarkReadAsync(id, userId.Value);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = "NOT_FOUND" })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    [HttpPost("read-all")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllRead()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await notificationService.MarkAllReadAsync(userId.Value);
        return Ok(new { markedRead = result.Value });
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await notificationService.DeleteAsync(id, userId.Value);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = "NOT_FOUND" })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}

public record CreateNotificationRequest(
    Guid UserId,
    string Title,
    string Message,
    Pitbull.Notifications.Domain.NotificationType Type = Pitbull.Notifications.Domain.NotificationType.Info,
    string? RelatedEntityType = null,
    Guid? RelatedEntityId = null
);
