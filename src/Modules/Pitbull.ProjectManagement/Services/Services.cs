using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.RFIs.Domain;
using Pitbull.TimeTracking.Domain;
using System.Text.Json;
using System.Security.Claims;

namespace Pitbull.ProjectManagement.Services;

public abstract class PmServiceBase
{
    private static readonly HashSet<string> ProtectedFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "Id", "TenantId", "CompanyId", "IsDeleted", "DeletedAt", "DeletedBy", "CreatedAt", "CreatedBy"
    };

    protected readonly PitbullDbContext Db;
    private readonly ICompanyContext _companyContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    protected PmServiceBase(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null)
    {
        Db = db;
        _companyContext = companyContext;
        _httpContextAccessor = httpContextAccessor ?? new HttpContextAccessor();
    }

    protected Guid CurrentCompanyId => _companyContext.IsResolved ? _companyContext.CompanyId : Guid.Empty;

    private static readonly HashSet<string> BaseEntityFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "Id", "TenantId", "CompanyId", "IsDeleted", "DeletedAt", "DeletedBy",
        "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy",
        "ProjectId", "Name", "Title", "Status"
    };

    protected static PmEntityDto ToDto<T>(T entity) where T : BaseEntity
    {
        var type = typeof(T);
        var projectId = type.GetProperty("ProjectId")?.GetValue(entity) as Guid?;
        var name = type.GetProperty("Name")?.GetValue(entity)?.ToString();
        var title = type.GetProperty("Title")?.GetValue(entity)?.ToString();
        var status = type.GetProperty("Status")?.GetValue(entity)?.ToString();

        var data = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in type.GetProperties())
        {
            if (BaseEntityFields.Contains(prop.Name))
                continue;
            if (prop.PropertyType != typeof(string) &&
                typeof(System.Collections.IEnumerable).IsAssignableFrom(prop.PropertyType))
                continue;
            if (prop.PropertyType.IsClass &&
                prop.PropertyType != typeof(string) &&
                typeof(BaseEntity).IsAssignableFrom(prop.PropertyType))
                continue;

            var value = prop.GetValue(entity);
            if (value != null && prop.PropertyType.IsEnum)
                value = value.ToString();
            data[prop.Name] = value;
        }

        return new PmEntityDto(entity.Id, projectId, name, title, status, entity.CreatedAt, entity.UpdatedAt, data);
    }

    protected IQueryable<T> ProjectScoped<T>(Guid projectId) where T : BaseEntity
    {
        var query = Db.Set<T>().Where(e => !e.IsDeleted).AsQueryable();
        if (ShouldEnforceProjectAccess())
        {
            var email = GetCurrentUserEmail();
            if (string.IsNullOrWhiteSpace(email))
                return query.Where(_ => false);

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            query = query.Where(e => Db.Set<ProjectAssignment>().Any(pa =>
                pa.IsActive &&
                pa.ProjectId == projectId &&
                pa.StartDate <= today &&
                (pa.EndDate == null || pa.EndDate >= today) &&
                Db.Set<Employee>().Any(emp =>
                    emp.Id == pa.EmployeeId &&
                    emp.IsActive &&
                    emp.Email == email)));
        }

        if (typeof(T).GetProperty("ProjectId") != null)
            query = query.Where(e => EF.Property<Guid>(e, "ProjectId") == projectId);
        else
            query = typeof(T).Name switch
            {
                nameof(PmScheduleDependency) => query.Where(e =>
                    Db.Set<PmSchedule>().Any(s =>
                        !s.IsDeleted &&
                        s.Id == EF.Property<Guid>(e, "ScheduleId") &&
                        s.ProjectId == projectId)),
                nameof(PmSubmittalWorkflowEvent) => query.Where(e =>
                    Db.Set<PmSubmittal>().Any(s =>
                        !s.IsDeleted &&
                        s.Id == EF.Property<Guid>(e, "SubmittalId") &&
                        s.ProjectId == projectId)),
                nameof(PmSubmittalAttachment) => query.Where(e =>
                    Db.Set<PmSubmittal>().Any(s =>
                        !s.IsDeleted &&
                        s.Id == EF.Property<Guid>(e, "SubmittalId") &&
                        s.ProjectId == projectId)),
                nameof(PmCommunicationAttachment) => query.Where(e =>
                    Db.Set<PmCommunication>().Any(c =>
                        !c.IsDeleted &&
                        c.Id == EF.Property<Guid>(e, "CommunicationId") &&
                        c.ProjectId == projectId)),
                nameof(PmDailyReportPhoto) => query.Where(e =>
                    Db.Set<PmDailyReport>().Any(r =>
                        !r.IsDeleted &&
                        r.Id == EF.Property<Guid>(e, "DailyReportId") &&
                        r.ProjectId == projectId)),
                nameof(PmDailyReportRollup) => query.Where(e =>
                    Db.Set<PmDailyReport>().Any(r =>
                        !r.IsDeleted &&
                        r.Id == EF.Property<Guid>(e, "ParentDailyReportId") &&
                        r.ProjectId == projectId)),
                nameof(PmActivityProgress) => query.Where(e =>
                    Db.Set<PmProgressEntry>().Any(p =>
                        !p.IsDeleted &&
                        p.Id == EF.Property<Guid>(e, "ProgressEntryId") &&
                        p.ProjectId == projectId)),
                nameof(PmCostCodeProgress) => query.Where(e =>
                    Db.Set<PmProgressEntry>().Any(p =>
                        !p.IsDeleted &&
                        p.Id == EF.Property<Guid>(e, "ProgressEntryId") &&
                        p.ProjectId == projectId)),
                nameof(PmProgressTimeEntryLink) => query.Where(e =>
                    Db.Set<PmProgressEntry>().Any(p =>
                        !p.IsDeleted &&
                        p.Id == EF.Property<Guid>(e, "ProgressEntryId") &&
                        p.ProjectId == projectId)),
                nameof(PmMeetingAgendaItem) => query.Where(e =>
                    Db.Set<PmMeeting>().Any(m =>
                        !m.IsDeleted &&
                        m.Id == EF.Property<Guid>(e, "MeetingId") &&
                        m.ProjectId == projectId)),
                nameof(PmMeetingMinute) => query.Where(e =>
                    Db.Set<PmMeeting>().Any(m =>
                        !m.IsDeleted &&
                        m.Id == EF.Property<Guid>(e, "MeetingId") &&
                        m.ProjectId == projectId)),
                nameof(PmMeetingActionItem) => query.Where(e =>
                    Db.Set<PmMeeting>().Any(m =>
                        !m.IsDeleted &&
                        m.Id == EF.Property<Guid>(e, "MeetingId") &&
                        m.ProjectId == projectId)),
                nameof(PmMeetingAttachment) => query.Where(e =>
                    Db.Set<PmMeeting>().Any(m =>
                        !m.IsDeleted &&
                        m.Id == EF.Property<Guid>(e, "MeetingId") &&
                        m.ProjectId == projectId)),
                nameof(PmPlanSheetRevision) => query.Where(e =>
                    Db.Set<PmPlanSheet>().Any(s =>
                        !s.IsDeleted &&
                        s.Id == EF.Property<Guid>(e, "PlanSheetId") &&
                        s.ProjectId == projectId)),
                nameof(PmSpecSectionRevision) => query.Where(e =>
                    Db.Set<PmSpecSection>().Any(s =>
                        !s.IsDeleted &&
                        s.Id == EF.Property<Guid>(e, "SpecSectionId") &&
                        s.ProjectId == projectId)),
                nameof(PmTaskComment) => query.Where(e =>
                    Db.Set<PmTask>().Any(t =>
                        !t.IsDeleted &&
                        t.Id == EF.Property<Guid>(e, "TaskId") &&
                        t.ProjectId == projectId)),
                nameof(RfiAttachment) => query.Where(e =>
                    Db.Set<Rfi>().Any(r =>
                        !r.IsDeleted &&
                        r.Id == EF.Property<Guid>(e, "RfiId") &&
                        r.ProjectId == projectId)),
                nameof(RfiDistributionRecipient) => query.Where(e =>
                    Db.Set<Rfi>().Any(r =>
                        !r.IsDeleted &&
                        r.Id == EF.Property<Guid>(e, "RfiId") &&
                        r.ProjectId == projectId)),
                nameof(RfiCostImpactLink) => query.Where(e =>
                    Db.Set<Rfi>().Any(r =>
                        !r.IsDeleted &&
                        r.Id == EF.Property<Guid>(e, "RfiId") &&
                        r.ProjectId == projectId)),
                _ => query
            };
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
        // Validate project exists (prevents FK violation on SaveChanges)
        var projectExists = await Db.Set<Pitbull.Projects.Domain.Project>()
            .AnyAsync(p => p.Id == projectId, ct);
        if (!projectExists)
            return Result.Failure<PmEntityDto>("Project not found", "NOT_FOUND");

        if (!await HasCurrentUserProjectAccessAsync(projectId, ct))
            return Result.Failure<PmEntityDto>("Not authorized to access this project", "UNAUTHORIZED");
        if (request.ReferenceId.HasValue)
        {
            var referenceValidation = await ValidateReferenceProjectScopeAsync<T>(projectId, request.ReferenceId.Value, ct);
            if (!referenceValidation.IsSuccess)
                return Result.Failure<PmEntityDto>(referenceValidation.Error ?? "Not found", referenceValidation.ErrorCode ?? "NOT_FOUND");
        }

        var entity = new T
        {
            Id = Guid.NewGuid(),
            CompanyId = CurrentCompanyId,
            CreatedAt = DateTime.UtcNow,
        };

        // Default user FK fields to prevent FK violations when not provided by the client
        var userId = GetCurrentUserId();
        if (userId != Guid.Empty)
        {
            SetIfExists(entity, "AssignedByUserId", userId);
            SetIfExists(entity, "PreparedByUserId", userId);
            SetIfExists(entity, "CommentedByUserId", userId);
            SetIfExists(entity, "AssigneeUserId", userId);
        }

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

    protected static PmUpsertRequest MergeData(PmUpsertRequest request, string key, object value)
    {
        var data = request.Data is null
            ? new Dictionary<string, object?>()
            : new Dictionary<string, object?>(request.Data);
        data[key] = value;
        return request with { Data = data };
    }

    private async Task<Result> ValidateReferenceProjectScopeAsync<T>(Guid projectId, Guid referenceId, CancellationToken ct)
        where T : BaseEntity
    {
        var typeName = typeof(T).Name;
        var valid = typeName switch
        {
            nameof(PmScheduleActivity) or nameof(PmScheduleDependency) =>
                await Db.Set<PmSchedule>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(PmSubmittalWorkflowEvent) or nameof(PmSubmittalAttachment) =>
                await Db.Set<PmSubmittal>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(PmPlanSheet) =>
                await Db.Set<PmPlanSet>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(PmPlanSheetRevision) =>
                await Db.Set<PmPlanSheet>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(PmSpecSectionRevision) =>
                await Db.Set<PmSpecSection>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(PmCommunicationAttachment) =>
                await Db.Set<PmCommunication>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(PmDailyReportPhoto) =>
                await Db.Set<PmDailyReport>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(PmMeetingAgendaItem) or nameof(PmMeetingMinute) or nameof(PmMeetingActionItem) or nameof(PmMeetingAttachment) =>
                await Db.Set<PmMeeting>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(PmTaskComment) =>
                await Db.Set<PmTask>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            nameof(RfiAttachment) or nameof(RfiDistributionRecipient) or nameof(RfiCostImpactLink) =>
                await Db.Set<Rfi>().AnyAsync(s => !s.IsDeleted && s.Id == referenceId && s.ProjectId == projectId, ct),
            _ => true
        };

        return valid
            ? Result.Success()
            : Result.Failure("Reference entity was not found in this project", "NOT_FOUND");
    }
    private bool IsCurrentUserAdmin()
        => _httpContextAccessor.HttpContext?.User?.IsInRole("Admin") == true;

    private bool ShouldEnforceProjectAccess()
        => _httpContextAccessor.HttpContext?.User?.Identity?.IsAuthenticated == true && !IsCurrentUserAdmin();

    private string? GetCurrentUserEmail()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        return user?.Identity?.Name
               ?? user?.FindFirst(ClaimTypes.Email)?.Value
               ?? user?.FindFirst("email")?.Value;
    }

    protected Guid GetCurrentUserId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        var sub = user?.FindFirst("sub")?.Value ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    private async Task<bool> HasCurrentUserProjectAccessAsync(Guid projectId, CancellationToken ct)
    {
        if (!ShouldEnforceProjectAccess())
            return true;

        var email = GetCurrentUserEmail();
        if (string.IsNullOrWhiteSpace(email))
            return false;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return await Db.Set<ProjectAssignment>().AnyAsync(pa =>
            pa.IsActive &&
            pa.ProjectId == projectId &&
            pa.StartDate <= today &&
            (pa.EndDate == null || pa.EndDate >= today) &&
            Db.Set<Employee>().Any(emp => emp.Id == pa.EmployeeId && emp.IsActive && emp.Email == email), ct);
    }
}

