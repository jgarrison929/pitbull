using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Reports.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/cost-predictions")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Reports")]
public class CostPredictionController(ICostPredictionService service, ILogger<CostPredictionController> logger) : ControllerBase
{
    [HttpGet("project/{projectId:guid}")]
    public async Task<IActionResult> GetLatestPrediction(Guid projectId, CancellationToken cancellationToken)
    {
        var result = await service.GetLatestPredictionAsync(projectId, cancellationToken);
        if (result is null)
            return NotFound(new { error = "No prediction found for this project." });
        return Ok(result);
    }

    [HttpGet("project/{projectId:guid}/history")]
    public async Task<IActionResult> GetPredictionHistory(Guid projectId, CancellationToken cancellationToken)
    {
        var result = await service.GetPredictionHistoryAsync(projectId, cancellationToken);
        return Ok(result);
    }

    [HttpPost("project/{projectId:guid}/generate")]
    public async Task<IActionResult> GeneratePrediction(Guid projectId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.GeneratePredictionAsync(projectId, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Failed to generate prediction for project {ProjectId}", projectId);
            return BadRequest(new { error = ex.Message });
        }
    }
}
