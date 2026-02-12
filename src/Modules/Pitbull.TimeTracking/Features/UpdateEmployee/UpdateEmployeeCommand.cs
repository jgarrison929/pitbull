using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.UpdateEmployee;

/// <summary>
/// Command to update an existing employee
/// </summary>
public record UpdateEmployeeCommand(
    Guid EmployeeId,
    string FirstName,
    string LastName,
    string? Email = null,
    string? Phone = null,
    string? Title = null,
    EmployeeClassification Classification = EmployeeClassification.Hourly,
    decimal BaseHourlyRate = 0,
    DateOnly? HireDate = null,
    DateOnly? TerminationDate = null,
    Guid? SupervisorId = null,
    bool IsActive = true,
    string? Notes = null
) : IRequest<Result<EmployeeDto>>;

public sealed class UpdateEmployeeHandler(PitbullDbContext db)
    : IRequestHandler<UpdateEmployeeCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(
        UpdateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var employee = await db.Set<Employee>()
            .Include(e => e.Supervisor)
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
            return Result.Failure<EmployeeDto>("Employee not found", "NOT_FOUND");

        // Validate supervisor if provided
        if (request.SupervisorId.HasValue)
        {
            var supervisorExists = await db.Set<Employee>()
                .AnyAsync(e => e.Id == request.SupervisorId.Value, cancellationToken);

            if (!supervisorExists)
                return Result.Failure<EmployeeDto>("Supervisor not found", "INVALID_SUPERVISOR");

            // Prevent self-reference
            if (request.SupervisorId.Value == request.EmployeeId)
                return Result.Failure<EmployeeDto>("Employee cannot be their own supervisor", "INVALID_SUPERVISOR");
        }

        // Update fields
        employee.FirstName = request.FirstName;
        employee.LastName = request.LastName;
        employee.Email = request.Email;
        employee.Phone = request.Phone;
        employee.Title = request.Title;
        employee.Classification = request.Classification;
        employee.BaseHourlyRate = request.BaseHourlyRate;
        employee.HireDate = request.HireDate;
        employee.TerminationDate = request.TerminationDate;
        employee.SupervisorId = request.SupervisorId;
        employee.IsActive = request.IsActive;
        employee.Notes = request.Notes;

        await db.SaveChangesAsync(cancellationToken);

        // Reload with supervisor for DTO
        if (request.SupervisorId.HasValue && employee.Supervisor is null)
        {
            employee = await db.Set<Employee>()
                .Include(e => e.Supervisor)
                .FirstAsync(e => e.Id == request.EmployeeId, cancellationToken);
        }

        return Result.Success(EmployeeMapper.ToDto(employee));
    }
}
