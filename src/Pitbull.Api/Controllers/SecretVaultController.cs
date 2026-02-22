using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.SystemAdmin.Domain;
using Pitbull.SystemAdmin.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/admin/secret-vault")]
[Authorize(Policy = "Admin.Settings")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Secret Vault")]
public class SecretVaultController(ISecretVaultService secretVaultService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(SecretVaultListResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] string? category = null)
    {
        SecretCategory? filter = null;
        if (!string.IsNullOrWhiteSpace(category) && Enum.TryParse<SecretCategory>(category, true, out var parsed))
            filter = parsed;

        var result = await secretVaultService.ListAsync(filter);
        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SecretVaultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await secretVaultService.GetByIdAsync(id);
        if (!result.IsSuccess)
            return NotFound(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SecretVaultDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateSecretVaultCommand command)
    {
        var result = await secretVaultService.CreateAsync(command);
        if (!result.IsSuccess)
            return result.ErrorCode == "DUPLICATE_KEY"
                ? Conflict(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SecretVaultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSecretVaultCommand command)
    {
        var result = await secretVaultService.UpdateAsync(id, command);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await secretVaultService.DeleteAsync(id);
        if (!result.IsSuccess)
            return NotFound(new { error = result.Error });

        return NoContent();
    }
}
