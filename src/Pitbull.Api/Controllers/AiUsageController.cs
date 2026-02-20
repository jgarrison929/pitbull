using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.AI.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/ai/usage")]
[Authorize(Policy = "AI.Settings")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("AI Usage")]
public class AiUsageController(IAiUsageService aiUsageService) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        var summary = await aiUsageService.GetUsageSummaryAsync(from, to, ct);
        return Ok(summary);
    }

    [HttpGet("by-user")]
    public async Task<IActionResult> GetByUser([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        var data = await aiUsageService.GetUsageByUserAsync(from, to, ct);
        return Ok(data);
    }

    [HttpGet("by-provider")]
    public async Task<IActionResult> GetByProvider([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        var data = await aiUsageService.GetUsageByProviderAsync(from, to, ct);
        return Ok(data);
    }

    [HttpGet("daily")]
    public async Task<IActionResult> GetDaily([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        var data = await aiUsageService.GetDailyUsageAsync(from, to, ct);
        return Ok(data);
    }
}
