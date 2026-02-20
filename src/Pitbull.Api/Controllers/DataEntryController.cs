using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.AI.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/data-entry")]
[Authorize]
[EnableRateLimiting("ai-chat")]
[Produces("application/json")]
[Tags("AI")]
public class DataEntryController(IDataEntryService service, ILogger<DataEntryController> logger) : ControllerBase
{
    [HttpPost("parse")]
    public async Task<IActionResult> Parse([FromBody] DataEntryParseRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(new { error = "Text is required." });

        var result = await service.ParseAsync(request.Text, cancellationToken);
        return Ok(result);
    }

    [HttpPost("execute")]
    public async Task<IActionResult> Execute([FromBody] DataEntryExecuteRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.EntityType))
            return BadRequest(new { error = "EntityType is required." });

        try
        {
            var result = await service.ExecuteAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Data entry execution failed for {EntityType}", request.EntityType);
            return BadRequest(new { error = ex.Message });
        }
    }
}
