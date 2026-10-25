using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Pitbull.Api.Features.CostPredictions;

[ApiController]
[Route("api/projects/{projectId:guid}/cost-to-complete")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Cost Predictions")]
public class CostToCompleteController(
    ICostToCompleteService service,
    ILogger<CostToCompleteController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPrediction(Guid projectId, CancellationToken ct)
    {
        try
        {
            var result = await service.PredictAsync(projectId, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Project {ProjectId} not found for cost-to-complete", projectId);
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Cannot generate cost-to-complete for project {ProjectId}", projectId);
            return BadRequest(new { error = ex.Message });
        }
    }
}
