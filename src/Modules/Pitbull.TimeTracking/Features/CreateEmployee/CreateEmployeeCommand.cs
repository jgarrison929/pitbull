using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.CreateEmployee;

/// <summary>
/// Create a new employee record
/// </summary>
public record CreateEmployeeCommand(
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string? Email = null,
    string? Phone = null,
    string? Title = null,
    EmployeeClassification Classification = EmployeeClassification.Hourly,
    decimal BaseHourlyRate = 0,
    DateOnly? HireDate = null,
    Guid? SupervisorId = null,
    string? Notes = null
) : IRequest<Result<EmployeeDto>>;

public sealed class CreateEmployeeHandler(PitbullDbContext db)
    : IRequestHandler<CreateEmployeeCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(
        CreateEmployeeCommand request, CancellationToken cancellationToken)
    {
        // Check for duplicate employee number
        var existingEmployee = await db.Set<Employee>()
            .AnyAsync(e => e.EmployeeNumber == request.EmployeeNumber, cancellationToken);

        if (existingEmployee)
            return Result.Failure<EmployeeDto>("DUPLICATE", "Employee number already exists");

        // Validate supervisor exists if provided
        if (request.SupervisorId.HasValue)
        {
            var supervisorExists = await db.Set<Employee>()
                .AnyAsync(e => e.Id == request.SupervisorId.Value, cancellationToken);

            if (!supervisorExists)
                return Result.Failure<EmployeeDto>("INVALID_SUPERVISOR", "Supervisor not found");
        }

        var employee = new Employee
        {
            EmployeeNumber = request.EmployeeNumber,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            Title = request.Title,
            Classification = request.Classification,
            BaseHourlyRate = request.BaseHourlyRate,
            HireDate = request.HireDate,
            SupervisorId = request.SupervisorId,
            Notes = request.Notes,
            IsActive = true
        };

        db.Set<Employee>().Add(employee);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(EmployeeMapper.ToDto(employee));
    }
}
