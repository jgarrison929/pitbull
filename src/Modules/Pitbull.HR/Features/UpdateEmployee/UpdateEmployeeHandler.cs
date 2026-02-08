using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateEmployee;

/// <summary>
/// Handler for updating an existing employee.
/// </summary>
public sealed class UpdateEmployeeHandler(PitbullDbContext db)
    : IRequestHandler<UpdateEmployeeCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(
        UpdateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var employee = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeDto>("Employee not found", "NOT_FOUND");
        }

        // Identity
        employee.FirstName = request.FirstName;
        employee.LastName = request.LastName;
        employee.MiddleName = request.MiddleName;
        employee.PreferredName = request.PreferredName;
        employee.Suffix = request.Suffix;

        // Contact
        employee.Email = request.Email;
        employee.PersonalEmail = request.PersonalEmail;
        employee.Phone = request.Phone;
        employee.SecondaryPhone = request.SecondaryPhone;

        // Address
        employee.AddressLine1 = request.AddressLine1;
        employee.AddressLine2 = request.AddressLine2;
        employee.City = request.City;
        employee.State = request.State;
        employee.ZipCode = request.ZipCode;
        if (request.Country is not null)
        {
            employee.Country = request.Country;
        }

        // Classification (only update if provided)
        if (request.WorkerType.HasValue)
            employee.WorkerType = request.WorkerType.Value;
        if (request.FLSAStatus.HasValue)
            employee.FLSAStatus = request.FLSAStatus.Value;
        if (request.EmploymentType.HasValue)
            employee.EmploymentType = request.EmploymentType.Value;
        
        employee.JobTitle = request.JobTitle;
        employee.TradeCode = request.TradeCode;
        employee.WorkersCompClassCode = request.WorkersCompClassCode;
        employee.DepartmentId = request.DepartmentId;
        employee.SupervisorId = request.SupervisorId;

        // Tax
        employee.HomeState = request.HomeState;
        employee.SUIState = request.SUIState;

        // Payroll (only update if provided)
        if (request.PayFrequency.HasValue)
            employee.PayFrequency = request.PayFrequency.Value;
        if (request.DefaultPayType.HasValue)
            employee.DefaultPayType = request.DefaultPayType.Value;
        if (request.DefaultHourlyRate.HasValue)
            employee.DefaultHourlyRate = request.DefaultHourlyRate.Value;
        if (request.PaymentMethod.HasValue)
            employee.PaymentMethod = request.PaymentMethod.Value;

        // Union
        if (request.IsUnionMember.HasValue)
            employee.IsUnionMember = request.IsUnionMember.Value;

        // Notes
        employee.Notes = request.Notes;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(EmployeeMapper.ToDto(employee));
    }
}
