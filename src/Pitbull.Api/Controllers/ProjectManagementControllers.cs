using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/schedules")]
public class ProjectSchedulesController(IScheduleService scheduleService) : ProjectManagementControllerBase
{
    [HttpPost] public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await scheduleService.CreateScheduleAsync(projectId, request));
    [HttpGet("{scheduleId:guid}")] public async Task<IActionResult> Get(Guid projectId, Guid scheduleId) => HandleResult(await scheduleService.GetScheduleAsync(projectId, scheduleId));
    [HttpGet] public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await scheduleService.ListSchedulesAsync(projectId, query));
    [HttpPut("{scheduleId:guid}")] public async Task<IActionResult> Update(Guid projectId, Guid scheduleId, [FromBody] PmUpsertRequest request) => HandleResult(await scheduleService.UpdateScheduleAsync(projectId, scheduleId, request));
    [HttpDelete("{scheduleId:guid}")] public async Task<IActionResult> Delete(Guid projectId, Guid scheduleId) => HandleAction(await scheduleService.DeleteScheduleAsync(projectId, scheduleId));
    [HttpPost("{scheduleId:guid}/activities")] public async Task<IActionResult> AddActivity(Guid projectId, Guid scheduleId, [FromBody] PmUpsertRequest request) => HandleResult(await scheduleService.AddActivityAsync(projectId, scheduleId, request));
    [HttpPut("{scheduleId:guid}/activities/{activityId:guid}")] public async Task<IActionResult> UpdateActivity(Guid projectId, Guid scheduleId, Guid activityId, [FromBody] PmUpsertRequest request) => HandleResult(await scheduleService.UpdateActivityAsync(projectId, scheduleId, activityId, request));
    [HttpPost("{scheduleId:guid}/dependencies")] public async Task<IActionResult> AddDependency(Guid projectId, Guid scheduleId, [FromBody] PmUpsertRequest request) => HandleResult(await scheduleService.AddDependencyAsync(projectId, scheduleId, request));
    [HttpDelete("{scheduleId:guid}/dependencies/{dependencyId:guid}")] public async Task<IActionResult> DeleteDependency(Guid projectId, Guid scheduleId, Guid dependencyId) => HandleAction(await scheduleService.DeleteDependencyAsync(projectId, scheduleId, dependencyId));
    [HttpPost("{scheduleId:guid}/baseline")] public async Task<IActionResult> Baseline(Guid projectId, Guid scheduleId, [FromBody] PmUpsertRequest request) => HandleResult(await scheduleService.CreateBaselineAsync(projectId, scheduleId, request));
    [HttpGet("{scheduleId:guid}/variance")] public async Task<IActionResult> Variance(Guid projectId, Guid scheduleId) => HandleResult(await scheduleService.GetScheduleAsync(projectId, scheduleId));
    [HttpPost("{scheduleId:guid}/critical-path/recalculate")] public async Task<IActionResult> Recalculate(Guid projectId, Guid scheduleId) => HandleResult(await scheduleService.RecalculateCriticalPathAsync(projectId, scheduleId));
    [HttpPost("/api/projects/{projectId:guid}/schedules/import")] public async Task<IActionResult> Import(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await scheduleService.ImportScheduleAsync(projectId, request));
    [HttpGet("/api/projects/{projectId:guid}/schedules/imports")] public async Task<IActionResult> Imports(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await scheduleService.ListImportsAsync(projectId, query));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/job-cost")]