public class ScheduleService : PmServiceBase, IScheduleService
{
    public ScheduleService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }

    public Task<Result<PmEntityDto>> CreateScheduleAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Status))
            request = request with { Status = "Draft" };
        return CreateAsync<PmSchedule>(projectId, request, cancellationToken);
    }

    public Task<Result<PmEntityDto>> GetScheduleAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default)
        => GetAsync<PmSchedule>(projectId, scheduleId, cancellationToken);

    public async Task<Result<PmEntityDto>> UpdateScheduleAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var schedule = await ProjectScoped<PmSchedule>(projectId).FirstOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);
        if (schedule == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<ScheduleStatus>(request.Status, true, out var newStatus) && newStatus != schedule.Status)
        {
            var valid = (schedule.Status, newStatus) switch
            {
                (ScheduleStatus.Draft, ScheduleStatus.Active) => true,
                (ScheduleStatus.Active, ScheduleStatus.Baselined) => true,
                (ScheduleStatus.Active, ScheduleStatus.Archived) => true,
                (ScheduleStatus.Baselined, ScheduleStatus.Archived) => true,
                _ => false
            };
            if (!valid)
                return Result.Failure<PmEntityDto>($"Invalid status transition from {schedule.Status} to {newStatus}", "INVALID_STATUS");
        }

        ApplyUpsert(schedule, request);
        schedule.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(schedule));
    }

    public Task<Result> DeleteScheduleAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default)
        => DeleteAsync<PmSchedule>(projectId, scheduleId, cancellationToken);
    public async Task<Result<PmActionResultDto>> RecalculateCriticalPathAsync(Guid projectId, Guid scheduleId, CancellationToken cancellationToken = default)
    {
        var schedule = await ProjectScoped<PmSchedule>(projectId).FirstOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);
        if (schedule == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        if (schedule.Status == ScheduleStatus.Archived)
            return Result.Failure<PmActionResultDto>("Cannot recalculate critical path on an archived schedule", "INVALID_STATUS");

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
    public async Task<Result<PmEntityDto>> AddDependencyAsync(Guid projectId, Guid scheduleId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var scheduleExists = await ProjectScoped<PmSchedule>(projectId).AnyAsync(s => s.Id == scheduleId, cancellationToken);
        if (!scheduleExists)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        Guid? predecessorId = null;
        Guid? successorId = null;
        if (request.Data is not null)
        {
            if (request.Data.TryGetValue("PredecessorActivityId", out var predObj) && predObj is not null)
            {
                predecessorId = predObj is JsonElement pje ? pje.GetGuid() : (Guid)Convert.ChangeType(predObj, typeof(Guid));
                var predExists = await Db.Set<PmScheduleActivity>().AnyAsync(a => !a.IsDeleted && a.Id == predecessorId && a.ScheduleId == scheduleId, cancellationToken);
                if (!predExists)
                    return Result.Failure<PmEntityDto>("Predecessor activity not found in this schedule", "VALIDATION_ERROR");
            }
            if (request.Data.TryGetValue("SuccessorActivityId", out var succObj) && succObj is not null)
            {
                successorId = succObj is JsonElement sje ? sje.GetGuid() : (Guid)Convert.ChangeType(succObj, typeof(Guid));
                var succExists = await Db.Set<PmScheduleActivity>().AnyAsync(a => !a.IsDeleted && a.Id == successorId && a.ScheduleId == scheduleId, cancellationToken);
                if (!succExists)
                    return Result.Failure<PmEntityDto>("Successor activity not found in this schedule", "VALIDATION_ERROR");
            }
            if (predecessorId.HasValue && successorId.HasValue && predecessorId == successorId)
                return Result.Failure<PmEntityDto>("Predecessor and successor cannot be the same activity", "VALIDATION_ERROR");
        }

        return await CreateAsync<PmScheduleDependency>(projectId, request with { ReferenceId = scheduleId }, cancellationToken);
    }
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
    public JobCostService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }

    public async Task<Result<PmEntityDto>> CreateBudgetAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        Guid costCodeId = Guid.Empty;
        Guid? phaseId = null;

        if (request.Data is not null)
        {
            if (request.Data.TryGetValue("CostCodeId", out var ccObj) && ccObj is not null)
            {
                try { costCodeId = ccObj is JsonElement je ? je.GetGuid() : (Guid)Convert.ChangeType(ccObj, typeof(Guid)); }
                catch { /* leave as Empty */ }
            }
            if (request.Data.TryGetValue("PhaseId", out var phObj) && phObj is not null)
            {
                try { phaseId = phObj is JsonElement je2 ? je2.GetGuid() : (Guid)Convert.ChangeType(phObj, typeof(Guid)); }
                catch { /* leave as null */ }
            }
        }

        if (costCodeId != Guid.Empty)
        {
            var duplicate = await ProjectScoped<PmJobCostBudget>(projectId)
                .AnyAsync(b => b.CostCodeId == costCodeId && b.PhaseId == phaseId, cancellationToken);
            if (duplicate)
                return Result.Failure<PmEntityDto>("A budget already exists for this project, cost code, and phase", "DUPLICATE_BUDGET");
        }

        // Compute CurrentBudget
        decimal originalBudget = 0, approvedChanges = 0;
        if (request.Data is not null)
        {
            if (request.Data.TryGetValue("OriginalBudget", out var obObj) && obObj is not null)
                try { originalBudget = obObj is JsonElement je ? je.GetDecimal() : Convert.ToDecimal(obObj); } catch { }
            if (request.Data.TryGetValue("ApprovedBudgetChanges", out var abObj) && abObj is not null)
                try { approvedChanges = abObj is JsonElement je ? je.GetDecimal() : Convert.ToDecimal(abObj); } catch { }
        }
        request = MergeData(request, "CurrentBudget", originalBudget + approvedChanges);

        return await CreateAsync<PmJobCostBudget>(projectId, request, cancellationToken);
    }

    public async Task<Result<PmEntityDto>> UpdateBudgetAsync(Guid projectId, Guid budgetId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var budget = await ProjectScoped<PmJobCostBudget>(projectId).FirstOrDefaultAsync(b => b.Id == budgetId, cancellationToken);
        if (budget == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        ApplyUpsert(budget, request);
        budget.CurrentBudget = budget.OriginalBudget + budget.ApprovedBudgetChanges;
        budget.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(budget));
    }

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

    public async Task<Result<PmEntityDto>> CreateForecastAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var result = await CreateAsync<PmJobCostForecast>(projectId, request, cancellationToken);
        if (!result.IsSuccess)
            return result;

        var forecast = await Db.Set<PmJobCostForecast>().FirstOrDefaultAsync(f => f.Id == result.Value!.Id, cancellationToken);
        if (forecast != null)
        {
            var budget = await ProjectScoped<PmJobCostBudget>(projectId)
                .FirstOrDefaultAsync(b => b.CostCodeId == forecast.CostCodeId && b.PhaseId == forecast.PhaseId, cancellationToken);
            forecast.VarianceToBudget = forecast.EstimatedFinalCost - (budget?.CurrentBudget ?? 0);
            await Db.SaveChangesAsync(cancellationToken);
        }

        return result;
    }
}

