using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.GetEmployee;

/// <summary>
/// Query to get a single employee by ID
/// </summary>
public record GetEmployeeQuery(Guid EmployeeId) : IRequest<Result<EmployeeDto>>;

public sealed class GetEmployeeHandler(PitbullDbContext db)
    : IRequestHandler<GetEmployeeQuery, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(
        GetEmployeeQuery request, CancellationToken cancellationToken)
    {
        var employee = await db.Set<Employee>()
            .Include(e => e.Supervisor)
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);

        if (employee is null)
            return Result.Failure<EmployeeDto>("Employee not found", "NOT_FOUND");

        return Result.Success(EmployeeMapper.ToDto(employee));
    }
}
