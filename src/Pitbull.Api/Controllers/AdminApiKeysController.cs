using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.SystemAdmin.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// API key management for external integrations.
/// Keys are hashed — plaintext only returned once on creation.
/// </summary>
[ApiController]
[Route("api/admin/api-keys")]
[Authorize(Policy = "SystemAdmin.APIKeys")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - API Keys")]
public class AdminApiKeysController(IApiKeyService apiKeyService) : ControllerBase
{
    /// <summary>
    /// List all API keys (plaintext never shown)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiKeyListResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var result = await apiKeyService.ListKeysAsync(page, pageSize);
        return Ok(result.Value);
    }

    /// <summary>
    /// Create a new API key. The plaintext key is returned ONLY in this response.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiKeyCreatedDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateApiKeyCommand command)
    {
        var result = await apiKeyService.CreateKeyAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    /// <summary>
    /// Revoke an API key (soft disable — key record remains for audit)
    /// </summary>
    [HttpPost("{id:guid}/revoke")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Revoke(Guid id)
    {
        var email = User.FindFirst("email")?.Value ?? User.Identity?.Name ?? "unknown";
        var result = await apiKeyService.RevokeKeyAsync(id, email);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }

    /// <summary>
    /// Permanently delete an API key
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await apiKeyService.DeleteKeyAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return NoContent();
    }
}