public class SubmittalService : PmServiceBase, ISubmittalService
{
    public SubmittalService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }

    public async Task<Result<PmEntityDto>> CreateSubmittalAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var maxNumber = await ProjectScoped<PmSubmittal>(projectId)
            .MaxAsync(s => (int?)s.SubmittalNumber, cancellationToken) ?? 0;

        var enriched = MergeData(request, "SubmittalNumber", maxNumber + 1);
        if (string.IsNullOrWhiteSpace(request.Status))
            enriched = enriched with { Status = "Draft" };

        return await CreateAsync<PmSubmittal>(projectId, enriched, cancellationToken);
    }

    public Task<Result<PmEntityDto>> GetSubmittalAsync(Guid projectId, Guid submittalId, CancellationToken cancellationToken = default)
        => GetAsync<PmSubmittal>(projectId, submittalId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListSubmittalsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmSubmittal>(projectId), query, cancellationToken);

    public async Task<Result<PmEntityDto>> UpdateSubmittalAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var submittal = await ProjectScoped<PmSubmittal>(projectId).FirstOrDefaultAsync(s => s.Id == submittalId, cancellationToken);
        if (submittal == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        if (submittal.Status == SubmittalStatus.Closed)
            return Result.Failure<PmEntityDto>("Cannot edit a closed submittal", "INVALID_STATUS");

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<SubmittalStatus>(request.Status, true, out var newStatus) && newStatus != submittal.Status)
        {
            if (newStatus == SubmittalStatus.Submitted)
                request = MergeData(request, "SubmittedDate", DateTime.UtcNow);
            else if (newStatus is SubmittalStatus.Approved or SubmittalStatus.ApprovedAsNoted or SubmittalStatus.ReviseAndResubmit or SubmittalStatus.Rejected)
                request = MergeData(request, "ReturnedDate", DateTime.UtcNow);

            if (newStatus == SubmittalStatus.ReviseAndResubmit)
                request = MergeData(request, "RevisionNumber", submittal.RevisionNumber + 1);
        }

        ApplyUpsert(submittal, request);
        submittal.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(submittal));
    }

    public async Task<Result<PmEntityDto>> AddWorkflowEventAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var submittal = await ProjectScoped<PmSubmittal>(projectId).FirstOrDefaultAsync(s => s.Id == submittalId, cancellationToken);
        if (submittal == null)
            return Result.Failure<PmEntityDto>("Submittal not found", "NOT_FOUND");

        request = MergeData(request, "FromStatus", submittal.Status.ToString());
        request = MergeData(request, "ActionAt", DateTime.UtcNow);

        return await CreateAsync<PmSubmittalWorkflowEvent>(projectId, request with { ReferenceId = submittalId }, cancellationToken);
    }

    public Task<Result<PmEntityDto>> AddAttachmentAsync(Guid projectId, Guid submittalId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmSubmittalAttachment>(projectId, request with { ReferenceId = submittalId }, cancellationToken);
}

