using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/admin/secrets")]
[Authorize(Policy = "Admin.Settings")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("System Admin")]
public class SecretsController(ISecretsService secretsService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(SecretsStatusResponse), StatusCodes.Status200OK)]
    public IActionResult GetStatus()
    {
        var statuses = secretsService.GetAllSecretStatuses();

        var grouped = statuses
            .GroupBy(s => s.Category)
            .Select(g => new SecretCategoryDto(
                Category: g.Key,
                Secrets: g.Select(s => new SecretItemDto(
                    Key: s.Key,
                    DisplayName: s.DisplayName,
                    IsConfigured: s.IsConfigured,
                    MaskedValue: s.MaskedValue
                )).ToList()
            ))
            .ToList();

        var configuredCount = statuses.Count(s => s.IsConfigured);
        var totalCount = statuses.Count;

        return Ok(new SecretsStatusResponse(
            ConfiguredCount: configuredCount,
            TotalCount: totalCount,
            Categories: grouped
        ));
    }
}

public record SecretItemDto(string Key, string DisplayName, bool IsConfigured, string? MaskedValue);
public record SecretCategoryDto(string Category, List<SecretItemDto> Secrets);
public record SecretsStatusResponse(int ConfiguredCount, int TotalCount, List<SecretCategoryDto> Categories);
