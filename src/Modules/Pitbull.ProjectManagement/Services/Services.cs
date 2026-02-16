using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.RFIs.Domain;
using System.Text.Json;

namespace Pitbull.ProjectManagement.Services;

public abstract class PmServiceBase
{
    private static readonly HashSet<string> ProtectedFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "Id", "TenantId", "CompanyId", "IsDeleted", "DeletedAt", "DeletedBy", "CreatedAt", "CreatedBy"
    };

    protected readonly PitbullDbContext Db;
    private readonly ICompanyContext _companyContext;

    protected PmServiceBase(PitbullDbContext db, ICompanyContext companyContext)
    {
        Db = db;
        _companyContext = companyContext;
    }

    protected Guid CurrentCompanyId => _companyContext.IsResolved ? _companyContext.CompanyId : Guid.Empty;

    protected static PmEntityDto ToDto<T>(T entity) where T : BaseEntity
    {
        var type = typeof(T);
        var projectId = type.GetProperty("ProjectId")?.GetValue(entity) as Guid?;
        var name = type.GetProperty("Name")?.GetValue(entity)?.ToString();
        var title = type.GetProperty("Title")?.GetValue(entity)?.ToString();
        var status = type.GetProperty("Status")?.GetValue(entity)?.ToString();

        return new PmEntityDto(entity.Id, projectId, name, title, status, entity.CreatedAt, entity.UpdatedAt);
    }

    protected IQueryable<T> ProjectScoped<T>(Guid projectId) where T : BaseEntity
    {
        var query = Db.Set<T>().Where(e => !e.IsDeleted).AsQueryable();
        if (typeof(T).GetProperty("ProjectId") != null)
            query = query.Where(e => EF.Property<Guid>(e, "ProjectId") == projectId);
        return query;
    }

    protected async Task<Result<PagedResult<PmEntityDto>>> ListAsync<T>(IQueryable<T> query, PmListQuery listQuery, CancellationToken ct)
        where T : BaseEntity
    {
        query = query.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(listQuery.Search) && typeof(T).GetProperty("Name") != null)
        {
            var s = listQuery.Search.ToLowerInvariant();
            query = query.Where(e => EF.Property<string>(e, "Name").ToLower().Contains(s));
        }

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((listQuery.Page - 1) * listQuery.PageSize)
            .Take(listQuery.PageSize)
            .ToListAsync(ct);

        return Result.Success(new PagedResult<PmEntityDto>(items.Select(ToDto).ToList(), total, listQuery.Page, listQuery.PageSize));
    }

    protected async Task<Result<PmEntityDto>> CreateAsync<T>(Guid projectId, PmUpsertRequest request, CancellationToken ct)
        where T : BaseEntity, ICompanyScoped, new()
    {
        var entity = new T
        {
            Id = Guid.NewGuid(),
            CompanyId = CurrentCompanyId,
            CreatedAt = DateTime.UtcNow,
        };

        SetIfExists(entity, "ProjectId", projectId);
        ApplyUpsert(entity, request);

        Db.Set<T>().Add(entity);
        await Db.SaveChangesAsync(ct);
        return Result.Success(ToDto(entity));
    }

    protected async Task<Result<PmEntityDto>> GetAsync<T>(Guid projectId, Guid id, CancellationToken ct) where T : BaseEntity
    {
        var query = ProjectScoped<T>(projectId).AsNoTracking();
        var entity = await query.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (entity == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        return Result.Success(ToDto(entity));
    }

    protected async Task<Result<PmEntityDto>> UpdateAsync<T>(Guid projectId, Guid id, PmUpsertRequest request, CancellationToken ct)
        where T : BaseEntity
    {
        var query = ProjectScoped<T>(projectId);
        var entity = await query.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (entity == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        ApplyUpsert(entity, request);
        entity.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(ct);
        return Result.Success(ToDto(entity));
    }

    protected async Task<Result> DeleteAsync<T>(Guid projectId, Guid id, CancellationToken ct) where T : BaseEntity
    {
        var query = ProjectScoped<T>(projectId);
        var entity = await query.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (entity == null)
            return Result.Failure("Not found", "NOT_FOUND");

        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        entity.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(ct);
        return Result.Success();
    }

    protected static void ApplyUpsert(object entity, PmUpsertRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Name)) SetIfExists(entity, "Name", request.Name);
        if (!string.IsNullOrWhiteSpace(request.Title)) SetIfExists(entity, "Title", request.Title);
        if (!string.IsNullOrWhiteSpace(request.Description)) SetIfExists(entity, "Description", request.Description);

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var p = entity.GetType().GetProperty("Status");
            if (p != null && p.PropertyType.IsEnum && Enum.TryParse(p.PropertyType, request.Status, true, out var v))
                p.SetValue(entity, v);
        }

        if (request.ReferenceId.HasValue)
        {
            foreach (var propName in new[]
                     {
                         "ReferenceId", "ScheduleId", "SubmittalId", "TaskId", "MeetingId", "CommunicationId", "DocumentId",
                         "PlanSetId", "PlanSheetId", "SpecSectionId", "DailyReportId", "ProgressEntryId", "NarrativeId", "RfiId"
                     })
            {
                if (entity.GetType().GetProperty(propName) != null)
                {
                    SetIfExists(entity, propName, request.ReferenceId.Value);
                    break;
                }
            }
        }

        if (request.DueDate.HasValue)
            SetIfExists(entity, "DueDate", request.DueDate.Value);

        if (request.Data is null) return;
        foreach (var kvp in request.Data)
        {
            if (ProtectedFields.Contains(kvp.Key)) continue;
            var p = entity.GetType().GetProperty(kvp.Key);
            if (p == null || kvp.Value is null) continue;
            try
            {
                var converted = ConvertToPropertyType(kvp.Value, Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType);
                p.SetValue(entity, converted);
            }
            catch
            {
                // Ignore incompatible fields in generic upsert.
            }
        }
    }

    protected static void SetIfExists(object entity, string propertyName, object value)
    {
        var p = entity.GetType().GetProperty(propertyName);
        if (p == null || !p.CanWrite) return;
        p.SetValue(entity, value);
    }

    private static object ConvertToPropertyType(object value, Type targetType)
    {
        if (value is JsonElement jsonElement)
        {
            return targetType switch
            {
                _ when targetType == typeof(Guid) => jsonElement.GetGuid(),
                _ when targetType == typeof(Guid?) => jsonElement.ValueKind == JsonValueKind.Null ? null! : jsonElement.GetGuid(),
                _ when targetType == typeof(string) => jsonElement.GetString() ?? string.Empty,
                _ when targetType == typeof(int) => jsonElement.GetInt32(),
                _ when targetType == typeof(long) => jsonElement.GetInt64(),
                _ when targetType == typeof(decimal) => jsonElement.GetDecimal(),
                _ when targetType == typeof(double) => jsonElement.GetDouble(),
                _ when targetType == typeof(bool) => jsonElement.GetBoolean(),
                _ when targetType == typeof(DateTime) => jsonElement.GetDateTime(),
                _ when targetType.IsEnum => Enum.Parse(targetType, jsonElement.GetString() ?? string.Empty, true),
                _ => Convert.ChangeType(jsonElement.ToString(), targetType)
            };
        }

        if (targetType.IsEnum && value is string enumString)
            return Enum.Parse(targetType, enumString, true);

        return Convert.ChangeType(value, targetType);
    }

    protected static Result<PmActionResultDto> Action(string message, Guid? id = null, object? data = null)
        => Result.Success(new PmActionResultDto(true, message, id, data));
}

