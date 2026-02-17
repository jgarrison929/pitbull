using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Projects.Features.GetProjectPhases;
using Pitbull.Projects.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Project phases — trackable segments of a project (Foundation, Framing, MEP, etc.).
/// Used by crew time entry, project detail, and reporting pages.
/// </summary>
[ApiController]
[Route("api/projects/{projectId:guid}/phases")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Projects")]
public class PhasesController(IProjectService projectService) : ControllerBase
{
    /// <summary>
    /// List phases for a project
    /// </summary>
    /// <remarks>
    /// Returns all active phases for the specified project, ordered by SortOrder.
    /// Used by crew time entry to populate the phase dropdown, project detail page
    /// for phase progress, and print/export views.
    /// </remarks>
    /// <param name="projectId">Project identifier</param>
    /// <param name="pageSize">Maximum number of phases to return (default: 100)</param>
    /// <returns>List of phases</returns>
    /// <response code="200">Phases returned successfully</response>
    /// <response code="401">Not authenticated</response>
    [HttpGet]
    [ProducesResponseType(typeof(List<PhaseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] int pageSize = 100)
    {
        var result = await projectService.GetProjectPhasesAsync(projectId, pageSize);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Get a specific phase by ID
    /// </summary>
    /// <param name="projectId">Project identifier</param>
    /// <param name="phaseId">Phase identifier</param>
    /// <returns>Phase details</returns>
    /// <response code="200">Phase found</response>
    /// <response code="404">Phase not found</response>
    [HttpGet("{phaseId:guid}")]
    [ProducesResponseType(typeof(PhaseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid phaseId)
    {
        var result = await projectService.GetPhaseAsync(projectId, phaseId);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }
}
