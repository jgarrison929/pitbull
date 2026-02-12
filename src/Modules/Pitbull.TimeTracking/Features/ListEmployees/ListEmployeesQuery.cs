using MediatR;
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
    string? Search = null) : IRequest<Result<ListEmployeesResult>>
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
    : IRequestHandler<ListEmployeesQuery, Result<ListEmployeesResult>>
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
            var searchTerm = request.Search.ToLower();
            query = query.Where(e =>
                e.EmployeeNumber.Contains(searchTerm, StringComparison.CurrentCultureIgnoreCase) ||
                e.FirstName.ToLower().Contains(searchTerm) ||
                e.LastName.Contains(searchTerm, StringComparison.CurrentCultureIgnoreCase) ||
                (e.Email != null && e.Email.Contains(searchTerm, StringComparison.CurrentCultureIgnoreCase)));
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply ordering and pagination
        var items = await query
            .OrderBy(e => e.LastName)
            .ThenBy(e => e.FirstName)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(e => EmployeeMapper.ToDto(e))
            .ToListAsync(cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / request.PageSize);

        return Result.Success(new ListEmployeesResult(
            items, totalCount, request.Page, request.PageSize, totalPages));
    }
}
