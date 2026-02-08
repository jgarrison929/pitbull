using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListEmployees;

/// <summary>
/// Query to list employees with filtering and pagination.
/// </summary>
public record ListEmployeesQuery(
    EmploymentStatus? Status = null,
    WorkerType? WorkerType = null,
    string? TradeCode = null,
    string? Search = null,
    bool IncludeTerminated = false,
    ListEmployeesSortBy SortBy = ListEmployeesSortBy.LastName,
    bool SortDescending = false
) : PaginationQuery, IQuery<PagedResult<EmployeeListDto>>;

/// <summary>
/// Sort options for employee list.
/// </summary>
public enum ListEmployeesSortBy
{
    LastName,
    FirstName,
    EmployeeNumber,
    HireDate,
    Status
}
