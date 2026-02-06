using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetTimeEntriesByProject;

/// <summary>
/// Query to get all time entries for a specific project.
/// Designed for project managers to review labor on their projects.
/// </summary>
public record GetTimeEntriesByProjectQuery(
    Guid ProjectId,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    TimeEntryStatus? Status = null,
    bool IncludeSummary = false
) : IRequest<Result<ProjectTimeEntriesResult>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
}

/// <summary>
/// Result containing time entries and optional summary for a project
/// </summary>
public record ProjectTimeEntriesResult(
    Guid ProjectId,
    string ProjectName,
    string ProjectNumber,
    IReadOnlyList<TimeEntryDto> TimeEntries,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages,
    ProjectTimeSummary? Summary = null
);

/// <summary>
/// Aggregated hours summary for a project
/// </summary>
public record ProjectTimeSummary(
    decimal TotalRegularHours,
    decimal TotalOvertimeHours,
    decimal TotalDoubletimeHours,
    decimal TotalHours,
    int SubmittedCount,
    int ApprovedCount,
    int RejectedCount,
    int DraftCount
);

public sealed class GetTimeEntriesByProjectHandler(PitbullDbContext db)
    : IRequestHandler<GetTimeEntriesByProjectQuery, Result<ProjectTimeEntriesResult>>
{
    public async Task<Result<ProjectTimeEntriesResult>> Handle(
        GetTimeEntriesByProjectQuery request, CancellationToken cancellationToken)
    {
        // Verify project exists
        var project = await db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, cancellationToken);

        if (project == null)
            return Result.Failure<ProjectTimeEntriesResult>("Project not found", "NOT_FOUND");

        var query = db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.ApprovedBy)
            .Where(te => te.ProjectId == request.ProjectId);

        // Apply filters
        if (request.StartDate.HasValue)
            query = query.Where(te => te.Date >= request.StartDate.Value);

        if (request.EndDate.HasValue)
            query = query.Where(te => te.Date <= request.EndDate.Value);

        if (request.Status.HasValue)
            query = query.Where(te => te.Status == request.Status.Value);

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling((double)totalCount / request.PageSize);

        // Calculate summary if requested
        ProjectTimeSummary? summary = null;
        if (request.IncludeSummary)
        {
            var allEntries = await query.ToListAsync(cancellationToken);
            summary = new ProjectTimeSummary(
                TotalRegularHours: allEntries.Sum(te => te.RegularHours),
                TotalOvertimeHours: allEntries.Sum(te => te.OvertimeHours),
                TotalDoubletimeHours: allEntries.Sum(te => te.DoubletimeHours),
                TotalHours: allEntries.Sum(te => te.TotalHours),
                SubmittedCount: allEntries.Count(te => te.Status == TimeEntryStatus.Submitted),
                ApprovedCount: allEntries.Count(te => te.Status == TimeEntryStatus.Approved),
                RejectedCount: allEntries.Count(te => te.Status == TimeEntryStatus.Rejected),
                DraftCount: allEntries.Count(te => te.Status == TimeEntryStatus.Draft)
            );
        }

        // Apply ordering and pagination
        var items = await query
            .OrderByDescending(te => te.Date)
            .ThenBy(te => te.Employee.LastName)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(te => TimeEntryMapper.ToDto(te))
            .ToListAsync(cancellationToken);

        return Result.Success(new ProjectTimeEntriesResult(
            ProjectId: project.Id,
            ProjectName: project.Name,
            ProjectNumber: project.Number,
            TimeEntries: items,
            TotalCount: totalCount,
            Page: request.Page,
            PageSize: request.PageSize,
            TotalPages: totalPages,
            Summary: summary
        ));
    }
}
