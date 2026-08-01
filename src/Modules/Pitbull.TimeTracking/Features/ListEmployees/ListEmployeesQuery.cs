using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.ListEmployees;

/// <summary>
/// Query to list employees with optional filtering
/// </summary>
public record ListEmployeesQuery(
    bool? IsActive = null,
    EmployeeClassification? Classification = null,
    string? Search = null) : IQuery<ListEmployeesResult>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 50;
}

public record ListEmployeesResult(
    IReadOnlyList<EmployeeDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);

public sealed class ListEmployeesHandler(PitbullDbContext db)
    : IQueryHandler<ListEmployeesQuery, ListEmployeesResult>
{
    public async Task<Result<ListEmployeesResult>> Handle(
        ListEmployeesQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<Employee>()
            .Include(e => e.Supervisor)
            .Where(e => !e.IsDeleted)
            .AsQueryable();

        // Apply filters
        if (request.IsActive.HasValue)
            query = query.Where(e => e.IsActive == request.IsActive.Value);

        if (request.Classification.HasValue)
            query = query.Where(e => e.Classification == request.Classification.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchTerm = request.Search.Trim();
            if (searchTerm.Length > 200)
                searchTerm = searchTerm[..200];
            searchTerm = searchTerm.ToLower();
            query = query.Where(e =>
                e.EmployeeNumber.ToLower().Contains(searchTerm) ||
                e.FirstName.ToLower().Contains(searchTerm) ||
                e.LastName.ToLower().Contains(searchTerm) ||
                (e.Email != null && e.Email.ToLower().Contains(searchTerm)));
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 50 : Math.Min(request.PageSize, 100);

        // Apply ordering and pagination
        var items = await query
            .OrderBy(e => e.LastName)
            .ThenBy(e => e.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => EmployeeMapper.ToDto(e))
            .ToListAsync(cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListEmployeesResult(
            items, totalCount, page, pageSize, totalPages));
    }
}