public class ProjectJobCostController(IJobCostService jobCostService) : ProjectManagementControllerBase
{
    [HttpPost("budgets")] public async Task<IActionResult> CreateBudget(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await jobCostService.CreateBudgetAsync(projectId, request));
    [HttpPut("budgets/{budgetId:guid}")] public async Task<IActionResult> UpdateBudget(Guid projectId, Guid budgetId, [FromBody] PmUpsertRequest request) => HandleResult(await jobCostService.UpdateBudgetAsync(projectId, budgetId, request));
    [HttpGet("budgets")] public async Task<IActionResult> ListBudgets(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await jobCostService.ListBudgetsAsync(projectId, query));
    [HttpGet("actuals")] public async Task<IActionResult> ListActuals(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await jobCostService.ListActualsAsync(projectId, query));
    [HttpPost("actuals/rebuild")] public async Task<IActionResult> RebuildActuals(Guid projectId) => HandleResult(await jobCostService.RebuildActualsAsync(projectId));
    [HttpGet("commitments")] public async Task<IActionResult> ListCommitments(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await jobCostService.ListCommitmentsAsync(projectId, query));
    [HttpPost("commitments")] public async Task<IActionResult> CreateCommitment(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await jobCostService.CreateCommitmentAsync(projectId, request));
    [HttpGet("forecasts")] public async Task<IActionResult> ListForecasts(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await jobCostService.ListForecastsAsync(projectId, query));
    [HttpPost("forecasts")] public async Task<IActionResult> CreateForecast(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await jobCostService.CreateForecastAsync(projectId, request));
    [HttpGet("analysis/over-under")] public async Task<IActionResult> OverUnder(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await jobCostService.ListForecastsAsync(projectId, query));
    [HttpGet("unit-costs")] public async Task<IActionResult> UnitCosts(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await jobCostService.ListActualsAsync(projectId, query));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/submittals")]
public class SubmittalsController(ISubmittalService submittalService) : ProjectManagementControllerBase
{
    [HttpPost] public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await submittalService.CreateSubmittalAsync(projectId, request));
    [HttpGet("{submittalId:guid}")] public async Task<IActionResult> Get(Guid projectId, Guid submittalId) => HandleResult(await submittalService.GetSubmittalAsync(projectId, submittalId));
    [HttpGet] public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await submittalService.ListSubmittalsAsync(projectId, query));
    [HttpPut("{submittalId:guid}")] public async Task<IActionResult> Update(Guid projectId, Guid submittalId, [FromBody] PmUpsertRequest request) => HandleResult(await submittalService.UpdateSubmittalAsync(projectId, submittalId, request));
    [HttpPost("{submittalId:guid}/workflow")] public async Task<IActionResult> Workflow(Guid projectId, Guid submittalId, [FromBody] PmUpsertRequest request) => HandleResult(await submittalService.AddWorkflowEventAsync(projectId, submittalId, request));
    [HttpPost("{submittalId:guid}/attachments")] public async Task<IActionResult> Attachment(Guid projectId, Guid submittalId, [FromBody] PmUpsertRequest request) => HandleResult(await submittalService.AddAttachmentAsync(projectId, submittalId, request));
    [HttpGet("register")] public async Task<IActionResult> Register(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await submittalService.ListSubmittalsAsync(projectId, query));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class PlansAndSpecsController(IPlansSpecsService plansSpecsService) : ProjectManagementControllerBase
{
    [HttpGet("documents/folders")] public async Task<IActionResult> ListFolders(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await plansSpecsService.ListFoldersAsync(projectId, query));
    [HttpPost("documents/folders")] public async Task<IActionResult> CreateFolder(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.CreateFolderAsync(projectId, request));
    [HttpPost("plan-sets")] public async Task<IActionResult> CreatePlanSet(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.CreatePlanSetAsync(projectId, request));
    [HttpGet("plan-sets")] public async Task<IActionResult> ListPlanSets(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await plansSpecsService.ListPlanSetsAsync(projectId, query));
    [HttpGet("plan-sets/{planSetId:guid}")] public async Task<IActionResult> GetPlanSet(Guid projectId, Guid planSetId) => HandleResult(await plansSpecsService.GetPlanSetAsync(projectId, planSetId));
    [HttpPost("plan-sets/{planSetId:guid}/sheets")] public async Task<IActionResult> AddSheet(Guid projectId, Guid planSetId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.AddPlanSheetAsync(projectId, planSetId, request));
    [HttpPost("plan-sheets/{sheetId:guid}/revisions")] public async Task<IActionResult> AddSheetRevision(Guid projectId, Guid sheetId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.AddPlanSheetRevisionAsync(projectId, sheetId, request));
    [HttpGet("spec-sections")] public async Task<IActionResult> ListSpecSections(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await plansSpecsService.ListSpecSectionsAsync(projectId, query));
    [HttpPost("spec-sections")] public async Task<IActionResult> CreateSpecSection(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.CreateSpecSectionAsync(projectId, request));
    [HttpPost("spec-sections/{specSectionId:guid}/revisions")] public async Task<IActionResult> AddSpecRevision(Guid projectId, Guid specSectionId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.AddSpecRevisionAsync(projectId, specSectionId, request));
    [HttpPost("document-distributions")] public async Task<IActionResult> CreateDistribution(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.CreateDistributionAsync(projectId, request));
    [HttpGet("document-distributions")] public async Task<IActionResult> ListDistributions(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await plansSpecsService.ListDistributionsAsync(projectId, query));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/communications")]
public class ProjectCommunicationsController(ICommunicationService communicationService) : ProjectManagementControllerBase
{
    [HttpPost] public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await communicationService.CreateCommunicationAsync(projectId, request));
    [HttpGet("{communicationId:guid}")] public async Task<IActionResult> Get(Guid projectId, Guid communicationId) => HandleResult(await communicationService.GetCommunicationAsync(projectId, communicationId));
    [HttpGet] public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await communicationService.ListCommunicationsAsync(projectId, query));
    [HttpPut("{communicationId:guid}")] public async Task<IActionResult> Update(Guid projectId, Guid communicationId, [FromBody] PmUpsertRequest request) => HandleResult(await communicationService.UpdateCommunicationAsync(projectId, communicationId, request));
    [HttpPost("{communicationId:guid}/attachments")] public async Task<IActionResult> Attachment(Guid projectId, Guid communicationId, [FromBody] PmUpsertRequest request) => HandleResult(await communicationService.AddAttachmentAsync(projectId, communicationId, request));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/daily-reports")]
