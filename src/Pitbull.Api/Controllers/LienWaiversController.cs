using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Billing.Features.LienWaivers;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/lien-waivers")]
[Authorize(Policy = "Billing.LienWaivers")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Lien Waivers")]
public class LienWaiversController(ILienWaiverService lienWaiverService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ListLienWaiversResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] Guid? projectId,
        [FromQuery] Guid? vendorId,
        [FromQuery] LienWaiverType? waiverType,
        [FromQuery] LienWaiverStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var result = await lienWaiverService.GetLienWaiversAsync(
            new ListLienWaiversQuery(projectId, vendorId, waiverType, status, page, pageSize));

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(LienWaiverDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await lienWaiverService.GetLienWaiverAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(LienWaiverDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateLienWaiverRequest request)
    {
        CreateLienWaiverCommand command = new(
            ProjectId: request.ProjectId,
            VendorId: request.VendorId,
            WaiverType: request.WaiverType,
            Amount: request.Amount,
            ThroughDate: request.ThroughDate,
            Description: request.Description);

        var result = await lienWaiverService.CreateLienWaiverAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(LienWaiverDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLienWaiverRequest request)
    {
        UpdateLienWaiverCommand command = new(
            WaiverId: id,
            Amount: request.Amount,
            ThroughDate: request.ThroughDate,
            Description: request.Description,
            DocumentPath: request.DocumentPath);

        var result = await lienWaiverService.UpdateLienWaiverAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await lienWaiverService.DeleteLienWaiverAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    [HttpPost("{id:guid}/receive")]
    [ProducesResponseType(typeof(LienWaiverDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkReceived(Guid id, [FromBody] MarkReceivedRequest? request = null)
    {
        var result = await lienWaiverService.MarkReceivedAsync(id, request?.DocumentPath);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(LienWaiverDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId is null) return Unauthorized(new { error = "Valid user identity required" });
        var result = await lienWaiverService.ApproveAsync(id, userId.Value);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(LienWaiverDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectLienWaiverRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId is null) return Unauthorized(new { error = "Valid user identity required" });
        var result = await lienWaiverService.RejectAsync(id, userId.Value, request.Reason);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        return Ok(result.Value);
    }

    private Guid? GetCurrentUserId()
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out Guid parsed) ? parsed : null;
    }
}

// ── Request Records ──

public record CreateLienWaiverRequest(
    Guid ProjectId,
    Guid? VendorId,
    LienWaiverType WaiverType,
    decimal Amount,
    DateOnly ThroughDate,
    string? Description = null
);

public record UpdateLienWaiverRequest(
    decimal? Amount = null,
    DateOnly? ThroughDate = null,
    string? Description = null,
    string? DocumentPath = null
);

public record MarkReceivedRequest(
    string? DocumentPath = null
);

public record RejectLienWaiverRequest(
    string Reason
);
