using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.GetProjectPhases;
using Pitbull.Projects.Features.GetProjectRfiCostSummary;
using Pitbull.Projects.Features.GetProjectStats;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;
using Pitbull.RFIs.Domain;
using Pitbull.Core.Logging;

namespace Pitbull.Projects.Services;

/// <summary>
/// Direct service implementation for project operations, replacing MediatR handlers.
/// Provides clean, testable methods for all project-related business logic.
/// </summary>
public class ProjectService : IProjectService
{
    private readonly PitbullDbContext _db;
    private readonly ICompanyContext _companyContext;
    private readonly IProjectTeamAssignmentService _teamAssignmentService;
    private readonly IValidator<CreateProjectCommand> _createValidator;
    private readonly IValidator<UpdateProjectCommand> _updateValidator;
    private readonly IHttpContextAccessor? _httpContextAccessor;
    private readonly ILogger<ProjectService> _logger;

    public ProjectService(
        PitbullDbContext db,
        ICompanyContext companyContext,
        IProjectTeamAssignmentService teamAssignmentService,
        IValidator<CreateProjectCommand> createValidator,
        IValidator<UpdateProjectCommand> updateValidator,
        IHttpContextAccessor? httpContextAccessor,
        ILogger<ProjectService> logger)
    {
        _db = db;
        _companyContext = companyContext;
        _teamAssignmentService = teamAssignmentService;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    private string GetCurrentUserId()
    {
        var user = _httpContextAccessor?.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? user.FindFirstValue("sub");
            if (!string.IsNullOrEmpty(userId))
                return userId;
        }
        return "system";
    }

