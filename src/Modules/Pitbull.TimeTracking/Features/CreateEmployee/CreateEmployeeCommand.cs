using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.CreateEmployee;

/// <summary>
/// Create a new employee record.
/// EmployeeNumber is auto-generated if not provided.
/// </summary>
public record CreateEmployeeCommand(
    string FirstName,
    string LastName,
    string? EmployeeNumber = null,  // Optional - auto-generated if not provided
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
        // Auto-generate employee number if not provided
        string employeeNumber;
        if (string.IsNullOrWhiteSpace(request.EmployeeNumber))
        {
            // Get the next employee number (EMP-XXXXX format)
            var maxNumber = await db.Set<Employee>()
                .Where(e => e.EmployeeNumber.StartsWith("EMP-"))
                .Select(e => e.EmployeeNumber)
                .ToListAsync(cancellationToken);

            var nextNum = 1;
            if (maxNumber.Count > 0)
            {
                nextNum = maxNumber
                    .Select(n => int.TryParse(n.Replace("EMP-", ""), out var num) ? num : 0)
                    .DefaultIfEmpty(0)
                    .Max() + 1;
            }
            employeeNumber = $"EMP-{nextNum:D5}";
        }
        else
        {
            employeeNumber = request.EmployeeNumber;

            // Check for duplicate only if user provided a custom number
            var existingEmployee = await db.Set<Employee>()
                .AnyAsync(e => e.EmployeeNumber == employeeNumber, cancellationToken);

            if (existingEmployee)
                return Result.Failure<EmployeeDto>("Employee number already exists", "DUPLICATE");
        }

        // Validate supervisor exists if provided
        if (request.SupervisorId.HasValue)
        {
            var supervisorExists = await db.Set<Employee>()
                .AnyAsync(e => e.Id == request.SupervisorId.Value, cancellationToken);

            if (!supervisorExists)
                return Result.Failure<EmployeeDto>("Supervisor not found", "INVALID_SUPERVISOR");
        }

        var employee = new Employee
        {
            EmployeeNumber = employeeNumber,
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
