using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.ListTimeEntries;

/// <summary>
/// Query to list time entries with optional filtering
/// </summary>
public record ListTimeEntriesQuery(
    Guid? ProjectId = null,
    Guid? EmployeeId = null,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    TimeEntryStatus? Status = null) : IRequest<Result<ListTimeEntriesResult>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}

public record ListTimeEntriesResult(
    IReadOnlyList<TimeEntryDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);

public sealed class ListTimeEntriesHandler(PitbullDbContext db)
    : IRequestHandler<ListTimeEntriesQuery, Result<ListTimeEntriesResult>>
{
    public async Task<Result<ListTimeEntriesResult>> Handle(
        ListTimeEntriesQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .AsQueryable();

        // Apply filters
        if (request.ProjectId.HasValue)
            query = query.Where(te => te.ProjectId == request.ProjectId.Value);

        if (request.EmployeeId.HasValue)
            query = query.Where(te => te.EmployeeId == request.EmployeeId.Value);

        if (request.StartDate.HasValue)
            query = query.Where(te => te.Date >= request.StartDate.Value);

        if (request.EndDate.HasValue)
            query = query.Where(te => te.Date <= request.EndDate.Value);

        if (request.Status.HasValue)
            query = query.Where(te => te.Status == request.Status.Value);

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply ordering and pagination
        var items = await query
            .OrderByDescending(te => te.Date)
            .ThenBy(te => te.Employee.LastName)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(te => TimeEntryMapper.ToDto(te))
            .ToListAsync(cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / request.PageSize);

        return Result.Success(new ListTimeEntriesResult(
            items, totalCount, request.Page, request.PageSize, totalPages));
    }
}