public class ScheduleService : PmServiceBase, IScheduleService
{
    public ScheduleService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }

    public Task<Result<PmEntityDto>> CreateScheduleAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmSchedule>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetScheduleAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default)
        => GetAsync<PmSchedule>(projectId, scheduleId, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateScheduleAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmSchedule>(projectId, scheduleId, request, cancellationToken);
    public Task<Result> DeleteScheduleAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default)
        => DeleteAsync<PmSchedule>(projectId, scheduleId, cancellationToken);
    public async Task<Result<PmActionResultDto>> RecalculateCriticalPathAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default)
    {
        var schedule = await ProjectScoped<PmSchedule>(projectId).FirstOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);
        if (schedule == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        schedule.LastCriticalPathRunAt = DateTime.UtcNow;
        schedule.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);

        return Action("Critical path recalculated", scheduleId, new { schedule.LastCriticalPathRunAt });
    }
    public async Task<Result<PmActionResultDto>> CreateBaselineAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var schedule = await ProjectScoped<PmSchedule>(projectId).FirstOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);
        if (schedule == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        var baseline = new PmScheduleBaseline
        {
            Id = Guid.NewGuid(),
            CompanyId = CurrentCompanyId,
            ProjectId = projectId,
            ScheduleId = scheduleId,
            Name = string.IsNullOrWhiteSpace(request.Name) ? $"Baseline {DateTime.UtcNow:yyyy-MM-dd}" : request.Name,
            BaselineType = Enum.TryParse<ScheduleBaselineType>(request.Status, true, out var baselineType)
                ? baselineType
                : ScheduleBaselineType.Initial,
            CapturedAt = DateTime.UtcNow,
            CapturedByUserId = Guid.Empty,
            SourceVersion = request.Data?.TryGetValue("SourceVersion", out var sourceVersion) == true ? sourceVersion?.ToString() : null,
            CreatedAt = DateTime.UtcNow
        };

        Db.Set<PmScheduleBaseline>().Add(baseline);
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Baseline created", baseline.Id, new { baseline.ScheduleId, baseline.CapturedAt });
    }
    public Task<Result<PmEntityDto>> AddActivityAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmScheduleActivity>(projectId, request with { ReferenceId = scheduleId }, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateActivityAsync(Guid projectId, Guid scheduleId, Guid activityId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmScheduleActivity>(projectId, activityId, request with { ReferenceId = scheduleId }, cancellationToken);
    public Task<Result<PmEntityDto>> AddDependencyAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmScheduleDependency>(projectId, request with { ReferenceId = scheduleId }, cancellationToken);
    public async Task<Result> DeleteDependencyAsync(Guid projectId, Guid scheduleId, Guid dependencyId, CancellationToken cancellationToken = default)
    {
        var schedule = await ProjectScoped<PmSchedule>(projectId).FirstOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);
        if (schedule == null)
            return Result.Failure("Not found", "NOT_FOUND");

        var dependency = await Db.Set<PmScheduleDependency>()
            .FirstOrDefaultAsync(d => !d.IsDeleted && d.Id == dependencyId && d.ScheduleId == scheduleId, cancellationToken);
        if (dependency == null)
            return Result.Failure("Not found", "NOT_FOUND");

        dependency.IsDeleted = true;
        dependency.DeletedAt = DateTime.UtcNow;
        dependency.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
    public Task<Result<PmEntityDto>> ImportScheduleAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmScheduleImportLog>(projectId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListImportsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmScheduleImportLog>(projectId), query, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListSchedulesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmSchedule>(projectId), query, cancellationToken);
}

public class JobCostService : PmServiceBase, IJobCostService
{
    public JobCostService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateBudgetAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmJobCostBudget>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateBudgetAsync(Guid projectId, Guid budgetId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmJobCostBudget>(projectId, budgetId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListBudgetsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmJobCostBudget>(projectId), query, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListActualsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmJobCostActual>(projectId), query, cancellationToken);
    public async Task<Result<PmActionResultDto>> RebuildActualsAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var actuals = await ProjectScoped<PmJobCostActual>(projectId).ToListAsync(cancellationToken);
        foreach (var actual in actuals)
            actual.UpdatedAt = now;

        await Db.SaveChangesAsync(cancellationToken);
        return Action("Actual cost rollups rebuilt", projectId, new { updatedCount = actuals.Count });
    }
    public Task<Result<PagedResult<PmEntityDto>>> ListCommitmentsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmJobCostCommitment>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> CreateCommitmentAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmJobCostCommitment>(projectId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListForecastsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmJobCostForecast>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> CreateForecastAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmJobCostForecast>(projectId, request, cancellationToken);
}

public class SubmittalService : PmServiceBase, ISubmittalService
{
    public SubmittalService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateSubmittalAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmSubmittal>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetSubmittalAsync(Guid projectId, Guid submittalId, CancellationToken cancellationToken = default)
        => GetAsync<PmSubmittal>(projectId, submittalId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListSubmittalsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmSubmittal>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateSubmittalAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmSubmittal>(projectId, submittalId, request, cancellationToken);
    public Task<Result<PmEntityDto>> AddWorkflowEventAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmSubmittalWorkflowEvent>(projectId, request with { ReferenceId = submittalId }, cancellationToken);
    public Task<Result<PmEntityDto>> AddAttachmentAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmSubmittalAttachment>(projectId, request with { ReferenceId = submittalId }, cancellationToken);
}

public class PlansSpecsService : PmServiceBase, IPlansSpecsService
{
    public PlansSpecsService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PagedResult<PmEntityDto>>> ListFoldersAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmDocumentFolder>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> CreateFolderAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmDocumentFolder>(projectId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListPlanSetsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmPlanSet>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> GetPlanSetAsync(Guid projectId, Guid planSetId, CancellationToken cancellationToken = default)
        => GetAsync<PmPlanSet>(projectId, planSetId, cancellationToken);
    public Task<Result<PmEntityDto>> CreatePlanSetAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmPlanSet>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> AddPlanSheetAsync(Guid projectId, Guid planSetId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmPlanSheet>(projectId, request with { ReferenceId = planSetId }, cancellationToken);
    public Task<Result<PmEntityDto>> AddPlanSheetRevisionAsync(Guid projectId, Guid sheetId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmPlanSheetRevision>(projectId, request with { ReferenceId = sheetId }, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListSpecSectionsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmSpecSection>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> CreateSpecSectionAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmSpecSection>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> AddSpecRevisionAsync(Guid projectId, Guid sectionId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmSpecSectionRevision>(projectId, request with { ReferenceId = sectionId }, cancellationToken);
    public Task<Result<PmEntityDto>> CreateDistributionAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmDocumentDistribution>(projectId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListDistributionsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmDocumentDistribution>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> AddRfiAttachmentAsync(Guid projectId, Guid rfiId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<RfiAttachment>(projectId, request with { ReferenceId = rfiId }, cancellationToken);
    public async Task<Result<PagedResult<PmEntityDto>>> ListRfiAttachmentsAsync(Guid projectId, Guid rfiId, PmListQuery query, CancellationToken cancellationToken = default)
    {
        var hasProjectRfi = await Db.Set<Rfi>().AnyAsync(r => !r.IsDeleted && r.Id == rfiId && r.ProjectId == projectId, cancellationToken);
        if (!hasProjectRfi)
            return Result.Failure<PagedResult<PmEntityDto>>("Not found", "NOT_FOUND");

        return await ListAsync(Db.Set<RfiAttachment>().Where(a => !a.IsDeleted && a.RfiId == rfiId), query, cancellationToken);
    }
    public async Task<Result> DeleteRfiAttachmentAsync(Guid projectId, Guid rfiId, Guid attachmentId, CancellationToken cancellationToken = default)
    {
        var hasProjectRfi = await Db.Set<Rfi>().AnyAsync(r => !r.IsDeleted && r.Id == rfiId && r.ProjectId == projectId, cancellationToken);
        if (!hasProjectRfi)
            return Result.Failure("Not found", "NOT_FOUND");

        var attachment = await Db.Set<RfiAttachment>().FirstOrDefaultAsync(a => !a.IsDeleted && a.Id == attachmentId && a.RfiId == rfiId, cancellationToken);
        if (attachment == null)
            return Result.Failure("Not found", "NOT_FOUND");

        attachment.IsDeleted = true;
        attachment.DeletedAt = DateTime.UtcNow;
        attachment.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
    public Task<Result<PmEntityDto>> CreateRfiDistributionAsync(Guid projectId, Guid rfiId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<RfiDistributionRecipient>(projectId, request with { ReferenceId = rfiId }, cancellationToken);
    public async Task<Result<PagedResult<PmEntityDto>>> ListRfiDistributionsAsync(Guid projectId, Guid rfiId, PmListQuery query, CancellationToken cancellationToken = default)
    {
        var hasProjectRfi = await Db.Set<Rfi>().AnyAsync(r => !r.IsDeleted && r.Id == rfiId && r.ProjectId == projectId, cancellationToken);
        if (!hasProjectRfi)
            return Result.Failure<PagedResult<PmEntityDto>>("Not found", "NOT_FOUND");

        return await ListAsync(Db.Set<RfiDistributionRecipient>().Where(a => !a.IsDeleted && a.RfiId == rfiId), query, cancellationToken);
    }
    public Task<Result<PmEntityDto>> CreateRfiCostLinkAsync(Guid projectId, Guid rfiId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<RfiCostImpactLink>(projectId, request with { ReferenceId = rfiId }, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateRfiCostLinkAsync(Guid projectId, Guid rfiId, Guid linkId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<RfiCostImpactLink>(projectId, linkId, request with { ReferenceId = rfiId }, cancellationToken);
    public async Task<Result<PagedResult<PmEntityDto>>> ListRfiCostLinksAsync(Guid projectId, Guid rfiId, PmListQuery query, CancellationToken cancellationToken = default)
    {
        var hasProjectRfi = await Db.Set<Rfi>().AnyAsync(r => !r.IsDeleted && r.Id == rfiId && r.ProjectId == projectId, cancellationToken);
        if (!hasProjectRfi)
            return Result.Failure<PagedResult<PmEntityDto>>("Not found", "NOT_FOUND");

        return await ListAsync(Db.Set<RfiCostImpactLink>().Where(a => !a.IsDeleted && a.RfiId == rfiId), query, cancellationToken);
    }
}

public class CommunicationService : PmServiceBase, ICommunicationService
{
    public CommunicationService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateCommunicationAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmCommunication>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetCommunicationAsync(Guid projectId, Guid communicationId, CancellationToken cancellationToken = default)
        => GetAsync<PmCommunication>(projectId, communicationId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListCommunicationsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmCommunication>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateCommunicationAsync(Guid projectId, Guid communicationId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmCommunication>(projectId, communicationId, request, cancellationToken);
    public Task<Result<PmEntityDto>> AddAttachmentAsync(Guid projectId, Guid communicationId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmCommunicationAttachment>(projectId, request with { ReferenceId = communicationId }, cancellationToken);
}

public class DailyReportService : PmServiceBase, IDailyReportService
{
    public DailyReportService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateDailyReportAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmDailyReport>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetDailyReportAsync(Guid projectId, Guid dailyReportId, CancellationToken cancellationToken = default)
        => GetAsync<PmDailyReport>(projectId, dailyReportId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListDailyReportsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmDailyReport>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateDailyReportAsync(Guid projectId, Guid dailyReportId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmDailyReport>(projectId, dailyReportId, request, cancellationToken);
    public async Task<Result<PmActionResultDto>> SubmitDailyReportAsync(Guid projectId, Guid dailyReportId, CancellationToken cancellationToken = default)
    {
        var dailyReport = await ProjectScoped<PmDailyReport>(projectId).FirstOrDefaultAsync(r => r.Id == dailyReportId, cancellationToken);
        if (dailyReport == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        dailyReport.Status = DailyReportStatus.Submitted;
        dailyReport.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Daily report submitted", dailyReportId, new { Status = dailyReport.Status.ToString() });
    }
    public async Task<Result<PmActionResultDto>> ApproveDailyReportAsync(Guid projectId, Guid dailyReportId, CancellationToken cancellationToken = default)
    {
        var dailyReport = await ProjectScoped<PmDailyReport>(projectId).FirstOrDefaultAsync(r => r.Id == dailyReportId, cancellationToken);
        if (dailyReport == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        dailyReport.Status = DailyReportStatus.Approved;
        dailyReport.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Daily report approved", dailyReportId, new { Status = dailyReport.Status.ToString() });
    }
    public Task<Result<PmEntityDto>> AddPhotoAsync(Guid projectId, Guid dailyReportId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmDailyReportPhoto>(projectId, request with { ReferenceId = dailyReportId }, cancellationToken);
    public async Task<Result<PmActionResultDto>> RollupDailyReportAsync(Guid projectId, Guid dailyReportId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        if (!request.ReferenceId.HasValue)
            return Result.Failure<PmActionResultDto>("ReferenceId (childDailyReportId) is required", "VALIDATION_ERROR");

        var parentExists = await ProjectScoped<PmDailyReport>(projectId).AnyAsync(r => r.Id == dailyReportId, cancellationToken);
        var childExists = await ProjectScoped<PmDailyReport>(projectId).AnyAsync(r => r.Id == request.ReferenceId.Value, cancellationToken);
        if (!parentExists || !childExists)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        var rollup = new PmDailyReportRollup
        {
            Id = Guid.NewGuid(),
            CompanyId = CurrentCompanyId,
            ParentDailyReportId = dailyReportId,
            ChildDailyReportId = request.ReferenceId.Value,
            CreatedAt = DateTime.UtcNow
        };

        Db.Set<PmDailyReportRollup>().Add(rollup);
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Daily report rollup complete", dailyReportId, new { rollup.Id });
    }
}

public class ProgressService : PmServiceBase, IProgressService
{
    public ProgressService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateProgressEntryAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmProgressEntry>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetProgressEntryAsync(Guid projectId, Guid progressEntryId, CancellationToken cancellationToken = default)
        => GetAsync<PmProgressEntry>(projectId, progressEntryId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListProgressEntriesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmProgressEntry>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateProgressEntryAsync(Guid projectId, Guid progressEntryId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmProgressEntry>(projectId, progressEntryId, request, cancellationToken);
    public async Task<Result<PmActionResultDto>> ApproveProgressEntryAsync(Guid projectId, Guid progressEntryId, CancellationToken cancellationToken = default)
    {
        var progressEntry = await ProjectScoped<PmProgressEntry>(projectId).FirstOrDefaultAsync(r => r.Id == progressEntryId, cancellationToken);
        if (progressEntry == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        progressEntry.Status = ProgressEntryStatus.Approved;
        progressEntry.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Progress entry approved", progressEntryId, new { Status = progressEntry.Status.ToString() });
    }
    public async Task<Result<PmActionResultDto>> LinkTimeEntryAsync(Guid projectId, Guid progressEntryId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        if (!request.ReferenceId.HasValue)
            return Result.Failure<PmActionResultDto>("ReferenceId (timeEntryId) is required", "VALIDATION_ERROR");

        var progressEntryExists = await ProjectScoped<PmProgressEntry>(projectId).AnyAsync(r => r.Id == progressEntryId, cancellationToken);
        if (!progressEntryExists)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        var link = new PmProgressTimeEntryLink
        {
            Id = Guid.NewGuid(),
            CompanyId = CurrentCompanyId,
            ProgressEntryId = progressEntryId,
            TimeEntryId = request.ReferenceId.Value,
            CreatedAt = DateTime.UtcNow
        };

        Db.Set<PmProgressTimeEntryLink>().Add(link);
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Time entry linked to progress entry", progressEntryId, new { link.Id, link.TimeEntryId });
    }
    public Task<Result<PagedResult<PmEntityDto>>> ListEarnedValueSnapshotsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmEarnedValueSnapshot>(projectId), query, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListSCurveAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmSCurvePoint>(projectId), query, cancellationToken);
}

public class ProjectionService : PmServiceBase, IProjectionService
{
    public ProjectionService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateMonthlyProjectionAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmMonthlyProjection>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetMonthlyProjectionAsync(Guid projectId, Guid projectionId, CancellationToken cancellationToken = default)
        => GetAsync<PmMonthlyProjection>(projectId, projectionId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListMonthlyProjectionsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmMonthlyProjection>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateMonthlyProjectionAsync(Guid projectId, Guid projectionId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmMonthlyProjection>(projectId, projectionId, request, cancellationToken);
    public async Task<Result<PmActionResultDto>> SubmitMonthlyProjectionAsync(Guid projectId, Guid projectionId, CancellationToken cancellationToken = default)
    {
        var projection = await ProjectScoped<PmMonthlyProjection>(projectId).FirstOrDefaultAsync(p => p.Id == projectionId, cancellationToken);
        if (projection == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        projection.ProjectionStatus = ProjectionStatus.Submitted;
        projection.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Projection submitted", projectionId, new { Status = projection.ProjectionStatus.ToString() });
    }
    public async Task<Result<PmActionResultDto>> ApproveMonthlyProjectionAsync(Guid projectId, Guid projectionId, CancellationToken cancellationToken = default)
    {
        var projection = await ProjectScoped<PmMonthlyProjection>(projectId).FirstOrDefaultAsync(p => p.Id == projectionId, cancellationToken);
        if (projection == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        projection.ProjectionStatus = ProjectionStatus.Approved;
        projection.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Projection approved", projectionId, new { Status = projection.ProjectionStatus.ToString() });
    }
}

public class MeetingService : PmServiceBase, IMeetingService
{
    public MeetingService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateMeetingSeriesAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmMeetingSeries>(projectId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListMeetingSeriesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmMeetingSeries>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> CreateMeetingAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmMeeting>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetMeetingAsync(Guid projectId, Guid meetingId, CancellationToken cancellationToken = default)
        => GetAsync<PmMeeting>(projectId, meetingId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListMeetingsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmMeeting>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateMeetingAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmMeeting>(projectId, meetingId, request, cancellationToken);
    public Task<Result<PmEntityDto>> AddAgendaItemAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmMeetingAgendaItem>(projectId, request with { ReferenceId = meetingId }, cancellationToken);
    public Task<Result<PmEntityDto>> AddMinutesAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmMeetingMinute>(projectId, request with { ReferenceId = meetingId }, cancellationToken);
    public Task<Result<PmEntityDto>> AddActionItemAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmMeetingActionItem>(projectId, request with { ReferenceId = meetingId }, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateActionItemAsync(Guid projectId, Guid meetingId, Guid actionItemId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmMeetingActionItem>(projectId, actionItemId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListMyActionItemsAsync(PmListQuery query, CancellationToken cancellationToken = default)
    {
        var actionItemQuery = Db.Set<PmMeetingActionItem>().AsQueryable();
        if (query.ProjectId.HasValue)
        {
            actionItemQuery = actionItemQuery.Where(a =>
                Db.Set<PmMeeting>().Any(m => m.Id == a.MeetingId && m.ProjectId == query.ProjectId.Value));
        }

        return ListAsync(actionItemQuery, query, cancellationToken);
    }
}

public class DocumentGenerationService : PmServiceBase, IDocumentGenerationService
{
    public DocumentGenerationService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateTemplateAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmDocumentTemplate>(projectId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListTemplatesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(Db.Set<PmDocumentTemplate>(), query, cancellationToken);
    public Task<Result<PmEntityDto>> GenerateDocumentAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmGeneratedDocument>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetGeneratedDocumentAsync(Guid projectId, Guid generatedDocumentId, CancellationToken cancellationToken = default)
        => GetAsync<PmGeneratedDocument>(projectId, generatedDocumentId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListGeneratedDocumentsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmGeneratedDocument>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> CreateLetterheadAsync(Guid companyId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmLetterheadConfig>(Guid.Empty, request with { Data = MergeData(request.Data, "CompanyId", companyId) }, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListLetterheadsAsync(Guid companyId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(Db.Set<PmLetterheadConfig>().Where(l => l.CompanyId == companyId), query, cancellationToken);

    private static Dictionary<string, object?> MergeData(Dictionary<string, object?>? data, string key, object value)
    {
        var merged = data is null
            ? new Dictionary<string, object?>()
            : new Dictionary<string, object?>(data);
        merged[key] = value;
        return merged;
    }
}

public class TaskService : PmServiceBase, ITaskService
{
    public TaskService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateTaskAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmTask>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetTaskAsync(Guid projectId, Guid taskId, CancellationToken cancellationToken = default)
        => GetAsync<PmTask>(projectId, taskId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListTasksAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmTask>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateTaskAsync(Guid projectId, Guid taskId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmTask>(projectId, taskId, request, cancellationToken);
    public Task<Result<PmEntityDto>> AddTaskCommentAsync(Guid projectId, Guid taskId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmTaskComment>(projectId, request with { ReferenceId = taskId }, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListMyTasksAsync(PmListQuery query, CancellationToken cancellationToken = default)
    {
        var taskQuery = Db.Set<PmTask>().AsQueryable();
        if (query.ProjectId.HasValue)
            taskQuery = taskQuery.Where(t => t.ProjectId == query.ProjectId.Value);

        return ListAsync(taskQuery, query, cancellationToken);
    }
}

public class NarrativeService : PmServiceBase, INarrativeService
{
    public NarrativeService(PitbullDbContext db, ICompanyContext companyContext) : base(db, companyContext) { }
    public Task<Result<PmEntityDto>> CreateNarrativeAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmProjectNarrative>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetNarrativeAsync(Guid projectId, Guid narrativeId, CancellationToken cancellationToken = default)
        => GetAsync<PmProjectNarrative>(projectId, narrativeId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListNarrativesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmProjectNarrative>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateNarrativeAsync(Guid projectId, Guid narrativeId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmProjectNarrative>(projectId, narrativeId, request, cancellationToken);
    public async Task<Result<PmActionResultDto>> SubmitNarrativeAsync(Guid projectId, Guid narrativeId, CancellationToken cancellationToken = default)
    {
        var narrative = await ProjectScoped<PmProjectNarrative>(projectId).FirstOrDefaultAsync(n => n.Id == narrativeId, cancellationToken);
        if (narrative == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        narrative.Status = NarrativeStatus.Submitted;
        narrative.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Narrative submitted", narrativeId, new { Status = narrative.Status.ToString() });
    }
    public async Task<Result<PmActionResultDto>> PublishNarrativeAsync(Guid projectId, Guid narrativeId, CancellationToken cancellationToken = default)
    {
        var narrative = await ProjectScoped<PmProjectNarrative>(projectId).FirstOrDefaultAsync(n => n.Id == narrativeId, cancellationToken);
        if (narrative == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        narrative.Status = NarrativeStatus.Published;
        narrative.FinalizedAt = DateTime.UtcNow;
        narrative.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Narrative published", narrativeId, new { Status = narrative.Status.ToString(), narrative.FinalizedAt });
    }
    public Task<Result<PagedResult<PmEntityDto>>> ListNarrativeRevisionsAsync(Guid projectId, Guid narrativeId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(Db.Set<PmProjectNarrativeRevision>().Where(r => r.NarrativeId == narrativeId), query, cancellationToken);
}