public class ProjectDailyReportsController(IDailyReportService dailyReportService) : ProjectManagementControllerBase
{
    [HttpPost] public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await dailyReportService.CreateDailyReportAsync(projectId, request));
    [HttpGet("{dailyReportId:guid}")] public async Task<IActionResult> Get(Guid projectId, Guid dailyReportId) => HandleResult(await dailyReportService.GetDailyReportAsync(projectId, dailyReportId));
    [HttpGet] public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await dailyReportService.ListDailyReportsAsync(projectId, query));
    [HttpPut("{dailyReportId:guid}")] public async Task<IActionResult> Update(Guid projectId, Guid dailyReportId, [FromBody] PmUpsertRequest request) => HandleResult(await dailyReportService.UpdateDailyReportAsync(projectId, dailyReportId, request));
    [HttpPost("{dailyReportId:guid}/submit")] public async Task<IActionResult> Submit(Guid projectId, Guid dailyReportId) => HandleResult(await dailyReportService.SubmitDailyReportAsync(projectId, dailyReportId));
    [HttpPost("{dailyReportId:guid}/approve")] public async Task<IActionResult> Approve(Guid projectId, Guid dailyReportId) => HandleResult(await dailyReportService.ApproveDailyReportAsync(projectId, dailyReportId));
    [HttpPost("{dailyReportId:guid}/photos")] public async Task<IActionResult> AddPhoto(Guid projectId, Guid dailyReportId, [FromBody] PmUpsertRequest request) => HandleResult(await dailyReportService.AddPhotoAsync(projectId, dailyReportId, request));
    [HttpPost("{dailyReportId:guid}/rollup")] public async Task<IActionResult> Rollup(Guid projectId, Guid dailyReportId, [FromBody] PmUpsertRequest request) => HandleResult(await dailyReportService.RollupDailyReportAsync(projectId, dailyReportId, request));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class ProjectProgressController(IProgressService progressService) : ProjectManagementControllerBase
{
    [HttpPost("progress-entries")] public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await progressService.CreateProgressEntryAsync(projectId, request));
    [HttpGet("progress-entries/{progressEntryId:guid}")] public async Task<IActionResult> Get(Guid projectId, Guid progressEntryId) => HandleResult(await progressService.GetProgressEntryAsync(projectId, progressEntryId));
    [HttpGet("progress-entries")] public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await progressService.ListProgressEntriesAsync(projectId, query));
    [HttpPut("progress-entries/{progressEntryId:guid}")] public async Task<IActionResult> Update(Guid projectId, Guid progressEntryId, [FromBody] PmUpsertRequest request) => HandleResult(await progressService.UpdateProgressEntryAsync(projectId, progressEntryId, request));
    [HttpPost("progress-entries/{progressEntryId:guid}/approve")] public async Task<IActionResult> Approve(Guid projectId, Guid progressEntryId) => HandleResult(await progressService.ApproveProgressEntryAsync(projectId, progressEntryId));
    [HttpPost("progress-entries/{progressEntryId:guid}/time-links")] public async Task<IActionResult> TimeLinks(Guid projectId, Guid progressEntryId, [FromBody] PmUpsertRequest request) => HandleResult(await progressService.LinkTimeEntryAsync(projectId, progressEntryId, request));
    [HttpGet("earned-value/snapshots")] public async Task<IActionResult> EarnedValue(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await progressService.ListEarnedValueSnapshotsAsync(projectId, query));
    [HttpGet("s-curve")] public async Task<IActionResult> SCurve(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await progressService.ListSCurveAsync(projectId, query));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class ProjectProjectionsController(IProjectionService projectionService) : ProjectManagementControllerBase
{
    [HttpPost("monthly-projections")] public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await projectionService.CreateMonthlyProjectionAsync(projectId, request));
    [HttpGet("monthly-projections/{projectionId:guid}")] public async Task<IActionResult> Get(Guid projectId, Guid projectionId) => HandleResult(await projectionService.GetMonthlyProjectionAsync(projectId, projectionId));
    [HttpGet("monthly-projections")] public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await projectionService.ListMonthlyProjectionsAsync(projectId, query));
    [HttpPut("monthly-projections/{projectionId:guid}")] public async Task<IActionResult> Update(Guid projectId, Guid projectionId, [FromBody] PmUpsertRequest request) => HandleResult(await projectionService.UpdateMonthlyProjectionAsync(projectId, projectionId, request));
    [HttpPost("monthly-projections/{projectionId:guid}/submit")] public async Task<IActionResult> Submit(Guid projectId, Guid projectionId) => HandleResult(await projectionService.SubmitMonthlyProjectionAsync(projectId, projectionId));
    [HttpPost("monthly-projections/{projectionId:guid}/approve")] public async Task<IActionResult> Approve(Guid projectId, Guid projectionId) => HandleResult(await projectionService.ApproveMonthlyProjectionAsync(projectId, projectionId));
    [HttpGet("projection-variance")] public async Task<IActionResult> Variance(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await projectionService.ListMonthlyProjectionsAsync(projectId, query));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class ProjectMeetingsController(IMeetingService meetingService) : ProjectManagementControllerBase
{
    [HttpPost("meeting-series")] public async Task<IActionResult> CreateSeries(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await meetingService.CreateMeetingSeriesAsync(projectId, request));
    [HttpGet("meeting-series")] public async Task<IActionResult> ListSeries(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await meetingService.ListMeetingSeriesAsync(projectId, query));
    [HttpPost("meetings")] public async Task<IActionResult> CreateMeeting(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await meetingService.CreateMeetingAsync(projectId, request));
    [HttpGet("meetings/{meetingId:guid}")] public async Task<IActionResult> GetMeeting(Guid projectId, Guid meetingId) => HandleResult(await meetingService.GetMeetingAsync(projectId, meetingId));
    [HttpGet("meetings")] public async Task<IActionResult> ListMeetings(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await meetingService.ListMeetingsAsync(projectId, query));
    [HttpPut("meetings/{meetingId:guid}")] public async Task<IActionResult> UpdateMeeting(Guid projectId, Guid meetingId, [FromBody] PmUpsertRequest request) => HandleResult(await meetingService.UpdateMeetingAsync(projectId, meetingId, request));
    [HttpPost("meetings/{meetingId:guid}/agenda-items")] public async Task<IActionResult> Agenda(Guid projectId, Guid meetingId, [FromBody] PmUpsertRequest request) => HandleResult(await meetingService.AddAgendaItemAsync(projectId, meetingId, request));
    [HttpPost("meetings/{meetingId:guid}/minutes")] public async Task<IActionResult> Minutes(Guid projectId, Guid meetingId, [FromBody] PmUpsertRequest request) => HandleResult(await meetingService.AddMinutesAsync(projectId, meetingId, request));
    [HttpPost("meetings/{meetingId:guid}/action-items")] public async Task<IActionResult> ActionItem(Guid projectId, Guid meetingId, [FromBody] PmUpsertRequest request) => HandleResult(await meetingService.AddActionItemAsync(projectId, meetingId, request));
    [HttpPut("meetings/{meetingId:guid}/action-items/{actionItemId:guid}")] public async Task<IActionResult> UpdateActionItem(Guid projectId, Guid meetingId, Guid actionItemId, [FromBody] PmUpsertRequest request) => HandleResult(await meetingService.UpdateActionItemAsync(projectId, meetingId, actionItemId, request));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}")]
