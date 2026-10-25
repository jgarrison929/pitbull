using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.CQRS;
using Pitbull.Core.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Cross-entity "My Approvals" dashboard API.
/// </summary>
[ApiController]
[Route("api/workflow-approvals")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Workflow")]
public class WorkflowApprovalsController(IWorkflowApprovalService workflowApproval) : ControllerBase
{
    [HttpGet("pending")]
    [ProducesResponseType(typeof(List<PendingApprovalDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyPending(CancellationToken ct)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await workflowApproval.GetMyPendingAsync(userId, ct);
        return HandleResult(result);
    }

    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(PendingApprovalDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] WorkflowApprovalDecisionRequest? request, CancellationToken ct)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var userName = User.FindFirstValue("name") ?? User.Identity?.Name;
        var result = await workflowApproval.ApproveAsync(id, userId, userName, request?.Comment, ct);
        return HandleResult(result);
    }

    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(PendingApprovalDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] WorkflowApprovalDecisionRequest request, CancellationToken ct)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var userName = User.FindFirstValue("name") ?? User.Identity?.Name;
        var result = await workflowApproval.RejectAsync(id, userId, userName, request.Comment, ct);
        return HandleResult(result);
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out userId);
    }

    private IActionResult HandleResult<T>(Result<T> result)
    {
        if (result.IsSuccess)
            return Ok(result.Value);

        return result.ErrorCode switch
        {
            "NOT_FOUND" => NotFound(new { error = result.Error, code = result.ErrorCode }),
            "FORBIDDEN" => StatusCode(403, new { error = result.Error, code = result.ErrorCode }),
            _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
        };
    }
}

public sealed record WorkflowApprovalDecisionRequest(string? Comment);