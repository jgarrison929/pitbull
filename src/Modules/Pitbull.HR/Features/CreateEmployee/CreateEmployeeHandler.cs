using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateEmployee;

/// <summary>
/// Handler for creating a new employee.
/// </summary>
public sealed class CreateEmployeeHandler(PitbullDbContext db)
    : IRequestHandler<CreateEmployeeCommand, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(
        CreateEmployeeCommand request, CancellationToken cancellationToken)
    {
        // Check for duplicate employee number
        var existingEmployee = await db.Set<Employee>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.EmployeeNumber == request.EmployeeNumber && !e.IsDeleted, 
                cancellationToken);

        if (existingEmployee is not null)
        {
            return Result.Failure<EmployeeDto>(
                $"Employee number '{request.EmployeeNumber}' already exists",
                "DUPLICATE_EMPLOYEE_NUMBER");
        }

        var hireDate = request.HireDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var employee = new Employee
        {
            // Identity
            EmployeeNumber = request.EmployeeNumber,
            FirstName = request.FirstName,
            MiddleName = request.MiddleName,
            LastName = request.LastName,
            PreferredName = request.PreferredName,
            Suffix = request.Suffix,
            DateOfBirth = request.DateOfBirth,
            SSNEncrypted = request.SSNEncrypted,
            SSNLast4 = request.SSNLast4,
            
            // Contact
            Email = request.Email,
            PersonalEmail = request.PersonalEmail,
            Phone = request.Phone,
            SecondaryPhone = request.SecondaryPhone,
            
            // Address
            AddressLine1 = request.AddressLine1,
            AddressLine2 = request.AddressLine2,
            City = request.City,
            State = request.State,
            ZipCode = request.ZipCode,
            Country = request.Country,
            
            // Employment
            Status = EmploymentStatus.Active,
            OriginalHireDate = hireDate,
            MostRecentHireDate = hireDate,
            EligibleForRehire = true,
            
            // Classification
            WorkerType = request.WorkerType,
            FLSAStatus = request.FLSAStatus,
            EmploymentType = request.EmploymentType,
            JobTitle = request.JobTitle,
            TradeCode = request.TradeCode,
            WorkersCompClassCode = request.WorkersCompClassCode,
            DepartmentId = request.DepartmentId,
            SupervisorId = request.SupervisorId,
            
            // Tax
            HomeState = request.HomeState,
            SUIState = request.SUIState,
            
            // Payroll
            PayFrequency = request.PayFrequency,
            DefaultPayType = request.DefaultPayType,
            DefaultHourlyRate = request.DefaultHourlyRate,
            PaymentMethod = request.PaymentMethod,
            
            // Union
            IsUnionMember = request.IsUnionMember,
            
            // Compliance
            I9Status = I9Status.NotStarted,
            
            // Notes
            Notes = request.Notes
        };

        // Create initial employment episode
        employee.EmploymentEpisodes.Add(new EmploymentEpisode
        {
            HireDate = hireDate,
            EligibleForRehire = true
        });

        db.Set<Employee>().Add(employee);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(EmployeeMapper.ToDto(employee));
    }
}