public class ProjectDocumentGenerationController(IDocumentGenerationService docService) : ProjectManagementControllerBase
{
    [HttpPost("document-templates")] public async Task<IActionResult> CreateTemplate(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await docService.CreateTemplateAsync(projectId, request));
    [HttpGet("document-templates")] public async Task<IActionResult> ListTemplates(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await docService.ListTemplatesAsync(projectId, query));
    [HttpPost("documents/generate")] public async Task<IActionResult> Generate(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await docService.GenerateDocumentAsync(projectId, request));
    [HttpGet("generated-documents/{generatedDocumentId:guid}")] public async Task<IActionResult> GetGenerated(Guid projectId, Guid generatedDocumentId) => HandleResult(await docService.GetGeneratedDocumentAsync(projectId, generatedDocumentId));
    [HttpGet("generated-documents")] public async Task<IActionResult> ListGenerated(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await docService.ListGeneratedDocumentsAsync(projectId, query));
    [HttpPost("/api/companies/{companyId:guid}/letterheads")] public async Task<IActionResult> CreateLetterhead(Guid companyId, [FromBody] PmUpsertRequest request) => HandleResult(await docService.CreateLetterheadAsync(companyId, request));
    [HttpGet("/api/companies/{companyId:guid}/letterheads")] public async Task<IActionResult> ListLetterheads(Guid companyId, [FromQuery] PmListQuery query) => HandleResult(await docService.ListLetterheadsAsync(companyId, query));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/tasks")]
public class ProjectTasksController(ITaskService taskService) : ProjectManagementControllerBase
{
    [HttpPost] public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await taskService.CreateTaskAsync(projectId, request));
    [HttpGet("{taskId:guid}")] public async Task<IActionResult> Get(Guid projectId, Guid taskId) => HandleResult(await taskService.GetTaskAsync(projectId, taskId));
    [HttpGet] public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await taskService.ListTasksAsync(projectId, query));
    [HttpPut("{taskId:guid}")] public async Task<IActionResult> Update(Guid projectId, Guid taskId, [FromBody] PmUpsertRequest request) => HandleResult(await taskService.UpdateTaskAsync(projectId, taskId, request));
    [HttpPost("{taskId:guid}/comments")] public async Task<IActionResult> Comment(Guid projectId, Guid taskId, [FromBody] PmUpsertRequest request) => HandleResult(await taskService.AddTaskCommentAsync(projectId, taskId, request));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/narratives")]