    public async Task<Result<ProjectDto>> GetProjectAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found", id);
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
        }

        return Result.Success(MapToDto(project));
    }

    public async Task<Result<PagedResult<ProjectDto>>> GetProjectsAsync(ListProjectsQuery listQuery, CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.Set<Project>().AsNoTracking().Where(p => !p.IsDeleted);

        // Apply filtering logic (from ListProjectsHandler)
        if (!string.IsNullOrWhiteSpace(listQuery.Search))
        {
            var searchTerm = listQuery.Search.ToLower();
            dbQuery = dbQuery.Where(p =>
                p.Name.ToLower().Contains(searchTerm.ToLower()) ||
                p.Number.ToLower().Contains(searchTerm) ||
                (p.ClientName != null && p.ClientName.ToLower().Contains(searchTerm.ToLower())));
        }

        if (listQuery.Status.HasValue)
        {
            dbQuery = dbQuery.Where(p => p.Status == listQuery.Status.Value);
        }

        if (listQuery.Type.HasValue)
        {
            dbQuery = dbQuery.Where(p => p.Type == listQuery.Type.Value);
        }

        // Matches RoleDashboardSummary ActiveProjectCount: Status != Completed
        if (listQuery.ExcludeCompleted)
        {
            dbQuery = dbQuery.Where(p => p.Status != ProjectStatus.Completed);
        }

        var needsEnrichment = listQuery.UnbilledOnly || listQuery.BudgetAlert;

        if (!needsEnrichment)
        {
            var totalCount = await dbQuery.CountAsync(cancellationToken);
            var projects = await dbQuery
                .OrderByDescending(p => p.CreatedAt)
                .Skip((listQuery.Page - 1) * listQuery.PageSize)
                .Take(listQuery.PageSize)
                .ToArrayAsync(cancellationToken);

            var dtos = projects.Select(p => MapToDto(p)).ToArray();
            return Result.Success(new PagedResult<ProjectDto>(dtos, totalCount, listQuery.Page, listQuery.PageSize));
        }

        // Unbilled / budget-alert need billing + labor enrichment before pagination.
        var all = await dbQuery
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);

        var projectIds = all.Select(p => p.Id).ToList();
        var billedByProject = await GetBilledToDateByProjectAsync(projectIds, cancellationToken);
        Dictionary<Guid, decimal>? laborByProject = null;
        if (listQuery.BudgetAlert)
            laborByProject = await GetLaborSpentByProjectAsync(projectIds, cancellationToken);

        var threshold = listQuery.BudgetAlertPercent <= 0 ? 75 : listQuery.BudgetAlertPercent;
        var enriched = new List<(Project Project, decimal Billed, decimal Unbilled, decimal Labor, decimal LaborPct)>();

        foreach (var p in all)
        {
            billedByProject.TryGetValue(p.Id, out var billed);
            var unbilled = Math.Max(0m, p.ContractAmount - billed);
            var labor = 0m;
            laborByProject?.TryGetValue(p.Id, out labor);
            var laborPct = p.ContractAmount <= 0 ? 0m : (labor / p.ContractAmount) * 100m;

            if (listQuery.UnbilledOnly)
            {
                if (p.Status == ProjectStatus.Completed || p.Status == ProjectStatus.Closed)
                    continue;
                if (unbilled < 0.01m)
                    continue;
            }

            if (listQuery.BudgetAlert && laborPct < threshold)
                continue;

            enriched.Add((p, billed, unbilled, labor, laborPct));
        }

        // Sort unbilled by remaining $ desc; budget alert by labor % desc
        if (listQuery.UnbilledOnly)
            enriched = enriched.OrderByDescending(x => x.Unbilled).ToList();
        else if (listQuery.BudgetAlert)
            enriched = enriched.OrderByDescending(x => x.LaborPct).ToList();

        var total = enriched.Count;
        var pageItems = enriched
            .Skip((listQuery.Page - 1) * listQuery.PageSize)
            .Take(listQuery.PageSize)
            .Select(x => MapToDto(x.Project, x.Billed, x.Unbilled, x.Labor, x.LaborPct))
            .ToArray();

        return Result.Success(new PagedResult<ProjectDto>(pageItems, total, listQuery.Page, listQuery.PageSize));
    }

    private async Task<Dictionary<Guid, decimal>> GetBilledToDateByProjectAsync(
        IReadOnlyList<Guid> projectIds, CancellationToken ct)
    {
        if (projectIds.Count == 0)
            return new Dictionary<Guid, decimal>();

        var apps = await _db.Set<BillingApplication>().AsNoTracking()
            .Where(a => projectIds.Contains(a.ProjectId)
                        && a.Status != BillingApplicationStatus.Void
                        && a.Status != BillingApplicationStatus.Draft)
            .Select(a => new { a.ProjectId, a.ApplicationNumber, a.TotalCompletedAndStoredToDate })
            .ToListAsync(ct);

        return apps
            .GroupBy(a => a.ProjectId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(x => x.ApplicationNumber).First().TotalCompletedAndStoredToDate);
    }

    private async Task<Dictionary<Guid, decimal>> GetLaborSpentByProjectAsync(
        IReadOnlyList<Guid> projectIds, CancellationToken ct)
    {
        if (projectIds.Count == 0)
            return new Dictionary<Guid, decimal>();

        // Mirror dashboard analytics labor proxy (approved time × rates).
        try
        {
            var rows = await _db.Database.SqlQueryRaw<ProjectLaborSpendRow>(
                    """
                    SELECT te."ProjectId" AS "ProjectId",
                           COALESCE(SUM(
                               (te."RegularHours" * COALESCE(e."BaseHourlyRate", 0)) +
                               (te."OvertimeHours" * COALESCE(e."BaseHourlyRate", 0) * 1.5) +
                               (te."DoubletimeHours" * COALESCE(e."BaseHourlyRate", 0) * 2.0)
                           ), 0) AS "Spent"
                    FROM time_entries te
                    LEFT JOIN employees e ON te."EmployeeId" = e."Id"
                    WHERE te."IsDeleted" = false
                      AND te."Status" = 1
                    GROUP BY te."ProjectId"
                    """)
                .ToListAsync(ct);

            return rows
                .Where(r => projectIds.Contains(r.ProjectId))
                .ToDictionary(r => r.ProjectId, r => r.Spent);
        }
        catch (Exception ex)
        {
            // In-memory tests / non-relational providers: skip labor filter data
            _logger.LogDebug(ex, "Labor spend aggregation unavailable for project list filter");
            return new Dictionary<Guid, decimal>();
        }
    }

    public async Task<Result<ProjectDto>> CreateProjectAsync(CreateProjectCommand request, CancellationToken cancellationToken = default)
    {
        // Validate request
        var validationResult = await _createValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            _logger.LogWarning("Project creation validation failed: {Errors}", errors);
            return Result.Failure<ProjectDto>(errors, "VALIDATION_ERROR");
        }

        // Create project entity
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Number = request.Number,
            Description = request.Description,
            Status = ProjectStatus.PreConstruction,
            Type = request.Type,
            Address = request.Address,
            City = request.City,
            State = request.State,
            ZipCode = request.ZipCode,
            ClientName = request.ClientName,
            ClientContact = request.ClientContact,
            ClientEmail = request.ClientEmail,
            ClientPhone = request.ClientPhone,
            StartDate = request.StartDate,
            EstimatedCompletionDate = request.EstimatedCompletionDate,
            ContractAmount = request.ContractAmount,
            ProjectManagerId = request.ProjectManagerId,
            SuperintendentId = request.SuperintendentId,
            SourceBidId = request.SourceBidId,
            CreatedAt = DateTime.UtcNow
        };

        if (_companyContext.IsResolved)
            project.CompanyId = _companyContext.CompanyId;

        _db.Set<Project>().Add(project);

        ProjectSettings projectSettings = new();
        if (_companyContext.IsResolved)
        {
            Company? company = await _db.Set<Company>()
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == _companyContext.CompanyId, cancellationToken);
            if (company is not null)
                projectSettings = company.ProjectSettings;
        }

        List<CreateProjectPhaseInput> phasesToCreate;
        if (request.Phases is { Count: > 0 })
        {
            phasesToCreate = request.Phases;
        }
        else if (projectSettings.AutoCreatePhases)
        {
            phasesToCreate =
            [
                new CreateProjectPhaseInput("Preconstruction", "01000"),
                new CreateProjectPhaseInput("Construction", "05000"),
                new CreateProjectPhaseInput("Closeout", "01700")
            ];
        }
        else
        {
            phasesToCreate = [];
        }

        for (int i = 0; i < phasesToCreate.Count; i++)
        {
            CreateProjectPhaseInput phaseInput = phasesToCreate[i];
            _db.Set<Phase>().Add(new Phase
            {
                ProjectId = project.Id,
                Name = phaseInput.Name,
                CostCode = phaseInput.CostCode,
                BudgetAmount = phaseInput.BudgetAmount,
                SortOrder = i + 1
            });
        }

        if (request.TeamMembers is { Count: > 0 })
        {
            var teamMemberRequests = request.TeamMembers
                .Select(m => new ProjectTeamMemberRequest(m.EmployeeId, m.Role, m.AssignmentRole))
                .ToList();

            Result<(Guid? ProjectManagerId, Guid? SuperintendentId)> assignmentResult =
                await _teamAssignmentService.AssignTeamMembersAsync(
                    project.Id,
                    teamMemberRequests,
                    request.StartDate,
                    cancellationToken);

            if (!assignmentResult.IsSuccess)
                return Result.Failure<ProjectDto>(assignmentResult.Error!, assignmentResult.ErrorCode);

            if (assignmentResult.Value.ProjectManagerId.HasValue)
                project.ProjectManagerId = assignmentResult.Value.ProjectManagerId;
            if (assignmentResult.Value.SuperintendentId.HasValue)
                project.SuperintendentId = assignmentResult.Value.SuperintendentId;
        }

        if (request.ActivateOnCreate)
        {
            if (projectSettings.RequireBudgetBeforeActivation && project.ContractAmount <= 0)
            {
                return Result.Failure<ProjectDto>(
                    "A contract amount is required before the project can be activated",
                    "BUDGET_REQUIRED");
            }

            project.Status = ProjectStatus.Active;
            project.StartDate ??= DateTime.UtcNow;
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Created project {ProjectId} '{ProjectName}'", project.Id, LogSafe.Text(project.Name));
            return Result.Success(MapToDto(project));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create project '{ProjectName}'", LogSafe.Text(request.Name));
            return Result.Failure<ProjectDto>("Failed to create project", "DATABASE_ERROR");
        }
    }

    public async Task<Result<ProjectDto>> ActivateProjectAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found for activation", id);
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
        }

        if (project.Status is not (ProjectStatus.PreConstruction or ProjectStatus.Bidding))
        {
            return Result.Failure<ProjectDto>(
                $"Only projects in PreConstruction or Bidding status can be activated (current: {project.Status})",
                "INVALID_STATUS");
        }

        ProjectSettings projectSettings = new();
        if (_companyContext.IsResolved)
        {
            Company? company = await _db.Set<Company>()
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == _companyContext.CompanyId, cancellationToken);
            if (company is not null)
                projectSettings = company.ProjectSettings;
        }

        if (projectSettings.RequireBudgetBeforeActivation && project.ContractAmount <= 0)
        {
            return Result.Failure<ProjectDto>(
                "A contract amount is required before the project can be activated",
                "BUDGET_REQUIRED");
        }

        project.Status = ProjectStatus.Active;
        project.StartDate ??= DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Activated project {ProjectId} '{ProjectName}'", project.Id, project.Name);
            return Result.Success(MapToDto(project));
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogWarning("Concurrency conflict activating project {ProjectId}", id);
            return Result.Failure<ProjectDto>(
                "This project was modified by another user. Please refresh and try again.",
                "CONFLICT");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to activate project {ProjectId}", id);
            return Result.Failure<ProjectDto>("Failed to activate project", "DATABASE_ERROR");
        }
    }

    public async Task<Result<ProjectDto>> UpdateProjectAsync(UpdateProjectCommand command, CancellationToken cancellationToken = default)
    {
        // Validate request
        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            _logger.LogWarning("Project update validation failed for {ProjectId}: {Errors}", command.Id, errors);
            return Result.Failure<ProjectDto>(errors, "VALIDATION_ERROR");
        }

        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == command.Id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found for update", command.Id);
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
        }

        // Update fields
        project.Name = command.Name;
        project.Number = command.Number;
        project.Description = command.Description;
        project.Status = command.Status;
        project.Type = command.Type;
        project.Address = command.Address;
        project.City = command.City;
        project.State = command.State;
        project.ZipCode = command.ZipCode;
        project.ClientName = command.ClientName;
        project.ClientContact = command.ClientContact;
        project.ClientEmail = command.ClientEmail;
        project.ClientPhone = command.ClientPhone;
        project.StartDate = command.StartDate;
        project.EstimatedCompletionDate = command.EstimatedCompletionDate;
        project.ActualCompletionDate = command.ActualCompletionDate;
        project.ContractAmount = command.ContractAmount;
        project.ProjectManagerId = command.ProjectManagerId;
        project.SuperintendentId = command.SuperintendentId;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Updated project {ProjectId} '{ProjectName}'", project.Id, LogSafe.Text(project.Name));
            return Result.Success(MapToDto(project));
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogWarning("Concurrency conflict updating project {ProjectId}", command.Id);
            return Result.Failure<ProjectDto>(
                "This project was modified by another user. Please refresh and try again.",
                "CONFLICT");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update project {ProjectId}", command.Id);
            return Result.Failure<ProjectDto>("Failed to update project", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteProjectAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found for deletion", id);
            return Result.Failure("Project not found", "NOT_FOUND");
        }

        // Perform soft delete (matches existing DeleteProjectHandler)
        project.IsDeleted = true;
        project.DeletedAt = DateTime.UtcNow;
        project.DeletedBy = GetCurrentUserId();

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Soft deleted project {ProjectId} '{ProjectName}'", project.Id, project.Name);
            return Result.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete project {ProjectId}", id);
            return Result.Failure("Failed to delete project", "DATABASE_ERROR");
        }
    }

    public async Task<Result<ProjectStatsResponse>> GetProjectStatsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        try
        {
            // Verify project exists
            var project = await _db.Set<Project>()
                .AsNoTracking()
                .Where(p => p.Id == id && !p.IsDeleted)
                .Select(p => new { p.Id, p.Name, p.Number })
                .FirstOrDefaultAsync(cancellationToken);

            if (project == null)
            {
                return Result.Failure<ProjectStatsResponse>(
                    "Project not found",
                    "PROJECT_NOT_FOUND");
            }

            // Get time entry stats using raw SQL for performance
            var statsSql = $@"
                SELECT 
                    COALESCE(SUM(""RegularHours""), 0) as ""RegularHours"",
                    COALESCE(SUM(""OvertimeHours""), 0) as ""OvertimeHours"",
                    COALESCE(SUM(""DoubletimeHours""), 0) as ""DoubleTimeHours"",
                    COUNT(*) as ""EntryCount"",
                    COUNT(*) FILTER (WHERE ""Status"" = 1) as ""ApprovedCount"",
                    COUNT(*) FILTER (WHERE ""Status"" = 0) as ""PendingCount"",
                    MIN(""Date"") as ""FirstDate"",
                    MAX(""Date"") as ""LastDate""
                FROM time_entries
                WHERE ""ProjectId"" = '{id}'
                  AND ""IsDeleted"" = false";

            var stats = await _db.Database.SqlQueryRaw<TimeEntryStatsRow>(statsSql)
                .FirstAsync(cancellationToken);

            // Get assigned employee count
            var employeeCountSql = $@"
                SELECT COUNT(DISTINCT ""EmployeeId"") as ""Value""
                FROM project_assignments
                WHERE ""ProjectId"" = '{id}'
                  AND ""IsActive"" = true";

            var employeeCountResult = await _db.Database.SqlQueryRaw<ScalarInt>(employeeCountSql)
                .FirstAsync(cancellationToken);
            var employeeCount = employeeCountResult.Value;

            // Calculate labor cost
            var laborCostSql = $@"
                SELECT COALESCE(SUM(
                    (te.""RegularHours"" * e.""BaseHourlyRate"") +
                    (te.""OvertimeHours"" * e.""BaseHourlyRate"" * 1.5) +
                    (te.""DoubletimeHours"" * e.""BaseHourlyRate"" * 2.0)
                ), 0) as ""Value""
                FROM time_entries te
                JOIN employees e ON te.""EmployeeId"" = e.""Id""
                WHERE te.""ProjectId"" = '{id}'
                  AND te.""IsDeleted"" = false
                  AND te.""Status"" = 1";

            var laborCostResult = await _db.Database.SqlQueryRaw<ScalarDecimal>(laborCostSql)
                .FirstAsync(cancellationToken);
            var laborCost = laborCostResult.Value;

            var totalHours = stats.RegularHours + stats.OvertimeHours + stats.DoubleTimeHours;

            return Result.Success(new ProjectStatsResponse(
                ProjectId: id,
                ProjectName: project.Name,
                ProjectNumber: project.Number,
                TotalHours: totalHours,
                RegularHours: stats.RegularHours,
                OvertimeHours: stats.OvertimeHours,
                DoubleTimeHours: stats.DoubleTimeHours,
                TotalLaborCost: laborCost,
                TimeEntryCount: stats.EntryCount,
                ApprovedEntryCount: stats.ApprovedCount,
                PendingEntryCount: stats.PendingCount,
                AssignedEmployeeCount: employeeCount,
                FirstEntryDate: stats.FirstDate.HasValue ? DateOnly.FromDateTime(stats.FirstDate.Value) : null,
                LastEntryDate: stats.LastDate.HasValue ? DateOnly.FromDateTime(stats.LastDate.Value) : null
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get stats for project {ProjectId}", id);
            return Result.Failure<ProjectStatsResponse>(
                $"Failed to retrieve project statistics: {ex.Message}",
                "PROJECT_STATS_ERROR");
        }
    }

    public async Task<Result<ProjectRfiCostSummaryDto>> GetProjectRfiCostSummaryAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Id == id && !p.IsDeleted)
            .Select(p => new { p.Id, p.Name, p.Number })
            .FirstOrDefaultAsync(cancellationToken);

        if (project == null)
            return Result.Failure<ProjectRfiCostSummaryDto>("Project not found", "PROJECT_NOT_FOUND");

        var now = DateTime.UtcNow;

        // Get all RFIs for this project
        var rfis = await _db.Set<Rfi>()
            .AsNoTracking()
            .Where(r => r.ProjectId == id && !r.IsDeleted)
            .ToListAsync(cancellationToken);

        // Get all change orders linked to RFIs in this project
        var rfiIds = rfis.Select(r => r.Id).ToList();
        var changeOrders = await _db.Set<ChangeOrder>()
            .AsNoTracking()
            .Where(co => co.OriginatingRfiId != null && rfiIds.Contains(co.OriginatingRfiId.Value) && !co.IsDeleted)
            .ToListAsync(cancellationToken);

        // Calculate metrics
        var totalRfis = rfis.Count;
        var openRfis = rfis.Count(r => r.Status == RfiStatus.Open);
        var overdueRfis = rfis.Count(r => r.Status == RfiStatus.Open && r.DueDate.HasValue && r.DueDate < now);

        // RFIs with cost impact = RFIs that have linked change orders
        var rfiIdsWithCOs = changeOrders.Where(co => co.OriginatingRfiId.HasValue)
            .Select(co => co.OriginatingRfiId!.Value)
            .Distinct()
            .ToHashSet();
        var rfisWithCostImpact = rfiIdsWithCOs.Count;

        // Cost totals from change orders
        var totalDirectCost = changeOrders.Sum(co => co.Amount);
        var totalDelayCost = changeOrders.Sum(co => co.DelayCost ?? 0);
        var totalCost = totalDirectCost + totalDelayCost;
        var totalDelayDays = changeOrders.Sum(co => co.DelayDays ?? 0);

        // Average resolution time for closed RFIs
        var closedRfis = rfis.Where(r => r.ClosedAt.HasValue).ToList();
        var avgResolutionDays = closedRfis.Any()
            ? closedRfis.Average(r => (r.ClosedAt!.Value - r.CreatedAt).TotalDays)
            : 0;

        // Top 5 costly RFIs
        var rfiCosts = rfis.Select(r => new
        {
            Rfi = r,
            DirectCost = changeOrders.Where(co => co.OriginatingRfiId == r.Id).Sum(co => co.Amount),
            DelayCost = changeOrders.Where(co => co.OriginatingRfiId == r.Id).Sum(co => co.DelayCost ?? 0)
        })
        .Select(x => new
        {
            x.Rfi,
            TotalCost = x.DirectCost + x.DelayCost
        })
        .Where(x => x.TotalCost > 0)
        .OrderByDescending(x => x.TotalCost)
        .Take(5)
        .ToList();

        var topCostlyRfis = rfiCosts.Select(x => new TopCostlyRfiDto(
            x.Rfi.Id,
            x.Rfi.Number,
            x.Rfi.Subject,
            x.TotalCost,
            (int)(x.Rfi.ClosedAt ?? now).Subtract(x.Rfi.CreatedAt).TotalDays
        )).ToList();

        return Result.Success(new ProjectRfiCostSummaryDto(
            ProjectId: id,
            ProjectName: project.Name,
            ProjectNumber: project.Number,
            TotalRfis: totalRfis,
            OpenRfis: openRfis,
            RfisWithCostImpact: rfisWithCostImpact,
            OverdueRfis: overdueRfis,
            TotalDirectCost: totalDirectCost,
            TotalDelayCost: totalDelayCost,
            TotalCost: totalCost,
            TotalDelayDays: totalDelayDays,
            AverageResolutionDays: Math.Round(avgResolutionDays, 1),
            TopCostlyRfis: topCostlyRfis
        ));
    }

    public async Task<Result<List<PhaseDto>>> GetProjectPhasesAsync(Guid projectId, int pageSize = 100, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, cancellationToken);

        if (project is null)
            return Result.Failure<List<PhaseDto>>("Project not found", "NOT_FOUND");

        var phases = await _db.Set<Phase>()
            .AsNoTracking()
            .Where(p => p.ProjectId == projectId && !p.IsDeleted)
            .OrderBy(p => p.SortOrder)
            .Take(pageSize)
            .Select(p => new PhaseDto(
                p.Id, p.ProjectId, p.Name, p.CostCode, p.Description, p.SortOrder,
                p.BudgetAmount, p.ActualCost, p.PercentComplete, p.Status.ToString(),
                p.StartDate, p.EndDate))
            .ToListAsync(cancellationToken);

        return Result.Success(phases);
    }

    public async Task<Result<PhaseDto>> GetPhaseAsync(Guid projectId, Guid phaseId, CancellationToken cancellationToken = default)
    {
        var phase = await _db.Set<Phase>()
            .AsNoTracking()
            .Where(p => p.Id == phaseId && p.ProjectId == projectId && !p.IsDeleted)
            .Select(p => new PhaseDto(
                p.Id, p.ProjectId, p.Name, p.CostCode, p.Description, p.SortOrder,
                p.BudgetAmount, p.ActualCost, p.PercentComplete, p.Status.ToString(),
                p.StartDate, p.EndDate))
            .FirstOrDefaultAsync(cancellationToken);

        if (phase is null)
            return Result.Failure<PhaseDto>("Phase not found", "NOT_FOUND");

        return Result.Success(phase);
    }

    /// <summary>
    /// Maps Project entity to ProjectDto (extracted from CreateProjectHandler)
    /// </summary>
    private static ProjectDto MapToDto(
        Project project,
        decimal? billedToDate = null,
        decimal? unbilledAmount = null,
        decimal? laborSpent = null,
        decimal? laborPercentOfContract = null)
    {
        return new ProjectDto(
            project.Id,
            project.Name,
            project.Number,
            project.Description,
            project.Status,
            project.Type,
            project.Address,
            project.City,
            project.State,
            project.ZipCode,
            project.ClientName,
            project.ClientContact,
            project.ClientEmail,
            project.ClientPhone,
            project.StartDate,
            project.EstimatedCompletionDate,
            project.ActualCompletionDate,
            project.ContractAmount,
            project.ProjectManagerId,
            project.SuperintendentId,
            project.SourceBidId,
            project.CreatedAt,
            billedToDate,
            unbilledAmount,
            laborSpent,
            laborPercentOfContract
        );
    }
}

internal record ProjectLaborSpendRow(Guid ProjectId, decimal Spent);

// Helper DTOs for raw SQL queries (moved from handler, shared with service)
internal record TimeEntryStatsRow(
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubleTimeHours,
    int EntryCount,
    int ApprovedCount,
    int PendingCount,
    DateTime? FirstDate,
    DateTime? LastDate
);
internal record ScalarInt(int Value);
internal record ScalarDecimal(decimal Value);
