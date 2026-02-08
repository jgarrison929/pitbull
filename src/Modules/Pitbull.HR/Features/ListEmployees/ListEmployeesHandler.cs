using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListEmployees;

/// <summary>
/// Handler for listing employees with filtering and pagination.
/// </summary>
public sealed class ListEmployeesHandler(PitbullDbContext db)
    : IRequestHandler<ListEmployeesQuery, Result<PagedResult<EmployeeListDto>>>
{
    public async Task<Result<PagedResult<EmployeeListDto>>> Handle(
        ListEmployeesQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<Employee>()
            .AsNoTracking()
            .Where(e => !e.IsDeleted)
            .AsQueryable();

        // Status filter
        if (request.Status.HasValue)
        {
            query = query.Where(e => e.Status == request.Status.Value);
        }
        else if (!request.IncludeTerminated)
        {
            query = query.Where(e => e.Status != EmploymentStatus.Terminated);
        }

        // Worker type filter
        if (request.WorkerType.HasValue)
        {
            query = query.Where(e => e.WorkerType == request.WorkerType.Value);
        }

        // Trade code filter
        if (!string.IsNullOrWhiteSpace(request.TradeCode))
        {
            query = query.Where(e => e.TradeCode == request.TradeCode);
        }

        // Search filter (name, employee number)
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(e =>
                e.FirstName.ToLower().Contains(search) ||
                e.LastName.ToLower().Contains(search) ||
                e.EmployeeNumber.ToLower().Contains(search) ||
                (e.PreferredName != null && e.PreferredName.ToLower().Contains(search)));
        }

        // Sorting
        query = request.SortBy switch
        {
            ListEmployeesSortBy.FirstName => request.SortDescending 
                ? query.OrderByDescending(e => e.FirstName) 
                : query.OrderBy(e => e.FirstName),
            ListEmployeesSortBy.EmployeeNumber => request.SortDescending 
                ? query.OrderByDescending(e => e.EmployeeNumber) 
                : query.OrderBy(e => e.EmployeeNumber),
            ListEmployeesSortBy.HireDate => request.SortDescending 
                ? query.OrderByDescending(e => e.OriginalHireDate) 
                : query.OrderBy(e => e.OriginalHireDate),
            ListEmployeesSortBy.Status => request.SortDescending 
                ? query.OrderByDescending(e => e.Status) 
                : query.OrderBy(e => e.Status),
            _ => request.SortDescending 
                ? query.OrderByDescending(e => e.LastName).ThenByDescending(e => e.FirstName)
                : query.OrderBy(e => e.LastName).ThenBy(e => e.FirstName)
        };

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(EmployeeMapper.ToListDto).ToList();

        return Result.Success(new PagedResult<EmployeeListDto>(
            dtos, totalCount, request.Page, request.PageSize));
    }
}