public class ProjectNarrativesController(INarrativeService narrativeService) : ProjectManagementControllerBase
{
    [HttpPost] public async Task<IActionResult> Create(Guid projectId, [FromBody] PmUpsertRequest request) => HandleResult(await narrativeService.CreateNarrativeAsync(projectId, request));
    [HttpGet("{narrativeId:guid}")] public async Task<IActionResult> Get(Guid projectId, Guid narrativeId) => HandleResult(await narrativeService.GetNarrativeAsync(projectId, narrativeId));
    [HttpGet] public async Task<IActionResult> List(Guid projectId, [FromQuery] PmListQuery query) => HandleResult(await narrativeService.ListNarrativesAsync(projectId, query));
    [HttpPut("{narrativeId:guid}")] public async Task<IActionResult> Update(Guid projectId, Guid narrativeId, [FromBody] PmUpsertRequest request) => HandleResult(await narrativeService.UpdateNarrativeAsync(projectId, narrativeId, request));
    [HttpPost("{narrativeId:guid}/submit")] public async Task<IActionResult> Submit(Guid projectId, Guid narrativeId) => HandleResult(await narrativeService.SubmitNarrativeAsync(projectId, narrativeId));
    [HttpPost("{narrativeId:guid}/publish")] public async Task<IActionResult> Publish(Guid projectId, Guid narrativeId) => HandleResult(await narrativeService.PublishNarrativeAsync(projectId, narrativeId));
    [HttpGet("{narrativeId:guid}/revisions")] public async Task<IActionResult> Revisions(Guid projectId, Guid narrativeId, [FromQuery] PmListQuery query) => HandleResult(await narrativeService.ListNarrativeRevisionsAsync(projectId, narrativeId, query));
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/project-management")]
public class ProjectManagementDashboardController(ITaskService taskService, IMeetingService meetingService) : ProjectManagementControllerBase
{
    [HttpGet("tasks/my")]
    public async Task<IActionResult> MyTasks([FromQuery] PmListQuery query)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { error = "User ID was not found in token claims.", code = "UNAUTHORIZED" });

