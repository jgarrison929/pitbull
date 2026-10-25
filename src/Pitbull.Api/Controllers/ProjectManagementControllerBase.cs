using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Core.CQRS;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Pitbull.Api.Controllers;

[Authorize]
public abstract class ProjectManagementControllerBase : ControllerBase
{
    protected bool TryGetCurrentUserId(out Guid userId)
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out userId);
    }

    protected IActionResult HandleResult<T>(Result<T> result)
    {
        if (result.IsSuccess)
            return Ok(result.Value);

        return MapErrorResult(result.Error, result.ErrorCode);
    }

    protected IActionResult HandleAction(Result result)
    {
        if (result.IsSuccess)
            return NoContent();

        return MapErrorResult(result.Error, result.ErrorCode);
    }

    private IActionResult MapErrorResult(string? error, string? errorCode) => errorCode switch
    {
        "NOT_FOUND" => NotFound(new { error, code = errorCode }),
        "UNAUTHORIZED" => Unauthorized(new { error, code = errorCode }),
        "FORBIDDEN" => StatusCode(403, new { error, code = errorCode }),
        _ => BadRequest(new { error, code = errorCode }),
    };
}
