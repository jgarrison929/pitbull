using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Pitbull.Api.Features.Workflow;

[ApiController]
[Route("api/workflow-transitions")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Workflow")]
public class WorkflowTransitionController(WorkflowTransitionService service) : ControllerBase
{
    [HttpGet("{entityType}/{entityId:guid}")]
    public async Task<IActionResult> GetTransitions(
        string entityType, Guid entityId, CancellationToken ct)
    {
        var transitions = await service.GetTransitionsAsync(entityType, entityId, ct);
        return Ok(transitions);
    }
}
