using Pitbull.Core.CQRS;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.ProjectManagement.Services;

public interface IScheduleService
{
    Task<Result<PmEntityDto>> CreateScheduleAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetScheduleAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListSchedulesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateScheduleAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteScheduleAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> RecalculateCriticalPathAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> CreateBaselineAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddActivityAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateActivityAsync(Guid projectId, Guid scheduleId, Guid activityId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddDependencyAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteDependencyAsync(Guid projectId, Guid scheduleId, Guid dependencyId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListImportsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> ImportScheduleAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
}

public interface IJobCostService
{
    Task<Result<PagedResult<PmEntityDto>>> ListBudgetsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateBudgetAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateBudgetAsync(Guid projectId, Guid budgetId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListActualsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> RebuildActualsAsync(Guid projectId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListCommitmentsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateCommitmentAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListForecastsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateForecastAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
}

public interface ISubmittalService
{
    Task<Result<PmEntityDto>> CreateSubmittalAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetSubmittalAsync(Guid projectId, Guid submittalId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListSubmittalsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateSubmittalAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddWorkflowEventAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddAttachmentAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default);
}

public interface IPlansSpecsService
{
    Task<Result<PagedResult<PmEntityDto>>> ListFoldersAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateFolderAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListPlanSetsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetPlanSetAsync(Guid projectId, Guid planSetId, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreatePlanSetAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddPlanSheetAsync(Guid projectId, Guid planSetId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddPlanSheetRevisionAsync(Guid projectId, Guid sheetId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListSpecSectionsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateSpecSectionAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddSpecRevisionAsync(Guid projectId, Guid sectionId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateDistributionAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListDistributionsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddRfiAttachmentAsync(Guid projectId, Guid rfiId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListRfiAttachmentsAsync(Guid projectId, Guid rfiId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result> DeleteRfiAttachmentAsync(Guid projectId, Guid rfiId, Guid attachmentId, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateRfiDistributionAsync(Guid projectId, Guid rfiId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListRfiDistributionsAsync(Guid projectId, Guid rfiId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateRfiCostLinkAsync(Guid projectId, Guid rfiId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateRfiCostLinkAsync(Guid projectId, Guid rfiId, Guid linkId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListRfiCostLinksAsync(Guid projectId, Guid rfiId, PmListQuery query, CancellationToken cancellationToken = default);
}

public interface ICommunicationService
{
    Task<Result<PmEntityDto>> CreateCommunicationAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetCommunicationAsync(Guid projectId, Guid communicationId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListCommunicationsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateCommunicationAsync(Guid projectId, Guid communicationId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddAttachmentAsync(Guid projectId, Guid communicationId, PmUpsertRequest request, CancellationToken cancellationToken = default);
}

public interface IDailyReportService
{
    Task<Result<PmEntityDto>> CreateDailyReportAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetDailyReportAsync(Guid projectId, Guid dailyReportId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListDailyReportsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateDailyReportAsync(Guid projectId, Guid dailyReportId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> SubmitDailyReportAsync(Guid projectId, Guid dailyReportId, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> ApproveDailyReportAsync(Guid projectId, Guid dailyReportId, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddPhotoAsync(Guid projectId, Guid dailyReportId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> RollupDailyReportAsync(Guid projectId, Guid dailyReportId, PmUpsertRequest request, CancellationToken cancellationToken = default);
}

public interface IProgressService
{
    Task<Result<PmEntityDto>> CreateProgressEntryAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetProgressEntryAsync(Guid projectId, Guid progressEntryId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListProgressEntriesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateProgressEntryAsync(Guid projectId, Guid progressEntryId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> ApproveProgressEntryAsync(Guid projectId, Guid progressEntryId, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> LinkTimeEntryAsync(Guid projectId, Guid progressEntryId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListEarnedValueSnapshotsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListSCurveAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
}

public interface IProjectionService
{
    Task<Result<PmEntityDto>> CreateMonthlyProjectionAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetMonthlyProjectionAsync(Guid projectId, Guid projectionId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListMonthlyProjectionsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateMonthlyProjectionAsync(Guid projectId, Guid projectionId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> SubmitMonthlyProjectionAsync(Guid projectId, Guid projectionId, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> ApproveMonthlyProjectionAsync(Guid projectId, Guid projectionId, CancellationToken cancellationToken = default);
}

public interface IMeetingService
{
    Task<Result<PmEntityDto>> CreateMeetingSeriesAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListMeetingSeriesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateMeetingAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetMeetingAsync(Guid projectId, Guid meetingId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListMeetingsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateMeetingAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddAgendaItemAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddMinutesAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddActionItemAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateActionItemAsync(Guid projectId, Guid meetingId, Guid actionItemId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListMyActionItemsAsync(PmListQuery query, Guid assignedUserId, CancellationToken cancellationToken = default);
}

public interface IDocumentGenerationService
{
    Task<Result<PmEntityDto>> CreateTemplateAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListTemplatesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GenerateDocumentAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetGeneratedDocumentAsync(Guid projectId, Guid generatedDocumentId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListGeneratedDocumentsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> CreateLetterheadAsync(Guid companyId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListLetterheadsAsync(Guid companyId, PmListQuery query, CancellationToken cancellationToken = default);
}

public interface ITaskService
{
    Task<Result<PmEntityDto>> CreateTaskAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetTaskAsync(Guid projectId, Guid taskId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListTasksAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateTaskAsync(Guid projectId, Guid taskId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddTaskCommentAsync(Guid projectId, Guid taskId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListMyTasksAsync(PmListQuery query, Guid assignedUserId, CancellationToken cancellationToken = default);
}

public interface INarrativeService
{
    Task<Result<PmEntityDto>> CreateNarrativeAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetNarrativeAsync(Guid projectId, Guid narrativeId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListNarrativesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateNarrativeAsync(Guid projectId, Guid narrativeId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> SubmitNarrativeAsync(Guid projectId, Guid narrativeId, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> PublishNarrativeAsync(Guid projectId, Guid narrativeId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListNarrativeRevisionsAsync(Guid projectId, Guid narrativeId, PmListQuery query, CancellationToken cancellationToken = default);
}

public interface IDocumentService
{
    Task<Result<PmEntityDto>> CreateDocumentAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetDocumentAsync(Guid projectId, Guid documentId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListDocumentsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdateDocumentAsync(Guid projectId, Guid documentId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result> DeleteDocumentAsync(Guid projectId, Guid documentId, CancellationToken cancellationToken = default);
}

public interface IPunchListService
{
    Task<Result<PmEntityDto>> CreatePunchListItemAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> GetPunchListItemAsync(Guid projectId, Guid itemId, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListPunchListItemsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> UpdatePunchListItemAsync(Guid projectId, Guid itemId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> ClosePunchListItemAsync(Guid projectId, Guid itemId, CancellationToken cancellationToken = default);
    Task<Result<PmEntityDto>> AddPhotoAsync(Guid projectId, Guid itemId, PmUpsertRequest request, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PmEntityDto>>> ListPhotosAsync(Guid projectId, Guid itemId, PmListQuery query, CancellationToken cancellationToken = default);
    Task<Result<PmActionResultDto>> GetPunchListSummaryAsync(Guid projectId, CancellationToken cancellationToken = default);
}
