using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.GetProjectPhases;
using Pitbull.Projects.Features.GetProjectRfiCostSummary;
using Pitbull.Projects.Features.GetProjectStats;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;
using Pitbull.RFIs.Domain;

namespace Pitbull.Projects.Services;

/// <summary>
/// Direct service implementation for project operations, replacing MediatR handlers.
/// Provides clean, testable methods for all project-related business logic.
/// </summary>
public class ProjectService : IProjectService
{
    private readonly PitbullDbContext _db;
    private readonly IValidator<CreateProjectCommand> _createValidator;
    private readonly IValidator<UpdateProjectCommand> _updateValidator;
    private readonly IHttpContextAccessor? _httpContextAccessor;
    private readonly ILogger<ProjectService> _logger;

    public ProjectService(
        PitbullDbContext db,
        IValidator<CreateProjectCommand> createValidator,
        IValidator<UpdateProjectCommand> updateValidator,
        IHttpContextAccessor? httpContextAccessor,
        ILogger<ProjectService> logger)
    {
        _db = db;
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

        // Get total count for pagination
        var totalCount = await dbQuery.CountAsync(cancellationToken);

        // Apply pagination and get results
        var projects = await dbQuery
            .OrderByDescending(p => p.CreatedAt)
            .Skip((listQuery.Page - 1) * listQuery.PageSize)
            .Take(listQuery.PageSize)
            .ToArrayAsync(cancellationToken);

        var dtos = projects.Select(MapToDto).ToArray();
        var result = new PagedResult<ProjectDto>(dtos, totalCount, listQuery.Page, listQuery.PageSize);
        return Result.Success(result);
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

        _db.Set<Project>().Add(project);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Created project {ProjectId} '{ProjectName}'", project.Id, project.Name);
            return Result.Success(MapToDto(project));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create project '{ProjectName}'", request.Name);
            return Result.Failure<ProjectDto>("Failed to create project", "DATABASE_ERROR");
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
            _logger.LogInformation("Updated project {ProjectId} '{ProjectName}'", project.Id, project.Name);
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
    private static ProjectDto MapToDto(Project project)
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
            project.CreatedAt
        );
    }
}

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
