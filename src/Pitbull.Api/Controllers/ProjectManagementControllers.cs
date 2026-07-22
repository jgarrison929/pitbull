using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.CQRS;
using Pitbull.Core.Services.Weather;
using Pitbull.Documents.Services;
using Pitbull.Api.Features.AI;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Schedule management endpoints for project planning, sequencing, and baseline tracking.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/schedules")]
public class ProjectSchedulesController(IScheduleService scheduleService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a new schedule for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Schedule details.</param>
    /// <returns>The created schedule record.</returns>
    /// <response code="200">Schedule created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await scheduleService.CreateScheduleAsync(projectId, request));

    /// <summary>
    /// Gets a schedule by ID for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <returns>The requested schedule.</returns>
    /// <response code="200">Schedule retrieved successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Schedule not found.</response>
    [HttpGet("{scheduleId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid scheduleId)
        => HandleResult(await scheduleService.GetScheduleAsync(projectId, scheduleId));

    /// <summary>
    /// Lists schedules for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of schedules.</returns>
    /// <response code="200">Schedules returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await scheduleService.ListSchedulesAsync(projectId, query));

    /// <summary>
    /// Updates an existing schedule for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <param name="request">Updated schedule values.</param>
    /// <returns>The updated schedule.</returns>
    /// <response code="200">Schedule updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Schedule not found.</response>
    [HttpPut("{scheduleId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid scheduleId, [FromBody] PmUpsertRequest request)
        => HandleResult(await scheduleService.UpdateScheduleAsync(projectId, scheduleId, request));

    /// <summary>
    /// Soft-deletes a schedule for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Schedule deleted successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Schedule not found.</response>
    [HttpDelete("{scheduleId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid scheduleId)
        => HandleAction(await scheduleService.DeleteScheduleAsync(projectId, scheduleId));

    /// <summary>
    /// Lists schedule activities for the specified schedule (site walk / Gantt).
    /// </summary>
    [HttpGet("{scheduleId:guid}/activities")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListActivities(Guid projectId, Guid scheduleId, [FromQuery] PmListQuery query)
        => HandleResult(await scheduleService.ListActivitiesAsync(projectId, scheduleId, query));

    /// <summary>
    /// Adds a schedule activity to the specified schedule.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <param name="request">Activity details.</param>
    /// <returns>The created activity.</returns>
    /// <response code="200">Activity added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Schedule not found.</response>
    [HttpPost("{scheduleId:guid}/activities")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddActivity(Guid projectId, Guid scheduleId, [FromBody] PmUpsertRequest request)
        => HandleResult(await scheduleService.AddActivityAsync(projectId, scheduleId, request));

    /// <summary>
    /// Updates a schedule activity on the specified schedule.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <param name="activityId">Activity identifier.</param>
    /// <param name="request">Updated activity details.</param>
    /// <returns>The updated activity.</returns>
    /// <response code="200">Activity updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Activity not found.</response>
    [HttpPut("{scheduleId:guid}/activities/{activityId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateActivity(Guid projectId, Guid scheduleId, Guid activityId, [FromBody] PmUpsertRequest request)
        => HandleResult(await scheduleService.UpdateActivityAsync(projectId, scheduleId, activityId, request));

    /// <summary>
    /// Lists dependency relationships for the specified schedule (Gantt).
    /// </summary>
    [HttpGet("{scheduleId:guid}/dependencies")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListDependencies(Guid projectId, Guid scheduleId, [FromQuery] PmListQuery query)
        => HandleResult(await scheduleService.ListDependenciesAsync(projectId, scheduleId, query));

    /// <summary>
    /// Adds a dependency relationship to the specified schedule.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <param name="request">Dependency details.</param>
    /// <returns>The created dependency.</returns>
    /// <response code="200">Dependency added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Schedule not found.</response>
    [HttpPost("{scheduleId:guid}/dependencies")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddDependency(Guid projectId, Guid scheduleId, [FromBody] PmUpsertRequest request)
        => HandleResult(await scheduleService.AddDependencyAsync(projectId, scheduleId, request));

    /// <summary>
    /// Removes a dependency from the specified schedule.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <param name="dependencyId">Dependency identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Dependency deleted successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Dependency not found.</response>
    [HttpDelete("{scheduleId:guid}/dependencies/{dependencyId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDependency(Guid projectId, Guid scheduleId, Guid dependencyId)
        => HandleAction(await scheduleService.DeleteDependencyAsync(projectId, scheduleId, dependencyId));

    /// <summary>
    /// Creates a baseline snapshot for the specified schedule.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <param name="request">Baseline metadata.</param>
    /// <returns>The baseline creation result.</returns>
    /// <response code="200">Baseline created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Schedule not found.</response>
    [HttpPost("{scheduleId:guid}/baseline")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Baseline(Guid projectId, Guid scheduleId, [FromBody] PmUpsertRequest request)
        => HandleResult(await scheduleService.CreateBaselineAsync(projectId, scheduleId, request));

    /// <summary>
    /// Gets schedule variance details for the specified schedule.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <returns>The schedule variance source record.</returns>
    /// <response code="200">Variance data returned.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Schedule not found.</response>
    [HttpGet("{scheduleId:guid}/variance")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Variance(Guid projectId, Guid scheduleId)
        => HandleResult(await scheduleService.GetScheduleAsync(projectId, scheduleId));

    /// <summary>
    /// Recalculates critical path data for the specified schedule.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="scheduleId">Schedule identifier.</param>
    /// <returns>The recalculation result.</returns>
    /// <response code="200">Critical path recalculated.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Schedule not found.</response>
    [HttpPost("{scheduleId:guid}/critical-path/recalculate")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Recalculate(Guid projectId, Guid scheduleId)
        => HandleResult(await scheduleService.RecalculateCriticalPathAsync(projectId, scheduleId));

    /// <summary>
    /// Imports schedule data for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Schedule import payload.</param>
    /// <returns>The imported schedule record.</returns>
    /// <response code="200">Schedule imported successfully.</response>
    /// <response code="400">Import payload invalid.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("/api/projects/{projectId:guid}/schedules/import")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Import(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await scheduleService.ImportScheduleAsync(projectId, request));

    /// <summary>
    /// Lists schedule import history for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of schedule imports.</returns>
    /// <response code="200">Import history returned.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("/api/projects/{projectId:guid}/schedules/imports")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Imports(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await scheduleService.ListImportsAsync(projectId, query));
}

/// <summary>
/// Job cost endpoints for budgets, commitments, actuals, and forecasting.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/job-cost")]
public class ProjectJobCostController(IJobCostService jobCostService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a new budget line item for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Budget details.</param>
    /// <returns>The created budget record.</returns>
    /// <response code="200">Budget created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("budgets")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateBudget(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await jobCostService.CreateBudgetAsync(projectId, request));

    /// <summary>
    /// Updates a budget line item.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="budgetId">Budget identifier.</param>
    /// <param name="request">Updated budget values.</param>
    /// <returns>The updated budget record.</returns>
    /// <response code="200">Budget updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Budget not found.</response>
    [HttpPut("budgets/{budgetId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateBudget(Guid projectId, Guid budgetId, [FromBody] PmUpsertRequest request)
        => HandleResult(await jobCostService.UpdateBudgetAsync(projectId, budgetId, request));

    /// <summary>
    /// Soft-deletes a job cost budget line item.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="budgetId">Budget identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Budget deleted successfully.</response>
    /// <response code="404">Budget not found.</response>
    [HttpDelete("budgets/{budgetId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteBudget(Guid projectId, Guid budgetId)
        => HandleAction(await jobCostService.DeleteBudgetAsync(projectId, budgetId));

    /// <summary>
    /// Lists budget line items for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of budget records.</returns>
    /// <response code="200">Budgets returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("budgets")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListBudgets(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await jobCostService.ListBudgetsAsync(projectId, query));

    /// <summary>
    /// Lists actual cost records for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of actual cost records.</returns>
    /// <response code="200">Actuals returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("actuals")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListActuals(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await jobCostService.ListActualsAsync(projectId, query));

    /// <summary>
    /// Rebuilds job cost actuals for the project from source transactions.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <returns>The rebuild operation result.</returns>
    /// <response code="200">Actuals rebuilt successfully.</response>
    /// <response code="400">Rebuild request invalid.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("actuals/rebuild")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RebuildActuals(Guid projectId)
        => HandleResult(await jobCostService.RebuildActualsAsync(projectId));

    /// <summary>
    /// Lists commitments for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of commitment records.</returns>
    /// <response code="200">Commitments returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("commitments")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListCommitments(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await jobCostService.ListCommitmentsAsync(projectId, query));

    /// <summary>
    /// Creates a commitment record for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Commitment details.</param>
    /// <returns>The created commitment record.</returns>
    /// <response code="200">Commitment created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("commitments")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateCommitment(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await jobCostService.CreateCommitmentAsync(projectId, request));

    /// <summary>
    /// Lists cost forecasts for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of forecast records.</returns>
    /// <response code="200">Forecasts returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("forecasts")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListForecasts(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await jobCostService.ListForecastsAsync(projectId, query));

    /// <summary>
    /// Creates a forecast record for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Forecast details.</param>
    /// <returns>The created forecast record.</returns>
    /// <response code="200">Forecast created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("forecasts")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateForecast(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await jobCostService.CreateForecastAsync(projectId, request));

    /// <summary>
    /// Returns over/under analysis for project forecasts.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of forecast analysis rows.</returns>
    /// <response code="200">Analysis returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("analysis/over-under")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> OverUnder(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await jobCostService.ListForecastsAsync(projectId, query));

    /// <summary>
    /// Returns unit cost metrics for project actuals.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of actual cost rows for unit analysis.</returns>
    /// <response code="200">Unit costs returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("unit-costs")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnitCosts(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await jobCostService.ListActualsAsync(projectId, query));
}

/// <summary>
/// Submittal management endpoints for creation, updates, workflows, and attachments.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/submittals")]
public class SubmittalsController(ISubmittalService submittalService, Pitbull.Api.Services.IPdfReportService pdfReportService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a new submittal for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Submittal details.</param>
    /// <returns>The created submittal.</returns>
    /// <response code="200">Submittal created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await submittalService.CreateSubmittalAsync(projectId, request));

    /// <summary>
    /// Gets a submittal by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="submittalId">Submittal identifier.</param>
    /// <returns>The requested submittal.</returns>
    /// <response code="200">Submittal returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Submittal not found.</response>
    [HttpGet("{submittalId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid submittalId)
        => HandleResult(await submittalService.GetSubmittalAsync(projectId, submittalId));

    /// <summary>
    /// Lists submittals for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <param name="view">
    /// Optional shape: <c>mobile</c> returns <see cref="SubmittalMobileListItemDto"/> rows
    /// (id, number, title, status, projectId, dueDate, updatedAt — no description bag / KPI %).
    /// </param>
    /// <returns>A paged list of submittals.</returns>
    /// <response code="200">Submittals returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(PagedResult<SubmittalMobileListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(
        Guid projectId,
        [FromQuery] PmListQuery query,
        // view=mobile → SubmittalMobileListItemDto (band 3.5 contract)
        [FromQuery] string? view = null)
    {
        var result = await submittalService.ListSubmittalsAsync(projectId, query);
        if (!result.IsSuccess)
            return HandleResult(result);

        var mobileView = string.Equals(view, "mobile", StringComparison.OrdinalIgnoreCase);
        if (mobileView)
        {
            var full = result.Value!;
            var slimItems = full.Items
                .Select(SubmittalListViewMapper.ToMobileListItem)
                .ToArray();
            return Ok(new PagedResult<SubmittalMobileListItemDto>(
                slimItems, full.TotalCount, full.Page, full.PageSize));
        }

        return HandleResult(result);
    }

    /// <summary>
    /// Updates an existing submittal.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="submittalId">Submittal identifier.</param>
    /// <param name="request">Updated submittal values.</param>
    /// <returns>The updated submittal.</returns>
    /// <response code="200">Submittal updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Submittal not found.</response>
    [HttpPut("{submittalId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid submittalId, [FromBody] PmUpsertRequest request)
        => HandleResult(await submittalService.UpdateSubmittalAsync(projectId, submittalId, request));

    /// <summary>
    /// Soft-deletes a submittal that is not approved or closed.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="submittalId">Submittal identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Submittal deleted successfully.</response>
    /// <response code="400">Submittal cannot be deleted in its current status.</response>
    /// <response code="404">Submittal not found.</response>
    [HttpDelete("{submittalId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid submittalId)
        => HandleAction(await submittalService.DeleteSubmittalAsync(projectId, submittalId));

    /// <summary>
    /// Adds a workflow event to a submittal.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="submittalId">Submittal identifier.</param>
    /// <param name="request">Workflow event details.</param>
    /// <returns>The created workflow event record.</returns>
    /// <response code="200">Workflow event recorded successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Submittal not found.</response>
    [HttpPost("{submittalId:guid}/workflow")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Workflow(Guid projectId, Guid submittalId, [FromBody] PmUpsertRequest request)
        => HandleResult(await submittalService.AddWorkflowEventAsync(projectId, submittalId, request));

    /// <summary>
    /// Attaches a document to the specified submittal.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="submittalId">Submittal identifier.</param>
    /// <param name="request">Attachment details.</param>
    /// <returns>The created attachment record.</returns>
    /// <response code="200">Attachment added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Submittal not found.</response>
    [HttpPost("{submittalId:guid}/attachments")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Attachment(Guid projectId, Guid submittalId, [FromBody] PmUpsertRequest request)
        => HandleResult(await submittalService.AddAttachmentAsync(projectId, submittalId, request));

    /// <summary>
    /// Returns the submittal register for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of submittals in register view.</returns>
    /// <response code="200">Register returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("register")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Register(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await submittalService.ListSubmittalsAsync(projectId, query));

    /// <summary>
    /// Exports the submittal log as a PDF document.
    /// </summary>
    [HttpGet("export-pdf")]
    [Produces("application/pdf")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportPdf(Guid projectId)
    {
        var bytes = await pdfReportService.GenerateSubmittalLogPdfAsync(projectId);
        return File(bytes, "application/pdf", $"submittal-log-{DateTime.UtcNow:yyyy-MM-dd}.pdf");
    }
}

/// <summary>
/// Plans, specifications, folders, and document distribution endpoints.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class PlansAndSpecsController(IPlansSpecsService plansSpecsService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Lists document folders for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of project folders.</returns>
    /// <response code="200">Folders returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("documents/folders")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListFolders(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await plansSpecsService.ListFoldersAsync(projectId, query));

    /// <summary>
    /// Creates a new document folder for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Folder details.</param>
    /// <returns>The created folder record.</returns>
    /// <response code="200">Folder created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("documents/folders")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateFolder(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.CreateFolderAsync(projectId, request));

    /// <summary>
    /// Creates a plan set for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Plan set details.</param>
    /// <returns>The created plan set.</returns>
    /// <response code="200">Plan set created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("plan-sets")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreatePlanSet(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.CreatePlanSetAsync(projectId, request));

    /// <summary>
    /// Lists plan sets for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of plan sets.</returns>
    /// <response code="200">Plan sets returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("plan-sets")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListPlanSets(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await plansSpecsService.ListPlanSetsAsync(projectId, query));

    /// <summary>
    /// Gets a plan set by ID for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="planSetId">Plan set identifier.</param>
    /// <returns>The requested plan set.</returns>
    /// <response code="200">Plan set returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Plan set not found.</response>
    [HttpGet("plan-sets/{planSetId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPlanSet(Guid projectId, Guid planSetId)
        => HandleResult(await plansSpecsService.GetPlanSetAsync(projectId, planSetId));

    /// <summary>
    /// Soft-deletes a plan set for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="planSetId">Plan set identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Plan set deleted successfully.</response>
    /// <response code="404">Plan set not found.</response>
    [HttpDelete("plan-sets/{planSetId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePlanSet(Guid projectId, Guid planSetId)
        => HandleAction(await plansSpecsService.DeletePlanSetAsync(projectId, planSetId));

    /// <summary>
    /// Adds a plan sheet to the specified plan set.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="planSetId">Plan set identifier.</param>
    /// <param name="request">Plan sheet details.</param>
    /// <returns>The created plan sheet.</returns>
    /// <response code="200">Plan sheet added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Plan set not found.</response>
    [HttpPost("plan-sets/{planSetId:guid}/sheets")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddSheet(Guid projectId, Guid planSetId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.AddPlanSheetAsync(projectId, planSetId, request));

    /// <summary>
    /// Adds a revision to a plan sheet.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="sheetId">Plan sheet identifier.</param>
    /// <param name="request">Revision details.</param>
    /// <returns>The created plan sheet revision.</returns>
    /// <response code="200">Revision added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Plan sheet not found.</response>
    [HttpPost("plan-sheets/{sheetId:guid}/revisions")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddSheetRevision(Guid projectId, Guid sheetId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.AddPlanSheetRevisionAsync(projectId, sheetId, request));

    /// <summary>
    /// Lists specification sections for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of specification sections.</returns>
    /// <response code="200">Specification sections returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("spec-sections")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListSpecSections(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await plansSpecsService.ListSpecSectionsAsync(projectId, query));

    /// <summary>
    /// Creates a specification section for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Specification section details.</param>
    /// <returns>The created specification section.</returns>
    /// <response code="200">Specification section created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("spec-sections")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateSpecSection(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.CreateSpecSectionAsync(projectId, request));

    /// <summary>
    /// Soft-deletes a specification section for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="specSectionId">Specification section identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Specification section deleted successfully.</response>
    /// <response code="404">Specification section not found.</response>
    [HttpDelete("spec-sections/{specSectionId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSpecSection(Guid projectId, Guid specSectionId)
        => HandleAction(await plansSpecsService.DeleteSpecSectionAsync(projectId, specSectionId));

    /// <summary>
    /// Adds a revision to a specification section.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="specSectionId">Specification section identifier.</param>
    /// <param name="request">Revision details.</param>
    /// <returns>The created specification revision.</returns>
    /// <response code="200">Revision added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Specification section not found.</response>
    [HttpPost("spec-sections/{specSectionId:guid}/revisions")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddSpecRevision(Guid projectId, Guid specSectionId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.AddSpecRevisionAsync(projectId, specSectionId, request));

    /// <summary>
    /// Creates a project document distribution record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Distribution details.</param>
    /// <returns>The created distribution record.</returns>
    /// <response code="200">Distribution created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("document-distributions")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateDistribution(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.CreateDistributionAsync(projectId, request));

    /// <summary>
    /// Lists project document distributions.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of distribution records.</returns>
    /// <response code="200">Distributions returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("document-distributions")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListDistributions(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await plansSpecsService.ListDistributionsAsync(projectId, query));
}

/// <summary>
/// Project communication endpoints for correspondence tracking and attachments.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/communications")]
public class ProjectCommunicationsController(ICommunicationService communicationService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a communication record for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Communication details.</param>
    /// <returns>The created communication record.</returns>
    /// <response code="200">Communication created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await communicationService.CreateCommunicationAsync(projectId, request));

    /// <summary>
    /// Gets a communication record by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="communicationId">Communication identifier.</param>
    /// <returns>The requested communication record.</returns>
    /// <response code="200">Communication returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Communication not found.</response>
    [HttpGet("{communicationId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid communicationId)
        => HandleResult(await communicationService.GetCommunicationAsync(projectId, communicationId));

    /// <summary>
    /// Lists project communications.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of communication records.</returns>
    /// <response code="200">Communications returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await communicationService.ListCommunicationsAsync(projectId, query));

    /// <summary>
    /// Updates an existing communication record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="communicationId">Communication identifier.</param>
    /// <param name="request">Updated communication values.</param>
    /// <returns>The updated communication record.</returns>
    /// <response code="200">Communication updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Communication not found.</response>
    [HttpPut("{communicationId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid communicationId, [FromBody] PmUpsertRequest request)
        => HandleResult(await communicationService.UpdateCommunicationAsync(projectId, communicationId, request));

    /// <summary>
    /// Soft-deletes a communication record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="communicationId">Communication identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Communication deleted successfully.</response>
    /// <response code="404">Communication not found.</response>
    [HttpDelete("{communicationId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid communicationId)
        => HandleAction(await communicationService.DeleteCommunicationAsync(projectId, communicationId));

    /// <summary>
    /// Adds an attachment to a communication record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="communicationId">Communication identifier.</param>
    /// <param name="request">Attachment details.</param>
    /// <returns>The created communication attachment.</returns>
    /// <response code="200">Attachment added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Communication not found.</response>
    [HttpPost("{communicationId:guid}/attachments")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Attachment(Guid projectId, Guid communicationId, [FromBody] PmUpsertRequest request)
        => HandleResult(await communicationService.AddAttachmentAsync(projectId, communicationId, request));
}

/// <summary>
/// Daily report endpoints for field reporting, approvals, photos, and rollups.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/daily-reports")]
public class ProjectDailyReportsController(
    IDailyReportService dailyReportService,
    IFileStorageService fileStorageService,
    IFileValidationService fileValidationService,
    IDeliveryTicketOcrService deliveryTicketOcrService) : ProjectManagementControllerBase
{
    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return claim != null && Guid.TryParse(claim.Value, out var id) ? id : null;
    }

    /// <summary>
    /// Creates a new daily report for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Daily report details.</param>
    /// <returns>The created daily report.</returns>
    /// <response code="200">Daily report created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await dailyReportService.CreateDailyReportAsync(projectId, request));

    /// <summary>
    /// Gets a daily report by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <returns>The requested daily report.</returns>
    /// <response code="200">Daily report returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpGet("{dailyReportId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid dailyReportId)
        => HandleResult(await dailyReportService.GetDailyReportAsync(projectId, dailyReportId));

    /// <summary>
    /// Lists daily reports for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of daily reports.</returns>
    /// <response code="200">Daily reports returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await dailyReportService.ListDailyReportsAsync(projectId, query));

    /// <summary>
    /// Updates a daily report.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <param name="request">Updated daily report values.</param>
    /// <returns>The updated daily report.</returns>
    /// <response code="200">Daily report updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpPut("{dailyReportId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid dailyReportId, [FromBody] PmUpsertRequest request)
        => HandleResult(await dailyReportService.UpdateDailyReportAsync(projectId, dailyReportId, request));

    /// <summary>
    /// Submits a daily report for review.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <returns>The submission result.</returns>
    /// <response code="200">Daily report submitted successfully.</response>
    /// <response code="400">Invalid state transition.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpPost("{dailyReportId:guid}/submit")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(Guid projectId, Guid dailyReportId)
        => HandleResult(await dailyReportService.SubmitDailyReportAsync(projectId, dailyReportId));

    /// <summary>
    /// Approves a submitted daily report.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <returns>The approval result.</returns>
    /// <response code="200">Daily report approved successfully.</response>
    /// <response code="400">Invalid state transition.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpPost("{dailyReportId:guid}/approve")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(Guid projectId, Guid dailyReportId)
        => HandleResult(await dailyReportService.ApproveDailyReportAsync(projectId, dailyReportId));

    /// <summary>
    /// Locks an approved daily report (final archival state).
    /// </summary>
    [HttpPost("{dailyReportId:guid}/lock")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Lock(Guid projectId, Guid dailyReportId)
        => HandleResult(await dailyReportService.LockDailyReportAsync(projectId, dailyReportId));

    /// <summary>
    /// Soft-deletes a draft daily report.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Daily report deleted successfully.</response>
    /// <response code="400">Report cannot be deleted in its current status.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpDelete("{dailyReportId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid dailyReportId)
        => HandleAction(await dailyReportService.DeleteDailyReportAsync(projectId, dailyReportId));

    /// <summary>
    /// Adds a photo record to a daily report.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <param name="request">Photo metadata.</param>
    /// <returns>The created photo record.</returns>
    /// <response code="200">Photo added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpPost("{dailyReportId:guid}/photos")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddPhoto(Guid projectId, Guid dailyReportId, [FromBody] PmUpsertRequest request)
        => HandleResult(await dailyReportService.AddPhotoAsync(projectId, dailyReportId, request));

    /// <summary>
    /// Uploads a photo file and attaches it to a daily report.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <param name="file">The photo file to upload.</param>
    /// <param name="caption">Optional photo caption.</param>
    /// <param name="latitude">Optional GPS latitude.</param>
    /// <param name="longitude">Optional GPS longitude.</param>
    /// <returns>The created photo record.</returns>
    /// <response code="200">Photo uploaded and attached successfully.</response>
    /// <response code="400">Validation failed or file is invalid.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpPost("{dailyReportId:guid}/photos/upload")]
    [RequestSizeLimit(26_214_400)] // 25 MB
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadPhoto(
        Guid projectId, Guid dailyReportId,
        IFormFile file,
        [FromForm] string? caption = null,
        [FromForm] decimal? latitude = null,
        [FromForm] decimal? longitude = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        if (file.Length == 0)
            return BadRequest(new { error = "File is empty" });

        var validation = fileValidationService.ValidateFile(file.FileName, file.ContentType, file.Length);
        if (!validation.IsSuccess)
            return BadRequest(new { error = validation.Error, code = validation.ErrorCode });

        await using var stream = file.OpenReadStream();
        var uploadCommand = new UploadFileCommand(
            file.FileName,
            file.ContentType,
            file.Length,
            stream,
            userId.Value,
            "DailyReportPhoto",
            dailyReportId
        );

        var uploadResult = await fileStorageService.UploadAsync(uploadCommand);
        if (!uploadResult.IsSuccess)
            return BadRequest(new { error = uploadResult.Error, code = uploadResult.ErrorCode });

        var photoData = new Dictionary<string, object?>
        {
            ["DocumentId"] = uploadResult.Value!.Id,
            ["DailyReportId"] = dailyReportId,
            ["TakenByUserId"] = userId.Value,
            ["TakenAt"] = DateTime.UtcNow
        };
        if (caption != null) photoData["Caption"] = caption;
        if (latitude.HasValue) photoData["Latitude"] = latitude.Value;
        if (longitude.HasValue) photoData["Longitude"] = longitude.Value;

        var request = new PmUpsertRequest(Data: photoData);
        return HandleResult(await dailyReportService.AddPhotoAsync(projectId, dailyReportId, request));
    }

    /// <summary>
    /// Lists photos for a daily report.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of photos.</returns>
    /// <response code="200">Photos returned successfully.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpGet("{dailyReportId:guid}/photos/list")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListPhotos(Guid projectId, Guid dailyReportId, [FromQuery] PmListQuery query)
        => HandleResult(await dailyReportService.ListPhotosAsync(projectId, dailyReportId, query));

    /// <summary>
    /// Deletes a photo from a daily report.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <param name="photoId">Photo identifier.</param>
    /// <returns>No content on success.</returns>
    /// <response code="204">Photo deleted successfully.</response>
    /// <response code="404">Photo or daily report not found.</response>
    [HttpDelete("{dailyReportId:guid}/photos/{photoId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePhoto(Guid projectId, Guid dailyReportId, Guid photoId)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var deleteResult = await dailyReportService.DeletePhotoAsync(projectId, dailyReportId, photoId);
        if (!deleteResult.IsSuccess)
            return deleteResult.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = deleteResult.Error, code = "NOT_FOUND" })
                : BadRequest(new { error = deleteResult.Error, code = deleteResult.ErrorCode });

        // Also delete the file from storage (best-effort, photo record is already soft-deleted)
        // We don't fail if file deletion fails since the DB record is already removed
        return NoContent();
    }

    /// <summary>
    /// Runs a rollup operation for a daily report.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <param name="request">Rollup options.</param>
    /// <returns>The rollup result.</returns>
    /// <response code="200">Rollup completed successfully.</response>
    /// <response code="400">Invalid rollup request.</response>
    /// <response code="404">Daily report not found.</response>
    [HttpPost("{dailyReportId:guid}/rollup")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Rollup(Guid projectId, Guid dailyReportId, [FromBody] PmUpsertRequest request)
        => HandleResult(await dailyReportService.RollupDailyReportAsync(projectId, dailyReportId, request));

    /// <summary>
    /// Fetches weather for a daily report using the project's lat/lon (read-only).
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <returns>Weather data for the report date and location.</returns>
    /// <response code="200">Weather data returned.</response>
    /// <response code="400">Project has no coordinates or weather fetch failed.</response>
    /// <response code="404">Project or daily report not found.</response>
    [HttpGet("{dailyReportId:guid}/weather")]
    [ProducesResponseType(typeof(WeatherData), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWeather(Guid projectId, Guid dailyReportId)
        => HandleResult(await dailyReportService.FetchWeatherForReportAsync(projectId, dailyReportId, patch: false));

    /// <summary>
    /// Fetches weather and patches the daily report's weather fields.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="dailyReportId">Daily report identifier.</param>
    /// <returns>Weather data that was written to the report.</returns>
    /// <response code="200">Weather data fetched and saved to report.</response>
    /// <response code="400">Project has no coordinates or weather fetch failed.</response>
    /// <response code="404">Project or daily report not found.</response>
    [HttpPost("{dailyReportId:guid}/weather")]
    [ProducesResponseType(typeof(WeatherData), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PatchWeather(Guid projectId, Guid dailyReportId)
        => HandleResult(await dailyReportService.FetchWeatherForReportAsync(projectId, dailyReportId, patch: true));

    // ── Delivery ticket OCR ─────────────────────────────────────────

    /// <summary>
    /// Uploads a delivery ticket photo and extracts data via OCR (PO number, vendor, materials, quantities).
    /// </summary>
    private static readonly HashSet<string> OcrSupportedImageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif"
    };

    [HttpPost("{dailyReportId:guid}/deliveries/ocr")]
    [RequestSizeLimit(10_485_760)] // 10 MB
    [ProducesResponseType(typeof(DeliveryTicketOcrResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ExtractDeliveryTicket(
        Guid projectId, Guid dailyReportId,
        IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "File is empty." });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { error = "File exceeds 10 MB limit." });

        if (!OcrSupportedImageTypes.Contains(file.ContentType))
            return BadRequest(new { error = $"Unsupported file type for OCR: {file.ContentType}. Upload JPEG, PNG, WEBP, or GIF images.", code = "VALIDATION_ERROR" });

        var validation = fileValidationService.ValidateFile(file.FileName, file.ContentType, file.Length);
        if (!validation.IsSuccess)
            return BadRequest(new { error = validation.Error, code = validation.ErrorCode });

        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        // Read file content into memory (needed for both storage and OCR)
        byte[] content;
        await using (var readStream = file.OpenReadStream())
        {
            using var ms = new MemoryStream();
            await readStream.CopyToAsync(ms, ct);
            content = ms.ToArray();
        }

        // Store the photo via file storage
        using var uploadStream = new MemoryStream(content);
        var uploadCommand = new UploadFileCommand(
            file.FileName,
            file.ContentType,
            file.Length,
            uploadStream,
            userId.Value,
            "DeliveryTicket",
            dailyReportId
        );

        var uploadResult = await fileStorageService.UploadAsync(uploadCommand, ct);
        if (!uploadResult.IsSuccess)
            return BadRequest(new { error = uploadResult.Error, code = uploadResult.ErrorCode });

        var result = await deliveryTicketOcrService.ExtractDeliveryTicketAsync(
            content, file.ContentType, file.FileName, projectId, ct);

        return Ok(new DeliveryTicketOcrResponse(result, uploadResult.Value!.Id));
    }

    /// <summary>
    /// Creates a delivery record on a daily report (from OCR results or manual entry).
    /// </summary>
    [HttpPost("{dailyReportId:guid}/deliveries")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateDelivery(
        Guid projectId, Guid dailyReportId,
        [FromBody] CreateDeliveryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.VendorName))
            return BadRequest(new { error = "VendorName is required.", code = "VALIDATION_ERROR" });

        if (string.IsNullOrWhiteSpace(request.MaterialDescription))
            return BadRequest(new { error = "MaterialDescription is required.", code = "VALIDATION_ERROR" });

        var deliveryData = new Dictionary<string, object?>
        {
            ["DailyReportId"] = dailyReportId,
            ["VendorName"] = request.VendorName,
            ["MaterialDescription"] = request.MaterialDescription,
            ["Quantity"] = request.Quantity,
            ["Unit"] = request.Unit ?? "EA"
        };

        if (request.RelatedCostCodeId.HasValue)
            deliveryData["RelatedCostCodeId"] = request.RelatedCostCodeId.Value;

        var upsertRequest = new PmUpsertRequest(Data: deliveryData);
        return HandleResult(await dailyReportService.AddDeliveryAsync(projectId, dailyReportId, upsertRequest));
    }
}

/// <summary>
/// Progress tracking and earned value endpoints for construction execution.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class ProjectProgressController(IProgressService progressService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a progress entry for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Progress entry details.</param>
    /// <returns>The created progress entry.</returns>
    /// <response code="200">Progress entry created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("progress-entries")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await progressService.CreateProgressEntryAsync(projectId, request));

    /// <summary>
    /// Gets a progress entry by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="progressEntryId">Progress entry identifier.</param>
    /// <returns>The requested progress entry.</returns>
    /// <response code="200">Progress entry returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Progress entry not found.</response>
    [HttpGet("progress-entries/{progressEntryId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid progressEntryId)
        => HandleResult(await progressService.GetProgressEntryAsync(projectId, progressEntryId));

    /// <summary>
    /// Lists progress entries for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of progress entries.</returns>
    /// <response code="200">Progress entries returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("progress-entries")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await progressService.ListProgressEntriesAsync(projectId, query));

    /// <summary>
    /// Updates a progress entry.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="progressEntryId">Progress entry identifier.</param>
    /// <param name="request">Updated progress values.</param>
    /// <returns>The updated progress entry.</returns>
    /// <response code="200">Progress entry updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Progress entry not found.</response>
    [HttpPut("progress-entries/{progressEntryId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid progressEntryId, [FromBody] PmUpsertRequest request)
        => HandleResult(await progressService.UpdateProgressEntryAsync(projectId, progressEntryId, request));

    /// <summary>
    /// Approves a progress entry.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="progressEntryId">Progress entry identifier.</param>
    /// <returns>The approval result.</returns>
    /// <response code="200">Progress entry approved successfully.</response>
    /// <response code="400">Invalid state transition.</response>
    /// <response code="404">Progress entry not found.</response>
    [HttpPost("progress-entries/{progressEntryId:guid}/approve")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(Guid projectId, Guid progressEntryId)
        => HandleResult(await progressService.ApproveProgressEntryAsync(projectId, progressEntryId));

    /// <summary>
    /// Links a time entry to a progress entry.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="progressEntryId">Progress entry identifier.</param>
    /// <param name="request">Time link details.</param>
    /// <returns>The link operation result.</returns>
    /// <response code="200">Time entry linked successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Progress entry not found.</response>
    [HttpPost("progress-entries/{progressEntryId:guid}/time-links")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TimeLinks(Guid projectId, Guid progressEntryId, [FromBody] PmUpsertRequest request)
        => HandleResult(await progressService.LinkTimeEntryAsync(projectId, progressEntryId, request));

    /// <summary>
    /// Lists earned value snapshots for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of earned value snapshots.</returns>
    /// <response code="200">Snapshots returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("earned-value/snapshots")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> EarnedValue(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await progressService.ListEarnedValueSnapshotsAsync(projectId, query));

    /// <summary>
    /// Lists S-curve records for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of S-curve records.</returns>
    /// <response code="200">S-curve data returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("s-curve")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SCurve(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await progressService.ListSCurveAsync(projectId, query));
}

/// <summary>
/// Projection endpoints for monthly forecasting and approval workflow.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class ProjectProjectionsController(IProjectionService projectionService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a monthly projection for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Projection details.</param>
    /// <returns>The created projection record.</returns>
    /// <response code="200">Projection created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("monthly-projections")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await projectionService.CreateMonthlyProjectionAsync(projectId, request));

    /// <summary>
    /// Gets a monthly projection by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="projectionId">Projection identifier.</param>
    /// <returns>The requested projection.</returns>
    /// <response code="200">Projection returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Projection not found.</response>
    [HttpGet("monthly-projections/{projectionId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid projectionId)
        => HandleResult(await projectionService.GetMonthlyProjectionAsync(projectId, projectionId));

    /// <summary>
    /// Lists monthly projections for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of monthly projections.</returns>
    /// <response code="200">Projections returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("monthly-projections")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await projectionService.ListMonthlyProjectionsAsync(projectId, query));

    /// <summary>
    /// Updates a monthly projection.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="projectionId">Projection identifier.</param>
    /// <param name="request">Updated projection values.</param>
    /// <returns>The updated projection.</returns>
    /// <response code="200">Projection updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Projection not found.</response>
    [HttpPut("monthly-projections/{projectionId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid projectionId, [FromBody] PmUpsertRequest request)
        => HandleResult(await projectionService.UpdateMonthlyProjectionAsync(projectId, projectionId, request));

    /// <summary>
    /// Soft-deletes a draft monthly projection.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="projectionId">Projection identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Projection deleted successfully.</response>
    /// <response code="400">Projection cannot be deleted in its current status.</response>
    /// <response code="404">Projection not found.</response>
    [HttpDelete("monthly-projections/{projectionId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid projectionId)
        => HandleAction(await projectionService.DeleteMonthlyProjectionAsync(projectId, projectionId));

    /// <summary>
    /// Submits a monthly projection for review.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="projectionId">Projection identifier.</param>
    /// <returns>The submission result.</returns>
    /// <response code="200">Projection submitted successfully.</response>
    /// <response code="400">Invalid state transition.</response>
    /// <response code="404">Projection not found.</response>
    [HttpPost("monthly-projections/{projectionId:guid}/submit")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(Guid projectId, Guid projectionId)
        => HandleResult(await projectionService.SubmitMonthlyProjectionAsync(projectId, projectionId));

    /// <summary>
    /// Approves a submitted monthly projection.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="projectionId">Projection identifier.</param>
    /// <returns>The approval result.</returns>
    /// <response code="200">Projection approved successfully.</response>
    /// <response code="400">Invalid state transition.</response>
    /// <response code="404">Projection not found.</response>
    [HttpPost("monthly-projections/{projectionId:guid}/approve")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(Guid projectId, Guid projectionId)
        => HandleResult(await projectionService.ApproveMonthlyProjectionAsync(projectId, projectionId));

    /// <summary>
    /// Returns projection variance analysis rows for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of variance rows.</returns>
    /// <response code="200">Variance analysis returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("projection-variance")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Variance(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await projectionService.ListMonthlyProjectionsAsync(projectId, query));
}

/// <summary>
/// Meeting endpoints for series, meeting records, agenda, minutes, and action items.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class ProjectMeetingsController(IMeetingService meetingService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a recurring meeting series.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Meeting series details.</param>
    /// <returns>The created meeting series record.</returns>
    /// <response code="200">Meeting series created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("meeting-series")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateSeries(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await meetingService.CreateMeetingSeriesAsync(projectId, request));

    /// <summary>
    /// Lists meeting series for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of meeting series.</returns>
    /// <response code="200">Meeting series returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("meeting-series")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListSeries(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await meetingService.ListMeetingSeriesAsync(projectId, query));

    /// <summary>
    /// Creates a meeting record for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Meeting details.</param>
    /// <returns>The created meeting record.</returns>
    /// <response code="200">Meeting created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("meetings")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateMeeting(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await meetingService.CreateMeetingAsync(projectId, request));

    /// <summary>
    /// Gets a meeting by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="meetingId">Meeting identifier.</param>
    /// <returns>The requested meeting record.</returns>
    /// <response code="200">Meeting returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Meeting not found.</response>
    [HttpGet("meetings/{meetingId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMeeting(Guid projectId, Guid meetingId)
        => HandleResult(await meetingService.GetMeetingAsync(projectId, meetingId));

    /// <summary>
    /// Lists meetings for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of meetings.</returns>
    /// <response code="200">Meetings returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("meetings")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListMeetings(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await meetingService.ListMeetingsAsync(projectId, query));

    /// <summary>
    /// Updates a meeting record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="meetingId">Meeting identifier.</param>
    /// <param name="request">Updated meeting values.</param>
    /// <returns>The updated meeting record.</returns>
    /// <response code="200">Meeting updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Meeting not found.</response>
    [HttpPut("meetings/{meetingId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMeeting(Guid projectId, Guid meetingId, [FromBody] PmUpsertRequest request)
        => HandleResult(await meetingService.UpdateMeetingAsync(projectId, meetingId, request));

    /// <summary>
    /// Soft-deletes a meeting that is not completed.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="meetingId">Meeting identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Meeting deleted successfully.</response>
    /// <response code="400">Meeting cannot be deleted in its current status.</response>
    /// <response code="404">Meeting not found.</response>
    [HttpDelete("meetings/{meetingId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteMeeting(Guid projectId, Guid meetingId)
        => HandleAction(await meetingService.DeleteMeetingAsync(projectId, meetingId));

    /// <summary>
    /// Adds an agenda item to a meeting.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="meetingId">Meeting identifier.</param>
    /// <param name="request">Agenda item details.</param>
    /// <returns>The created agenda item record.</returns>
    /// <response code="200">Agenda item added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Meeting not found.</response>
    [HttpPost("meetings/{meetingId:guid}/agenda-items")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Agenda(Guid projectId, Guid meetingId, [FromBody] PmUpsertRequest request)
        => HandleResult(await meetingService.AddAgendaItemAsync(projectId, meetingId, request));

    /// <summary>
    /// Adds meeting minutes to a meeting record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="meetingId">Meeting identifier.</param>
    /// <param name="request">Minutes details.</param>
    /// <returns>The created minutes record.</returns>
    /// <response code="200">Minutes added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Meeting not found.</response>
    [HttpPost("meetings/{meetingId:guid}/minutes")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Minutes(Guid projectId, Guid meetingId, [FromBody] PmUpsertRequest request)
        => HandleResult(await meetingService.AddMinutesAsync(projectId, meetingId, request));

    /// <summary>
    /// Adds an action item to a meeting.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="meetingId">Meeting identifier.</param>
    /// <param name="request">Action item details.</param>
    /// <returns>The created action item record.</returns>
    /// <response code="200">Action item added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Meeting not found.</response>
    [HttpPost("meetings/{meetingId:guid}/action-items")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ActionItem(Guid projectId, Guid meetingId, [FromBody] PmUpsertRequest request)
        => HandleResult(await meetingService.AddActionItemAsync(projectId, meetingId, request));

    /// <summary>
    /// Updates a meeting action item.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="meetingId">Meeting identifier.</param>
    /// <param name="actionItemId">Action item identifier.</param>
    /// <param name="request">Updated action item values.</param>
    /// <returns>The updated action item record.</returns>
    /// <response code="200">Action item updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Action item not found.</response>
    [HttpPut("meetings/{meetingId:guid}/action-items/{actionItemId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateActionItem(Guid projectId, Guid meetingId, Guid actionItemId, [FromBody] PmUpsertRequest request)
        => HandleResult(await meetingService.UpdateActionItemAsync(projectId, meetingId, actionItemId, request));
}

/// <summary>
/// Document template and generation endpoints for project correspondence output.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class ProjectDocumentGenerationController(IDocumentGenerationService docService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a document template for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Template details.</param>
    /// <returns>The created template record.</returns>
    /// <response code="200">Template created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost("document-templates")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateTemplate(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await docService.CreateTemplateAsync(projectId, request));

    /// <summary>
    /// Lists document templates for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of document templates.</returns>
    /// <response code="200">Templates returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("document-templates")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListTemplates(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await docService.ListTemplatesAsync(projectId, query));

    /// <summary>
    /// Generates a project document from template and payload data.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Generation request details.</param>
    /// <returns>The generated document record.</returns>
    /// <response code="200">Document generated successfully.</response>
    /// <response code="400">Generation request invalid.</response>
    /// <response code="404">Template or project not found.</response>
    [HttpPost("documents/generate")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Generate(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await docService.GenerateDocumentAsync(projectId, request));

    /// <summary>
    /// Gets a generated document by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="generatedDocumentId">Generated document identifier.</param>
    /// <returns>The requested generated document record.</returns>
    /// <response code="200">Generated document returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Generated document not found.</response>
    [HttpGet("generated-documents/{generatedDocumentId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGenerated(Guid projectId, Guid generatedDocumentId)
        => HandleResult(await docService.GetGeneratedDocumentAsync(projectId, generatedDocumentId));

    /// <summary>
    /// Lists generated documents for the project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of generated documents.</returns>
    /// <response code="200">Generated documents returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet("generated-documents")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListGenerated(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await docService.ListGeneratedDocumentsAsync(projectId, query));

    /// <summary>
    /// Creates a company letterhead used by project document generation.
    /// </summary>
    /// <param name="companyId">Company identifier.</param>
    /// <param name="request">Letterhead details.</param>
    /// <returns>The created letterhead record.</returns>
    /// <response code="200">Letterhead created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Company not found.</response>
    [HttpPost("/api/companies/{companyId:guid}/letterheads")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateLetterhead(Guid companyId, [FromBody] PmUpsertRequest request)
        => HandleResult(await docService.CreateLetterheadAsync(companyId, request));

    /// <summary>
    /// Lists company letterheads available for document generation.
    /// </summary>
    /// <param name="companyId">Company identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of letterhead records.</returns>
    /// <response code="200">Letterheads returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Company not found.</response>
    [HttpGet("/api/companies/{companyId:guid}/letterheads")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListLetterheads(Guid companyId, [FromQuery] PmListQuery query)
        => HandleResult(await docService.ListLetterheadsAsync(companyId, query));
}

/// <summary>
/// Task endpoints for project action tracking and assignment management.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/tasks")]
public class ProjectTasksController(ITaskService taskService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a new project task.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Task details.</param>
    /// <returns>The created task record.</returns>
    /// <response code="200">Task created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await taskService.CreateTaskAsync(projectId, request));

    /// <summary>
    /// Gets a project task by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="taskId">Task identifier.</param>
    /// <returns>The requested task.</returns>
    /// <response code="200">Task returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Task not found.</response>
    [HttpGet("{taskId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid taskId)
        => HandleResult(await taskService.GetTaskAsync(projectId, taskId));

    /// <summary>
    /// Lists tasks for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of tasks.</returns>
    /// <response code="200">Tasks returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await taskService.ListTasksAsync(projectId, query));

    /// <summary>
    /// Updates an existing project task.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="taskId">Task identifier.</param>
    /// <param name="request">Updated task values.</param>
    /// <returns>The updated task record.</returns>
    /// <response code="200">Task updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Task not found.</response>
    [HttpPut("{taskId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid taskId, [FromBody] PmUpsertRequest request)
        => HandleResult(await taskService.UpdateTaskAsync(projectId, taskId, request));

    /// <summary>
    /// Soft-deletes a project task.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="taskId">Task identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Task deleted successfully.</response>
    /// <response code="404">Task not found.</response>
    [HttpDelete("{taskId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid taskId)
        => HandleAction(await taskService.DeleteTaskAsync(projectId, taskId));

    /// <summary>
    /// Adds a comment to a project task.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="taskId">Task identifier.</param>
    /// <param name="request">Comment details.</param>
    /// <returns>The created task comment record.</returns>
    /// <response code="200">Comment added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Task not found.</response>
    [HttpPost("{taskId:guid}/comments")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Comment(Guid projectId, Guid taskId, [FromBody] PmUpsertRequest request)
        => HandleResult(await taskService.AddTaskCommentAsync(projectId, taskId, request));
}

/// <summary>
/// Narrative endpoints for monthly project reporting workflow.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/narratives")]
public class ProjectNarrativesController(INarrativeService narrativeService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a project narrative entry.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Narrative details.</param>
    /// <returns>The created narrative record.</returns>
    /// <response code="200">Narrative created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await narrativeService.CreateNarrativeAsync(projectId, request));

    /// <summary>
    /// Gets a project narrative by ID.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="narrativeId">Narrative identifier.</param>
    /// <returns>The requested narrative.</returns>
    /// <response code="200">Narrative returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Narrative not found.</response>
    [HttpGet("{narrativeId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid narrativeId)
        => HandleResult(await narrativeService.GetNarrativeAsync(projectId, narrativeId));

    /// <summary>
    /// Lists narratives for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of narratives.</returns>
    /// <response code="200">Narratives returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await narrativeService.ListNarrativesAsync(projectId, query));

    /// <summary>
    /// Updates a narrative record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="narrativeId">Narrative identifier.</param>
    /// <param name="request">Updated narrative values.</param>
    /// <returns>The updated narrative record.</returns>
    /// <response code="200">Narrative updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Narrative not found.</response>
    [HttpPut("{narrativeId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid narrativeId, [FromBody] PmUpsertRequest request)
        => HandleResult(await narrativeService.UpdateNarrativeAsync(projectId, narrativeId, request));

    /// <summary>
    /// Soft-deletes a narrative that is not approved or published.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="narrativeId">Narrative identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Narrative deleted successfully.</response>
    /// <response code="400">Narrative cannot be deleted in its current status.</response>
    /// <response code="404">Narrative not found.</response>
    [HttpDelete("{narrativeId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid narrativeId)
        => HandleAction(await narrativeService.DeleteNarrativeAsync(projectId, narrativeId));

    /// <summary>
    /// Submits a narrative for review.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="narrativeId">Narrative identifier.</param>
    /// <returns>The submission result.</returns>
    /// <response code="200">Narrative submitted successfully.</response>
    /// <response code="400">Invalid state transition.</response>
    /// <response code="404">Narrative not found.</response>
    [HttpPost("{narrativeId:guid}/submit")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(Guid projectId, Guid narrativeId)
        => HandleResult(await narrativeService.SubmitNarrativeAsync(projectId, narrativeId));

    /// <summary>
    /// Publishes a narrative.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="narrativeId">Narrative identifier.</param>
    /// <returns>The publish result.</returns>
    /// <response code="200">Narrative published successfully.</response>
    /// <response code="400">Invalid state transition.</response>
    /// <response code="404">Narrative not found.</response>
    [HttpPost("{narrativeId:guid}/publish")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Publish(Guid projectId, Guid narrativeId)
        => HandleResult(await narrativeService.PublishNarrativeAsync(projectId, narrativeId));

    /// <summary>
    /// Lists revision history for a narrative.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="narrativeId">Narrative identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of narrative revisions.</returns>
    /// <response code="200">Narrative revisions returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Narrative not found.</response>
    [HttpGet("{narrativeId:guid}/revisions")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Revisions(Guid projectId, Guid narrativeId, [FromQuery] PmListQuery query)
        => HandleResult(await narrativeService.ListNarrativeRevisionsAsync(projectId, narrativeId, query));
}

/// <summary>
/// Dashboard endpoints for authenticated users to view their PM work queues.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/project-management")]
public class ProjectManagementDashboardController(ITaskService taskService, IMeetingService meetingService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Lists tasks assigned to the authenticated user.
    /// </summary>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of tasks assigned to the current user.</returns>
    /// <response code="200">Assigned tasks returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Related records not found.</response>
    /// <response code="401">User claim data is missing or invalid.</response>
    [HttpGet("tasks/my")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> MyTasks([FromQuery] PmListQuery query)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { error = "User ID was not found in token claims.", code = "UNAUTHORIZED" });

        return HandleResult(await taskService.ListMyTasksAsync(query, userId));
    }

    /// <summary>
    /// Lists meeting action items assigned to the authenticated user.
    /// </summary>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of action items assigned to the current user.</returns>
    /// <response code="200">Assigned action items returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Related records not found.</response>
    /// <response code="401">User claim data is missing or invalid.</response>
    [HttpGet("action-items/my")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> MyActionItems([FromQuery] PmListQuery query)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { error = "User ID was not found in token claims.", code = "UNAUTHORIZED" });

        return HandleResult(await meetingService.ListMyActionItemsAsync(query, userId));
    }
}

/// <summary>
/// RFI enhancement endpoints for attachments, distribution, and cost impact links.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/rfis/{rfiId:guid}")]
public class ProjectRfiEnhancementsController(IPlansSpecsService plansSpecsService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Adds an attachment to the specified RFI.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="rfiId">RFI identifier.</param>
    /// <param name="request">Attachment details.</param>
    /// <returns>The created RFI attachment record.</returns>
    /// <response code="200">Attachment added successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">RFI not found.</response>
    [HttpPost("attachments")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddAttachment(Guid projectId, Guid rfiId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.AddRfiAttachmentAsync(projectId, rfiId, request));

    /// <summary>
    /// Lists attachments for the specified RFI.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="rfiId">RFI identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of RFI attachment records.</returns>
    /// <response code="200">Attachments returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">RFI not found.</response>
    [HttpGet("attachments")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListAttachments(Guid projectId, Guid rfiId, [FromQuery] PmListQuery query)
        => HandleResult(await plansSpecsService.ListRfiAttachmentsAsync(projectId, rfiId, query));

    /// <summary>
    /// Deletes an attachment from the specified RFI.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="rfiId">RFI identifier.</param>
    /// <param name="attachmentId">Attachment identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Attachment deleted successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Attachment not found.</response>
    [HttpDelete("attachments/{attachmentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAttachment(Guid projectId, Guid rfiId, Guid attachmentId)
        => HandleAction(await plansSpecsService.DeleteRfiAttachmentAsync(projectId, rfiId, attachmentId));

    /// <summary>
    /// Creates an RFI distribution recipient record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="rfiId">RFI identifier.</param>
    /// <param name="request">Distribution recipient details.</param>
    /// <returns>The created distribution recipient record.</returns>
    /// <response code="200">Distribution recipient created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">RFI not found.</response>
    [HttpPost("distribution")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateDistribution(Guid projectId, Guid rfiId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.CreateRfiDistributionAsync(projectId, rfiId, request));

    /// <summary>
    /// Lists RFI distribution recipients.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="rfiId">RFI identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of RFI distribution recipient records.</returns>
    /// <response code="200">Distribution recipients returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">RFI not found.</response>
    [HttpGet("distribution")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListDistribution(Guid projectId, Guid rfiId, [FromQuery] PmListQuery query)
        => HandleResult(await plansSpecsService.ListRfiDistributionsAsync(projectId, rfiId, query));

    /// <summary>
    /// Creates a cost impact link for the specified RFI.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="rfiId">RFI identifier.</param>
    /// <param name="request">Cost link details.</param>
    /// <returns>The created cost link record.</returns>
    /// <response code="200">Cost link created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">RFI not found.</response>
    [HttpPost("cost-links")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateCostLink(Guid projectId, Guid rfiId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.CreateRfiCostLinkAsync(projectId, rfiId, request));

    /// <summary>
    /// Updates an RFI cost impact link.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="rfiId">RFI identifier.</param>
    /// <param name="linkId">Cost link identifier.</param>
    /// <param name="request">Updated cost link values.</param>
    /// <returns>The updated cost link record.</returns>
    /// <response code="200">Cost link updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Cost link not found.</response>
    [HttpPut("cost-links/{linkId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCostLink(Guid projectId, Guid rfiId, Guid linkId, [FromBody] PmUpsertRequest request)
        => HandleResult(await plansSpecsService.UpdateRfiCostLinkAsync(projectId, rfiId, linkId, request));

    /// <summary>
    /// Lists cost impact links for the specified RFI.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="rfiId">RFI identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of RFI cost link records.</returns>
    /// <response code="200">Cost links returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">RFI not found.</response>
    [HttpGet("cost-links")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListCostLinks(Guid projectId, Guid rfiId, [FromQuery] PmListQuery query)
        => HandleResult(await plansSpecsService.ListRfiCostLinksAsync(projectId, rfiId, query));
}

/// <summary>
/// Project document management endpoints for uploading, listing, updating, and deleting documents.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/documents")]
public class ProjectDocumentsController(IDocumentService documentService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a new document record for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="request">Document details.</param>
    /// <returns>The created document record.</returns>
    /// <response code="200">Document created successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Project not found.</response>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await documentService.CreateDocumentAsync(projectId, request));

    /// <summary>
    /// Gets a document by ID for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="documentId">Document identifier.</param>
    /// <returns>The requested document.</returns>
    /// <response code="200">Document returned successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Document not found.</response>
    [HttpGet("{documentId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid documentId)
        => HandleResult(await documentService.GetDocumentAsync(projectId, documentId));

    /// <summary>
    /// Lists documents for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="query">Paging and filtering options.</param>
    /// <returns>A paged list of documents.</returns>
    /// <response code="200">Documents returned successfully.</response>
    /// <response code="400">Invalid query parameters.</response>
    /// <response code="404">Project not found.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await documentService.ListDocumentsAsync(projectId, query));

    /// <summary>
    /// Updates an existing document record.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="documentId">Document identifier.</param>
    /// <param name="request">Updated document values.</param>
    /// <returns>The updated document.</returns>
    /// <response code="200">Document updated successfully.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Document not found.</response>
    [HttpPut("{documentId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid documentId, [FromBody] PmUpsertRequest request)
        => HandleResult(await documentService.UpdateDocumentAsync(projectId, documentId, request));

    /// <summary>
    /// Soft-deletes a document for the specified project.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="documentId">Document identifier.</param>
    /// <returns>No content when deletion succeeds.</returns>
    /// <response code="204">Document deleted successfully.</response>
    /// <response code="400">Invalid request.</response>
    /// <response code="404">Document not found.</response>
    [HttpDelete("{documentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid documentId)
        => HandleAction(await documentService.DeleteDocumentAsync(projectId, documentId));
}

/// <summary>
/// Punch list management endpoints for project close-out deficiency tracking.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/punch-list")]
[Tags("Project Management")]
public class PunchListController(
    IPunchListService punchListService,
    Pitbull.Api.Services.IPdfReportService pdfReportService,
    IFileStorageService fileStorageService,
    IFileValidationService fileValidationService) : ProjectManagementControllerBase
{
    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return claim != null && Guid.TryParse(claim.Value, out var id) ? id : null;
    }
    /// <summary>
    /// Creates a new punch list item for the specified project.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await punchListService.CreatePunchListItemAsync(projectId, request));

    /// <summary>
    /// Gets a punch list item by ID.
    /// </summary>
    [HttpGet("{itemId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid itemId)
        => HandleResult(await punchListService.GetPunchListItemAsync(projectId, itemId));

    /// <summary>
    /// Lists punch list items for the specified project.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await punchListService.ListPunchListItemsAsync(projectId, query));

    /// <summary>
    /// Updates a punch list item. Enforces status workflow transitions.
    /// </summary>
    [HttpPut("{itemId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid itemId, [FromBody] PmUpsertRequest request)
        => HandleResult(await punchListService.UpdatePunchListItemAsync(projectId, itemId, request));

    /// <summary>
    /// Soft-deletes a punch list item. Closed items cannot be deleted.
    /// </summary>
    [HttpDelete("{itemId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid itemId)
        => HandleAction(await punchListService.DeletePunchListItemAsync(projectId, itemId));

    /// <summary>
    /// Closes a punch list item that is in ReadyForInspection status.
    /// </summary>
    [HttpPost("{itemId:guid}/close")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Close(Guid projectId, Guid itemId)
        => HandleResult(await punchListService.ClosePunchListItemAsync(projectId, itemId));

    /// <summary>
    /// Adds a photo to a punch list item.
    /// </summary>
    [HttpPost("{itemId:guid}/photos")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddPhoto(Guid projectId, Guid itemId, [FromBody] PmUpsertRequest request)
        => HandleResult(await punchListService.AddPhotoAsync(projectId, itemId, request));

    /// <summary>
    /// Uploads a photo file and attaches it to a punch list item.
    /// </summary>
    /// <param name="projectId">Project identifier.</param>
    /// <param name="itemId">Punch list item identifier.</param>
    /// <param name="file">The photo file to upload.</param>
    /// <param name="caption">Optional photo caption.</param>
    /// <param name="latitude">Optional GPS latitude.</param>
    /// <param name="longitude">Optional GPS longitude.</param>
    /// <returns>The created photo record.</returns>
    /// <response code="200">Photo uploaded and attached successfully.</response>
    /// <response code="400">Validation failed or file is invalid.</response>
    /// <response code="404">Punch list item not found.</response>
    [HttpPost("{itemId:guid}/photos/upload")]
    [RequestSizeLimit(26_214_400)] // 25 MB
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadPhoto(
        Guid projectId, Guid itemId,
        IFormFile file,
        [FromForm] string? caption = null,
        [FromForm] decimal? latitude = null,
        [FromForm] decimal? longitude = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        if (file.Length == 0)
            return BadRequest(new { error = "File is empty" });

        var validation = fileValidationService.ValidateFile(file.FileName, file.ContentType, file.Length);
        if (!validation.IsSuccess)
            return BadRequest(new { error = validation.Error, code = validation.ErrorCode });

        await using var stream = file.OpenReadStream();
        var uploadCommand = new UploadFileCommand(
            file.FileName,
            file.ContentType,
            file.Length,
            stream,
            userId.Value,
            "PunchListPhoto",
            itemId
        );

        var uploadResult = await fileStorageService.UploadAsync(uploadCommand);
        if (!uploadResult.IsSuccess)
            return BadRequest(new { error = uploadResult.Error, code = uploadResult.ErrorCode });

        var photoData = new Dictionary<string, object?>
        {
            ["DocumentId"] = uploadResult.Value!.Id,
            ["PunchListItemId"] = itemId,
            ["TakenByUserId"] = userId.Value,
            ["TakenAt"] = DateTime.UtcNow
        };
        if (caption != null) photoData["Caption"] = caption;
        if (latitude.HasValue) photoData["Latitude"] = latitude.Value;
        if (longitude.HasValue) photoData["Longitude"] = longitude.Value;

        var request = new PmUpsertRequest(Data: photoData);
        return HandleResult(await punchListService.AddPhotoAsync(projectId, itemId, request));
    }

    /// <summary>
    /// Lists photos for a punch list item.
    /// </summary>
    [HttpGet("{itemId:guid}/photos")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListPhotos(Guid projectId, Guid itemId, [FromQuery] PmListQuery query)
        => HandleResult(await punchListService.ListPhotosAsync(projectId, itemId, query));

    /// <summary>
    /// Gets a summary of punch list items by status, category, and priority.
    /// </summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Summary(Guid projectId)
        => HandleResult(await punchListService.GetPunchListSummaryAsync(projectId));

    /// <summary>
    /// Exports the punch list as a PDF document.
    /// </summary>
    [HttpGet("export-pdf")]
    [Produces("application/pdf")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportPdf(Guid projectId)
    {
        var bytes = await pdfReportService.GeneratePunchListPdfAsync(projectId);
        return File(bytes, "application/pdf", $"punch-list-{DateTime.UtcNow:yyyy-MM-dd}.pdf");
    }
}

// ─── Phase 1: Progress → Schedule → Cost Foundation ─────────────────────────

/// <summary>
/// Manages CostCode ↔ ScheduleActivity mappings — the critical link that enables
/// a single field progress entry to automatically update schedule completion and
/// drive earned value calculations.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/cost-code-activity-mappings")]
[Tags("Progress → Schedule → Cost")]
public class CostCodeActivityMappingsController(ICostCodeActivityMappingService mappingService) : ProjectManagementControllerBase
{
    /// <summary>Creates a CostCode ↔ ScheduleActivity mapping for a project.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await mappingService.CreateMappingAsync(projectId, request));

    /// <summary>Updates the weight factor on a mapping.</summary>
    [HttpPut("{mappingId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid mappingId, [FromBody] PmUpsertRequest request)
        => HandleResult(await mappingService.UpdateMappingAsync(projectId, mappingId, request));

    /// <summary>Deletes a CostCode ↔ ScheduleActivity mapping.</summary>
    [HttpDelete("{mappingId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid mappingId)
        => HandleAction(await mappingService.DeleteMappingAsync(projectId, mappingId));

    /// <summary>Lists all CostCode ↔ ScheduleActivity mappings for a project.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await mappingService.ListMappingsAsync(projectId, query));
}

/// <summary>
/// Field progress entries — the single input that cascades across schedule and cost.
/// POST creates an entry, auto-resolves the schedule activity from the cost code mapping,
/// recalculates cumulative quantities, and updates ScheduleActivity.PercentComplete.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/field-progress")]
[Tags("Progress → Schedule → Cost")]
public class FieldProgressController(IFieldProgressService fieldProgressService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Creates a field progress entry. This is THE core action:
    /// one POST updates schedule percent complete and drives earned value recalculation.
    /// Required fields in Data: CostCodeId, QuantityInstalled, TotalBudgetedQuantity.
    /// Optional: ScheduleActivityId (auto-resolved if omitted), Date, UnitOfMeasure,
    /// CrewSize, HoursWorked, Notes, WeatherCondition, ReportedById.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request)
        => HandleResult(await fieldProgressService.CreateFieldProgressEntryAsync(projectId, request));

    /// <summary>Gets a specific field progress entry.</summary>
    [HttpGet("{entryId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid projectId, Guid entryId)
        => HandleResult(await fieldProgressService.GetFieldProgressEntryAsync(projectId, entryId));

    /// <summary>Lists field progress entries for a project with optional date range filtering.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await fieldProgressService.ListFieldProgressEntriesAsync(projectId, query));

    /// <summary>Updates a field progress entry and recalculates derived fields.</summary>
    [HttpPut("{entryId:guid}")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid projectId, Guid entryId, [FromBody] PmUpsertRequest request)
        => HandleResult(await fieldProgressService.UpdateFieldProgressEntryAsync(projectId, entryId, request));

    /// <summary>Soft-deletes a field progress entry and recalculates activity percent complete.</summary>
    [HttpDelete("{entryId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid projectId, Guid entryId)
        => HandleAction(await fieldProgressService.DeleteFieldProgressEntryAsync(projectId, entryId));
}

/// <summary>
/// Earned value analysis — BCWS, BCWP, ACWP, SPI, CPI, EAC, ETC, TCPI.
/// All metrics are per cost code, stored as snapshots for performance.
/// Recalculate after posting progress entries for real-time dashboard data.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/earned-value")]
[Tags("Progress → Schedule → Cost")]
public class EarnedValueController(IEarnedValueService earnedValueService) : ProjectManagementControllerBase
{
    /// <summary>
    /// Calculates and stores the earned value snapshot for a specific cost code on a given date.
    /// Computes BCWS (from schedule), BCWP (from progress entries), ACWP (from job cost actuals),
    /// and all derived indices (SPI, CPI, EAC, ETC, TCPI).
    /// </summary>
    [HttpPost("calculate")]
    [ProducesResponseType(typeof(PmEntityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Calculate(Guid projectId, [FromQuery] Guid costCodeId, [FromQuery] DateOnly date)
        => HandleResult(await earnedValueService.CalculateEarnedValueAsync(projectId, costCodeId, date));

    /// <summary>
    /// Recalculates earned value snapshots for ALL cost codes on the project for a given date.
    /// Run this after bulk progress entry imports for a consistent state.
    /// </summary>
    [HttpPost("recalculate")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Recalculate(Guid projectId, [FromQuery] DateOnly date)
        => HandleResult(await earnedValueService.RecalculateProjectEarnedValueAsync(projectId, date));

    /// <summary>
    /// Returns the project-level earned value summary aggregated across all cost codes.
    /// Includes overall SPI, CPI, EAC, VAC, and percent complete as of the specified date.
    /// </summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(PmActionResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Summary(Guid projectId, [FromQuery] DateOnly asOfDate)
        => HandleResult(await earnedValueService.GetProjectEarnedValueSummaryAsync(projectId, asOfDate));

    /// <summary>Lists stored per-cost-code earned value snapshots for a project.</summary>
    [HttpGet("snapshots")]
    [ProducesResponseType(typeof(PagedResult<PmEntityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Snapshots(Guid projectId, [FromQuery] PmListQuery query)
        => HandleResult(await earnedValueService.GetCostCodeSnapshotsAsync(projectId, query));
}

/// <summary>Zones-first digital twin spatial graph + overlays.</summary>
[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/spatial")]
public class ProjectSpatialController(ISpatialService spatialService) : ProjectManagementControllerBase
{
    /// <summary>Gets the published spatial graph or an honest no-graph payload.</summary>
    [HttpGet("graph")]
    [Authorize(Policy = "Spatial.View")]
    [ProducesResponseType(typeof(SpatialGraphResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGraph(Guid projectId)
        => HandleResult(await spatialService.GetGraphAsync(projectId));

    /// <summary>Seeds a default Site→Building→Storey→Zones tree when none exists (demo / bootstrap).</summary>
    [HttpPost("graph/ensure-seeded")]
    [Authorize(Policy = "Spatial.Manage")]
    [ProducesResponseType(typeof(SpatialGraphResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> EnsureSeeded(Guid projectId)
        => HandleResult(await spatialService.EnsureSeededGraphAsync(projectId));

    /// <summary>Zone overlay colors for a documented mode (progress|schedule|rfi).</summary>
    [HttpGet("overlays")]
    [Authorize(Policy = "Spatial.View")]
    [ProducesResponseType(typeof(SpatialOverlayResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverlays(
        Guid projectId,
        [FromQuery] string mode = "rfi",
        [FromQuery] DateTime? asOf = null,
        [FromQuery] Guid? storeyNodeId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
        => HandleResult(await spatialService.GetOverlayAsync(projectId, mode, asOf, storeyNodeId, from, to));

    /// <summary>Flat zone list for mobile pickers.</summary>
    [HttpGet("zones")]
    [Authorize(Policy = "Spatial.View")]
    [ProducesResponseType(typeof(IReadOnlyList<SpatialZoneOptionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListZones(Guid projectId)
        => HandleResult(await spatialService.ListZonesAsync(projectId));

    /// <summary>Zone drill panel: linked RFIs / reports / progress / schedule or honest empty.</summary>
    [HttpGet("zones/{spatialNodeId:guid}")]
    [Authorize(Policy = "Spatial.View")]
    [ProducesResponseType(typeof(SpatialZoneDetailResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetZoneDetail(Guid projectId, Guid spatialNodeId)
        => HandleResult(await spatialService.GetZoneDetailAsync(projectId, spatialNodeId));

    /// <summary>
    /// Photo pins for twin zone panel (2.15.3 stub). Empty Pins is honest — not “all clear”.
    /// </summary>
    [HttpGet("photo-pins")]
    [Authorize(Policy = "Spatial.View")]
    [ProducesResponseType(typeof(TwinPhotoPinsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPhotoPins(
        Guid projectId,
        [FromQuery] Guid? spatialNodeId = null)
        => HandleResult(await spatialService.ListPhotoPinsAsync(projectId, spatialNodeId));

    /// <summary>
    /// Data quality: % of daily reports + progress in last N days with spatial ref.
    /// Labeled quality only — not a vanity or executive KPI.
    /// </summary>
    [HttpGet("capture-quality")]
    [Authorize(Policy = "Spatial.View")]
    [ProducesResponseType(typeof(SpatialCaptureQualityResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCaptureQuality(
        Guid projectId,
        [FromQuery] int windowDays = 7)
        => HandleResult(await spatialService.GetCaptureQualityAsync(projectId, windowDays));

    /// <summary>List model assets (2.16.3). Empty list is honest — zones work without a 3D model.</summary>
    [HttpGet("model-assets")]
    [Authorize(Policy = "Spatial.View")]
    [ProducesResponseType(typeof(ModelAssetListResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListModelAssets(Guid projectId)
        => HandleResult(await spatialService.ListModelAssetsAsync(projectId));

    /// <summary>
    /// Register model asset metadata (upload scaffold). Starts as Pending — never ready until conversion Succeeded.
    /// </summary>
    [HttpPost("model-assets")]
    [Authorize(Policy = "Spatial.Manage")]
    [ProducesResponseType(typeof(ModelAssetDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> RegisterModelAsset(
        Guid projectId,
        [FromBody] RegisterModelAssetRequest request)
        => HandleResult(await spatialService.RegisterModelAssetAsync(projectId, request));

    /// <summary>
    /// Conversion job stub (2.16.5): Pending → Processing only. Never claims ready.
    /// </summary>
    [HttpPost("model-assets/{modelAssetId:guid}/start-conversion")]
    [Authorize(Policy = "Spatial.Manage")]
    [ProducesResponseType(typeof(ModelAssetDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> StartModelConversion(Guid projectId, Guid modelAssetId)
        => HandleResult(await spatialService.StartModelConversionAsync(projectId, modelAssetId));

    /// <summary>
    /// Set active runtime model version (2.16.7). Only Succeeded assets may be selected.
    /// </summary>
    [HttpPost("model-assets/{modelAssetId:guid}/set-active")]
    [Authorize(Policy = "Spatial.Manage")]
    [ProducesResponseType(typeof(ModelAssetDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetActiveModelAsset(Guid projectId, Guid modelAssetId)
        => HandleResult(await spatialService.SetActiveModelAssetAsync(projectId, modelAssetId));

    /// <summary>Mark conversion failed with clear error copy (2.16.8).</summary>
    [HttpPost("model-assets/{modelAssetId:guid}/fail-conversion")]
    [Authorize(Policy = "Spatial.Manage")]
    [ProducesResponseType(typeof(ModelAssetDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> FailModelConversion(
        Guid projectId,
        Guid modelAssetId,
        [FromBody] FailModelConversionRequest? body = null)
        => HandleResult(await spatialService.FailModelConversionAsync(
            projectId, modelAssetId, body?.ErrorMessage));

    /// <summary>Retry failed conversion → Processing stub (2.16.8). Still not ready.</summary>
    [HttpPost("model-assets/{modelAssetId:guid}/retry-conversion")]
    [Authorize(Policy = "Spatial.Manage")]
    [ProducesResponseType(typeof(ModelAssetDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> RetryModelConversion(Guid projectId, Guid modelAssetId)
        => HandleResult(await spatialService.RetryModelConversionAsync(projectId, modelAssetId));
}

public sealed record FailModelConversionRequest(string? ErrorMessage);
