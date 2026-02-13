using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateEmployee;
using Pitbull.TimeTracking.Features.GetEmployee;
using Pitbull.TimeTracking.Features.GetEmployeeStats;
using Pitbull.TimeTracking.Features.ListEmployees;
using Pitbull.TimeTracking.Features.UpdateEmployee;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for managing Employee operations, replacing MediatR-based handlers.
/// Provides direct, testable methods for all Employee-related business logic.
/// </summary>
public interface IEmployeeService
{
    // Query operations
    Task<Result<EmployeeDto>> GetEmployeeAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<EmployeeDto>>> GetEmployeesAsync(ListEmployeesQuery query, CancellationToken cancellationToken = default);
    Task<Result<IEnumerable<ProjectAssignmentDto>>> GetEmployeeProjectsAsync(Guid employeeId, bool activeOnly = true, CancellationToken cancellationToken = default);
    Task<Result<EmployeeStatsResponse>> GetEmployeeStatsAsync(Guid id, CancellationToken cancellationToken = default);

    // Command operations
    Task<Result<EmployeeDto>> CreateEmployeeAsync(CreateEmployeeCommand command, CancellationToken cancellationToken = default);
    Task<Result<EmployeeDto>> UpdateEmployeeAsync(UpdateEmployeeCommand command, CancellationToken cancellationToken = default);
}