        return HandleResult(await taskService.ListMyTasksAsync(query, userId));
    }

    [HttpGet("action-items/my")]
    public async Task<IActionResult> MyActionItems([FromQuery] PmListQuery query)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { error = "User ID was not found in token claims.", code = "UNAUTHORIZED" });

        return HandleResult(await meetingService.ListMyActionItemsAsync(query, userId));
    }
}

[ApiController]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Route("api/projects/{projectId:guid}/rfis/{rfiId:guid}")]
public class ProjectRfiEnhancementsController(IPlansSpecsService plansSpecsService) : ProjectManagementControllerBase
{
    [HttpPost("attachments")] public async Task<IActionResult> AddAttachment(Guid projectId, Guid rfiId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.AddRfiAttachmentAsync(projectId, rfiId, request));
    [HttpGet("attachments")] public async Task<IActionResult> ListAttachments(Guid projectId, Guid rfiId, [FromQuery] PmListQuery query) => HandleResult(await plansSpecsService.ListRfiAttachmentsAsync(projectId, rfiId, query));
    [HttpDelete("attachments/{attachmentId:guid}")] public async Task<IActionResult> DeleteAttachment(Guid projectId, Guid rfiId, Guid attachmentId) => HandleAction(await plansSpecsService.DeleteRfiAttachmentAsync(projectId, rfiId, attachmentId));
    [HttpPost("distribution")] public async Task<IActionResult> CreateDistribution(Guid projectId, Guid rfiId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.CreateRfiDistributionAsync(projectId, rfiId, request));
    [HttpGet("distribution")] public async Task<IActionResult> ListDistribution(Guid projectId, Guid rfiId, [FromQuery] PmListQuery query) => HandleResult(await plansSpecsService.ListRfiDistributionsAsync(projectId, rfiId, query));
    [HttpPost("cost-links")] public async Task<IActionResult> CreateCostLink(Guid projectId, Guid rfiId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.CreateRfiCostLinkAsync(projectId, rfiId, request));
    [HttpPut("cost-links/{linkId:guid}")] public async Task<IActionResult> UpdateCostLink(Guid projectId, Guid rfiId, Guid linkId, [FromBody] PmUpsertRequest request) => HandleResult(await plansSpecsService.UpdateRfiCostLinkAsync(projectId, rfiId, linkId, request));
    [HttpGet("cost-links")] public async Task<IActionResult> ListCostLinks(Guid projectId, Guid rfiId, [FromQuery] PmListQuery query) => HandleResult(await plansSpecsService.ListRfiCostLinksAsync(projectId, rfiId, query));
}
