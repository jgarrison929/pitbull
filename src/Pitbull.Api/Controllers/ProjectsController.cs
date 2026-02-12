using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Attributes;
using Pitbull.Api.Extensions;
using Pitbull.Api.Services;
using Pitbull.Core.CQRS;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.GetProjectStats;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;
using Pitbull.Projects.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manage construction projects. All endpoints require authentication.
/// Projects are scoped to the authenticated user's tenant.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Projects")]
public class ProjectsController(
    IProjectService projectService,
    IAiInsightsService aiInsightsService) : ControllerBase
{
    /// <summary>
    /// Create a new project
    /// </summary>
    /// <remarks>
    /// Creates a new construction project within the current tenant.
    /// The project number must be unique within the tenant.
    /// Note: enum values in JSON request bodies are numeric by default (System.Text.Json).
    ///
    /// Sample request:
    ///
    ///     POST /api/projects
    ///     {
    ///         "name": "Highway Bridge Renovation",
    ///         "number": "PRJ-2026-001",
    ///         "type": 0,
    ///         "contractAmount": 2500000.00,
    ///         "clientName": "State DOT",
    ///         "startDate": "2026-03-01"
    ///     }
    ///
    /// </remarks>
    /// <param name="command">Project creation details</param>
    /// <returns>The newly created project</returns>
    /// <response code="201">Project created successfully</response>
    /// <response code="400">Validation error or duplicate project number</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(ProjectDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateProjectCommand command)
    {
        var result = await projectService.CreateProjectAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Get a project by ID
    /// </summary>
    /// <remarks>
    /// Returns the full project details including all fields.
    /// Only returns projects within the authenticated user's tenant.
    /// </remarks>
    /// <param name="id">Project unique identifier</param>
    /// <returns>Project details</returns>
    /// <response code="200">Project found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Project not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [Cacheable(DurationSeconds = 180)]
    [ProducesResponseType(typeof(ProjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await projectService.GetProjectAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" 
                ? this.NotFoundError(result.Error ?? "Project not found") 
                : this.BadRequestError(result.Error ?? "Request failed");

        return Ok(result.Value);
    }

    /// <summary>
    /// List projects with filtering and pagination
    /// </summary>
    /// <remarks>
    /// Returns a paginated list of projects for the current tenant.
    /// Supports filtering by status, type, and free-text search (matches name and number).
    ///
    /// Example: `GET /api/projects?status=Active&amp;search=bridge&amp;page=1&amp;pageSize=25`
    /// </remarks>
    /// <param name="status">Filter by project status (e.g., Active, Completed, OnHold)</param>
    /// <param name="type">Filter by project type (e.g., Commercial, Residential, Industrial)</param>
    /// <param name="search">Free-text search across project name and number</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Items per page (default: 10, max: 100)</param>
    /// <returns>Paginated list of projects</returns>
    /// <response code="200">Returns paginated project list</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [Cacheable(DurationSeconds = 120)]
    [ProducesResponseType(typeof(PagedResult<ProjectDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] ProjectStatus? status,
        [FromQuery] ProjectType? type,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = new ListProjectsQuery(status, type, search)
        {
            Page = page,
            PageSize = pageSize
        };
        
        var result = await projectService.GetProjectsAsync(query);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Update an existing project
    /// </summary>
    /// <remarks>
    /// Updates all fields of an existing project. The ID in the URL must match the ID in the request body.
    /// Only projects within the authenticated user's tenant can be updated.
    /// </remarks>
    /// <param name="id">Project unique identifier</param>
    /// <param name="command">Updated project details</param>
    /// <returns>The updated project</returns>
    /// <response code="200">Project updated successfully</response>
    /// <response code="400">Validation error or ID mismatch</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Project not found</response>
    /// <response code="409">Concurrent modification detected - refresh and try again</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ProjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectCommand command)
    {
        // Ensure ID consistency between route and body
        var commandWithId = command with { Id = id };
        var result = await projectService.UpdateProjectAsync(commandWithId);
        
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error ?? "Project not found"),
                "CONFLICT" => this.Error(409, result.Error ?? "Conflict occurred", "CONFLICT"),
                "VALIDATION_ERROR" => this.BadRequestError(result.Error ?? "Validation failed"),
                _ => this.BadRequestError(result.Error ?? "Update failed")
            };
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Delete a project (soft delete)
    /// </summary>
    /// <remarks>
    /// Performs a soft delete on the project. The record is not physically removed from the database
    /// but is marked as deleted and excluded from all queries.
    /// </remarks>
    /// <param name="id">Project unique identifier</param>
    /// <response code="204">Project deleted successfully</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Project not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await projectService.DeleteProjectAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND" 
                ? this.NotFoundError(result.Error ?? "Project not found") 
                : this.BadRequestError(result.Error ?? "Delete failed");

        return NoContent();
    }

    // ========================================
    // AI-POWERED INSIGHTS
    // ========================================

    /// <summary>
    /// Get AI-powered insights and health assessment for a project
    /// </summary>
    /// <remarks>
    /// Uses Claude AI to analyze the project's time entries, assignments, budget utilization,
    /// and other metrics to generate an intelligent summary with actionable recommendations.
    /// 
    /// The response includes:
    /// - Executive summary of project health
    /// - Health score (0-100) with status category
    /// - Positive highlights
    /// - Potential concerns
    /// - AI-generated recommendations
    /// - Key metrics used in analysis
    /// 
    /// Note: Requires ANTHROPIC_API_KEY to be configured. Returns error if not set.
    /// </remarks>
    /// <param name="id">Project unique identifier</param>
    /// <returns>AI-generated project insights</returns>
    /// <response code="200">AI analysis completed successfully</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Project not found</response>
    /// <response code="503">AI service unavailable or not configured</response>
    [HttpGet("{id:guid}/ai-summary")]
    [ProducesResponseType(typeof(AiProjectSummaryResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetAiSummary(Guid id)
    {
        var result = await aiInsightsService.GetProjectSummaryAsync(id);
        
        if (!result.Success)
        {
            if (result.Error?.Contains("not found", StringComparison.OrdinalIgnoreCase) == true)
                return this.NotFoundError(result.Error);
            
            if (result.Error?.Contains("not configured", StringComparison.OrdinalIgnoreCase) == true)
                return StatusCode(503, new { error = result.Error, code = "AI_NOT_CONFIGURED" });
            
            return StatusCode(503, new { error = result.Error, code = "AI_ERROR" });
        }

        return Ok(result);
    }

    /// <summary>
    /// Get project statistics (hours, costs, employees)
    /// </summary>
    /// <remarks>
    /// Returns a quick summary of project metrics without AI analysis.
    /// Faster than the AI endpoint and suitable for dashboards and real-time displays.
    /// 
    /// Includes:
    /// - Total hours logged (regular, OT, DT breakdown)
    /// - Total labor cost (approved entries only)
    /// - Time entry counts (total, approved, pending)
    /// - Number of assigned employees
    /// - Date range of time entries
    /// </remarks>
    /// <param name="id">Project unique identifier</param>
    /// <returns>Project statistics</returns>
    /// <response code="200">Statistics returned successfully</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Project not found</response>
    [HttpGet("{id:guid}/stats")]
    [Cacheable(DurationSeconds = 60)]
    [ProducesResponseType(typeof(ProjectStatsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStats(Guid id)
    {
        var result = await projectService.GetProjectStatsAsync(id);
        
        if (!result.IsSuccess)
        {
            return result.ErrorCode == "PROJECT_NOT_FOUND"
                ? this.NotFoundError(result.Error ?? "Project not found")
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
        }

        return Ok(result.Value);
    }
}
