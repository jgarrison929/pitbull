using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetEmployee;

/// <summary>
/// Query to get a single employee by ID.
/// </summary>
public record GetEmployeeQuery(Guid Id) : IQuery<EmployeeDto>;