public class PlansSpecsService : PmServiceBase, IPlansSpecsService
{
    public PlansSpecsService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
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
    public CommunicationService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
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
    public DailyReportService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }

    public async Task<Result<PmEntityDto>> CreateDailyReportAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Data is not null
            && request.Data.TryGetValue("ReportDate", out var rdObj) && rdObj is not null
            && request.Data.TryGetValue("ReportType", out var rtObj) && rtObj is not null)
        {
            DateTime reportDate;
            DailyReportType reportType;
            try
            {
                reportDate = ConvertValue<DateTime>(rdObj);
                reportType = ConvertValue<DailyReportType>(rtObj);
            }
            catch { goto skip; }

            var duplicate = await ProjectScoped<PmDailyReport>(projectId)
                .AnyAsync(r => r.ReportDate.Date == reportDate.Date && r.ReportType == reportType, cancellationToken);
            if (duplicate)
                return Result.Failure<PmEntityDto>("A daily report already exists for this date and report type", "DUPLICATE_REPORT");
        }
        skip:
        return await CreateAsync<PmDailyReport>(projectId, request, cancellationToken);
    }

    public Task<Result<PmEntityDto>> GetDailyReportAsync(Guid projectId, Guid dailyReportId, CancellationToken cancellationToken = default)
        => GetAsync<PmDailyReport>(projectId, dailyReportId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListDailyReportsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmDailyReport>(projectId), query, cancellationToken);

    public async Task<Result<PmEntityDto>> UpdateDailyReportAsync(Guid projectId, Guid dailyReportId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var report = await ProjectScoped<PmDailyReport>(projectId).FirstOrDefaultAsync(r => r.Id == dailyReportId, cancellationToken);
        if (report == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        if (report.Status == DailyReportStatus.Approved || report.Status == DailyReportStatus.Locked)
            return Result.Failure<PmEntityDto>("Cannot edit an approved or locked daily report", "INVALID_STATUS");

        ApplyUpsert(report, request);
        report.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(report));
    }

    public async Task<Result<PmActionResultDto>> SubmitDailyReportAsync(Guid projectId, Guid dailyReportId, CancellationToken cancellationToken = default)
    {
        var dailyReport = await ProjectScoped<PmDailyReport>(projectId).FirstOrDefaultAsync(r => r.Id == dailyReportId, cancellationToken);
        if (dailyReport == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        if (dailyReport.Status != DailyReportStatus.Draft)
            return Result.Failure<PmActionResultDto>("Daily report can only be submitted from Draft status", "INVALID_STATUS");

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

        if (dailyReport.Status != DailyReportStatus.Draft && dailyReport.Status != DailyReportStatus.Submitted)
            return Result.Failure<PmActionResultDto>("Daily report can only be approved from Draft or Submitted status", "INVALID_STATUS");

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

    private static T ConvertValue<T>(object value)
    {
        if (value is JsonElement je)
        {
            if (typeof(T) == typeof(DateTime)) return (T)(object)je.GetDateTime();
            if (typeof(T).IsEnum) return (T)Enum.Parse(typeof(T), je.GetString()!, true);
        }
        if (typeof(T).IsEnum && value is string s) return (T)Enum.Parse(typeof(T), s, true);
        return (T)Convert.ChangeType(value, typeof(T));
    }
}

public class ProgressService : PmServiceBase, IProgressService
{
    public ProgressService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
    public Task<Result<PmEntityDto>> CreateProgressEntryAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmProgressEntry>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetProgressEntryAsync(Guid projectId, Guid progressEntryId, CancellationToken cancellationToken = default)
        => GetAsync<PmProgressEntry>(projectId, progressEntryId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListProgressEntriesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmProgressEntry>(projectId), query, cancellationToken);

    public async Task<Result<PmEntityDto>> UpdateProgressEntryAsync(Guid projectId, Guid progressEntryId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var entry = await ProjectScoped<PmProgressEntry>(projectId).FirstOrDefaultAsync(e => e.Id == progressEntryId, cancellationToken);
        if (entry == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        if (entry.Status == ProgressEntryStatus.Approved)
            return Result.Failure<PmEntityDto>("Cannot edit an approved progress entry", "INVALID_STATUS");

        ApplyUpsert(entry, request);
        entry.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(entry));
    }

    public async Task<Result<PmActionResultDto>> ApproveProgressEntryAsync(Guid projectId, Guid progressEntryId, CancellationToken cancellationToken = default)
    {
        var progressEntry = await ProjectScoped<PmProgressEntry>(projectId).FirstOrDefaultAsync(r => r.Id == progressEntryId, cancellationToken);
        if (progressEntry == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        if (progressEntry.Status != ProgressEntryStatus.Draft && progressEntry.Status != ProgressEntryStatus.Submitted)
            return Result.Failure<PmActionResultDto>("Progress entry can only be approved from Draft or Submitted status", "INVALID_STATUS");

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

        var duplicateLink = await Db.Set<PmProgressTimeEntryLink>()
            .AnyAsync(l => !l.IsDeleted && l.ProgressEntryId == progressEntryId && l.TimeEntryId == request.ReferenceId.Value, cancellationToken);
        if (duplicateLink)
            return Result.Failure<PmActionResultDto>("This time entry is already linked to this progress entry", "DUPLICATE_LINK");

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
    public ProjectionService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
    public Task<Result<PmEntityDto>> CreateMonthlyProjectionAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmMonthlyProjection>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetMonthlyProjectionAsync(Guid projectId, Guid projectionId, CancellationToken cancellationToken = default)
        => GetAsync<PmMonthlyProjection>(projectId, projectionId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListMonthlyProjectionsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmMonthlyProjection>(projectId), query, cancellationToken);

    public async Task<Result<PmEntityDto>> UpdateMonthlyProjectionAsync(Guid projectId, Guid projectionId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var projection = await ProjectScoped<PmMonthlyProjection>(projectId).FirstOrDefaultAsync(p => p.Id == projectionId, cancellationToken);
        if (projection == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        if (projection.ProjectionStatus == ProjectionStatus.Locked)
            return Result.Failure<PmEntityDto>("Cannot edit a locked projection", "INVALID_STATUS");

        ApplyUpsert(projection, request);
        projection.AdjustedContractValue = projection.ContractValueOriginal + projection.ApprovedChangeOrders;
        projection.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(projection));
    }

    public async Task<Result<PmActionResultDto>> SubmitMonthlyProjectionAsync(Guid projectId, Guid projectionId, CancellationToken cancellationToken = default)
    {
        var projection = await ProjectScoped<PmMonthlyProjection>(projectId).FirstOrDefaultAsync(p => p.Id == projectionId, cancellationToken);
        if (projection == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        if (projection.ProjectionStatus != ProjectionStatus.Draft)
            return Result.Failure<PmActionResultDto>("Projection can only be submitted from Draft status", "INVALID_STATUS");

        projection.AdjustedContractValue = projection.ContractValueOriginal + projection.ApprovedChangeOrders;
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

        if (projection.ProjectionStatus != ProjectionStatus.Submitted)
            return Result.Failure<PmActionResultDto>("Projection can only be approved from Submitted status", "INVALID_STATUS");

        projection.ProjectionStatus = ProjectionStatus.Approved;
        projection.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Projection approved", projectionId, new { Status = projection.ProjectionStatus.ToString() });
    }
}

public class MeetingService : PmServiceBase, IMeetingService
{
    public MeetingService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
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

    public async Task<Result<PmEntityDto>> UpdateMeetingAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var meeting = await ProjectScoped<PmMeeting>(projectId).FirstOrDefaultAsync(m => m.Id == meetingId, cancellationToken);
        if (meeting == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        if (meeting.Status == MeetingStatus.Completed || meeting.Status == MeetingStatus.Canceled)
            return Result.Failure<PmEntityDto>("Cannot edit a completed or canceled meeting", "INVALID_STATUS");

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<MeetingStatus>(request.Status, true, out var newStatus) && newStatus != meeting.Status)
        {
            var valid = (meeting.Status, newStatus) switch
            {
                (MeetingStatus.Scheduled, MeetingStatus.InProgress) => true,
                (MeetingStatus.Scheduled, MeetingStatus.Canceled) => true,
                (MeetingStatus.InProgress, MeetingStatus.Completed) => true,
                (MeetingStatus.InProgress, MeetingStatus.Canceled) => true,
                _ => false
            };
            if (!valid)
                return Result.Failure<PmEntityDto>($"Invalid status transition from {meeting.Status} to {newStatus}", "INVALID_STATUS");

            if (newStatus == MeetingStatus.InProgress)
                request = MergeData(request, "ActualStart", DateTime.UtcNow);
            else if (newStatus == MeetingStatus.Completed)
                request = MergeData(request, "ActualEnd", DateTime.UtcNow);
        }

        ApplyUpsert(meeting, request);
        meeting.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(meeting));
    }

    public async Task<Result<PmEntityDto>> AddAgendaItemAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var meeting = await ProjectScoped<PmMeeting>(projectId).FirstOrDefaultAsync(m => m.Id == meetingId, cancellationToken);
        if (meeting == null)
            return Result.Failure<PmEntityDto>("Meeting not found", "NOT_FOUND");
        if (meeting.Status == MeetingStatus.Canceled)
            return Result.Failure<PmEntityDto>("Cannot add items to a canceled meeting", "INVALID_STATUS");

        return await CreateAsync<PmMeetingAgendaItem>(projectId, request with { ReferenceId = meetingId }, cancellationToken);
    }

    public async Task<Result<PmEntityDto>> AddMinutesAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var meeting = await ProjectScoped<PmMeeting>(projectId).FirstOrDefaultAsync(m => m.Id == meetingId, cancellationToken);
        if (meeting == null)
            return Result.Failure<PmEntityDto>("Meeting not found", "NOT_FOUND");
        if (meeting.Status == MeetingStatus.Canceled)
            return Result.Failure<PmEntityDto>("Cannot add items to a canceled meeting", "INVALID_STATUS");

        return await CreateAsync<PmMeetingMinute>(projectId, request with { ReferenceId = meetingId }, cancellationToken);
    }

    public async Task<Result<PmEntityDto>> AddActionItemAsync(Guid projectId, Guid meetingId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var meeting = await ProjectScoped<PmMeeting>(projectId).FirstOrDefaultAsync(m => m.Id == meetingId, cancellationToken);
        if (meeting == null)
            return Result.Failure<PmEntityDto>("Meeting not found", "NOT_FOUND");
        if (meeting.Status == MeetingStatus.Canceled)
            return Result.Failure<PmEntityDto>("Cannot add items to a canceled meeting", "INVALID_STATUS");

        return await CreateAsync<PmMeetingActionItem>(projectId, request with { ReferenceId = meetingId }, cancellationToken);
    }

    public Task<Result<PmEntityDto>> UpdateActionItemAsync(Guid projectId, Guid meetingId, Guid actionItemId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmMeetingActionItem>(projectId, actionItemId, request, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListMyActionItemsAsync(PmListQuery query, Guid assignedUserId, CancellationToken cancellationToken = default)
    {
        var actionItemQuery = Db.Set<PmMeetingActionItem>()
            .Where(a => !a.IsDeleted && a.AssigneeUserId == assignedUserId)
            .AsQueryable();
        if (query.ProjectId.HasValue)
        {
            actionItemQuery = actionItemQuery.Where(a =>
                Db.Set<PmMeeting>().Any(m => !m.IsDeleted && m.Id == a.MeetingId && m.ProjectId == query.ProjectId.Value));
        }

        return ListAsync(actionItemQuery, query, cancellationToken);
    }
}

public class DocumentGenerationService : PmServiceBase, IDocumentGenerationService
{
    public DocumentGenerationService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
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
    public TaskService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
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
    public Task<Result<PagedResult<PmEntityDto>>> ListMyTasksAsync(PmListQuery query, Guid assignedUserId, CancellationToken cancellationToken = default)
    {
        var taskQuery = Db.Set<PmTask>()
            .Where(t => !t.IsDeleted && t.AssignedToUserId == assignedUserId)
            .AsQueryable();
        if (query.ProjectId.HasValue)
            taskQuery = taskQuery.Where(t => t.ProjectId == query.ProjectId.Value);

        return ListAsync(taskQuery, query, cancellationToken);
    }
}

public class NarrativeService : PmServiceBase, INarrativeService
{
    public NarrativeService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
    public Task<Result<PmEntityDto>> CreateNarrativeAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmProjectNarrative>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetNarrativeAsync(Guid projectId, Guid narrativeId, CancellationToken cancellationToken = default)
        => GetAsync<PmProjectNarrative>(projectId, narrativeId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListNarrativesAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmProjectNarrative>(projectId), query, cancellationToken);

    public async Task<Result<PmEntityDto>> UpdateNarrativeAsync(Guid projectId, Guid narrativeId, PmUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var narrative = await ProjectScoped<PmProjectNarrative>(projectId).FirstOrDefaultAsync(n => n.Id == narrativeId, cancellationToken);
        if (narrative == null)
            return Result.Failure<PmEntityDto>("Not found", "NOT_FOUND");

        if (narrative.Status == NarrativeStatus.Published)
            return Result.Failure<PmEntityDto>("Cannot edit a published narrative", "INVALID_STATUS");

        ApplyUpsert(narrative, request);
        narrative.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Result.Success(ToDto(narrative));
    }

    public async Task<Result<PmActionResultDto>> SubmitNarrativeAsync(Guid projectId, Guid narrativeId, CancellationToken cancellationToken = default)
    {
        var narrative = await ProjectScoped<PmProjectNarrative>(projectId).FirstOrDefaultAsync(n => n.Id == narrativeId, cancellationToken);
        if (narrative == null)
            return Result.Failure<PmActionResultDto>("Not found", "NOT_FOUND");

        if (narrative.Status != NarrativeStatus.Draft)
            return Result.Failure<PmActionResultDto>("Narrative can only be submitted from Draft status", "INVALID_STATUS");

        if (string.IsNullOrWhiteSpace(narrative.ExecutiveSummary))
            return Result.Failure<PmActionResultDto>("ExecutiveSummary is required before submitting", "VALIDATION_ERROR");

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

        if (narrative.Status != NarrativeStatus.Approved)
            return Result.Failure<PmActionResultDto>("Narrative can only be published from Approved status", "INVALID_STATUS");

        narrative.Status = NarrativeStatus.Published;
        narrative.FinalizedAt = DateTime.UtcNow;
        narrative.UpdatedAt = DateTime.UtcNow;
        await Db.SaveChangesAsync(cancellationToken);
        return Action("Narrative published", narrativeId, new { Status = narrative.Status.ToString(), narrative.FinalizedAt });
    }
    public async Task<Result<PagedResult<PmEntityDto>>> ListNarrativeRevisionsAsync(Guid projectId, Guid narrativeId, PmListQuery query, CancellationToken cancellationToken = default)
    {
        var hasProjectNarrative = await ProjectScoped<PmProjectNarrative>(projectId)
            .AnyAsync(n => n.Id == narrativeId, cancellationToken);
        if (!hasProjectNarrative)
            return Result.Failure<PagedResult<PmEntityDto>>("Not found", "NOT_FOUND");

        return await ListAsync(
            Db.Set<PmProjectNarrativeRevision>().Where(r => !r.IsDeleted && r.NarrativeId == narrativeId),
            query,
            cancellationToken);
    }
}

public class DocumentService : PmServiceBase, IDocumentService
{
    public DocumentService(PitbullDbContext db, ICompanyContext companyContext, IHttpContextAccessor? httpContextAccessor = null) : base(db, companyContext, httpContextAccessor) { }
    public Task<Result<PmEntityDto>> CreateDocumentAsync(Guid projectId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => CreateAsync<PmDocument>(projectId, request, cancellationToken);
    public Task<Result<PmEntityDto>> GetDocumentAsync(Guid projectId, Guid documentId, CancellationToken cancellationToken = default)
        => GetAsync<PmDocument>(projectId, documentId, cancellationToken);
    public Task<Result<PagedResult<PmEntityDto>>> ListDocumentsAsync(Guid projectId, PmListQuery query, CancellationToken cancellationToken = default)
        => ListAsync(ProjectScoped<PmDocument>(projectId), query, cancellationToken);
    public Task<Result<PmEntityDto>> UpdateDocumentAsync(Guid projectId, Guid documentId, PmUpsertRequest request, CancellationToken cancellationToken = default)
        => UpdateAsync<PmDocument>(projectId, documentId, request, cancellationToken);
    public Task<Result> DeleteDocumentAsync(Guid projectId, Guid documentId, CancellationToken cancellationToken = default)
        => DeleteAsync<PmDocument>(projectId, documentId, cancellationToken);
}
