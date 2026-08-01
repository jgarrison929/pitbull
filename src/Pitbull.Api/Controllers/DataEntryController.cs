using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.AI.Services;
using Pitbull.Core.Logging;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/data-entry")]
[Authorize]
[EnableRateLimiting("ai-chat")]
[Produces("application/json")]
[Tags("AI")]
public class DataEntryController(IDataEntryService service, ILogger<DataEntryController> logger) : ControllerBase
{
    private const int MaxParseTextLength = 4000;
    private const int MaxEntityTypeLength = 100;

    [HttpPost("parse")]
    public async Task<IActionResult> Parse([FromBody] DataEntryParseRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(new { error = "Text is required." });
        if (request.Text.Length > MaxParseTextLength)
            return BadRequest(new { error = $"Text cannot exceed {MaxParseTextLength} characters." });

        var result = await service.ParseAsync(request.Text, cancellationToken);
        return Ok(result);
    }

    [HttpPost("execute")]
    public async Task<IActionResult> Execute([FromBody] DataEntryExecuteRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.EntityType))
            return BadRequest(new { error = "EntityType is required." });
        if (request.EntityType.Length > MaxEntityTypeLength)
            return BadRequest(new { error = $"EntityType cannot exceed {MaxEntityTypeLength} characters." });

        try
        {
            var result = await service.ExecuteAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Data entry execution failed for {EntityType}", LogSafe.Text(request.EntityType));
            return BadRequest(new { error = ex.Message });
        }
    }
}
