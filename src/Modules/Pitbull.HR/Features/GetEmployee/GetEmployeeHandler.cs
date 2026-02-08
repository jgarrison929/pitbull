using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetEmployee;

/// <summary>
/// Handler for getting a single employee by ID.
/// </summary>
public sealed class GetEmployeeHandler(PitbullDbContext db)
    : IRequestHandler<GetEmployeeQuery, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(
        GetEmployeeQuery request, CancellationToken cancellationToken)
    {
        var employee = await db.Set<Employee>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeDto>("Employee not found", "NOT_FOUND");
        }

        return Result.Success(EmployeeMapper.ToDto(employee));
    }
}
