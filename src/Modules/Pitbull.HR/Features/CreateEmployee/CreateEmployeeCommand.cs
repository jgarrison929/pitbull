using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateEmployee;

/// <summary>
/// Command to create a new employee.
/// </summary>
public record CreateEmployeeCommand(
    // Identity (required)
    string EmployeeNumber,
    string FirstName,
    string LastName,
    DateOnly DateOfBirth,
    string SSNEncrypted,
    string SSNLast4,
    
    // Identity (optional)
    string? MiddleName = null,
    string? PreferredName = null,
    string? Suffix = null,
    
    // Contact
    string? Email = null,
    string? PersonalEmail = null,
    string? Phone = null,
    string? SecondaryPhone = null,
    
    // Address
    string? AddressLine1 = null,
    string? AddressLine2 = null,
    string? City = null,
    string? State = null,
    string? ZipCode = null,
    string? Country = "US",
    
    // Employment
    DateOnly? HireDate = null,
    WorkerType WorkerType = WorkerType.Field,
    FLSAStatus FLSAStatus = FLSAStatus.NonExempt,
    EmploymentType EmploymentType = EmploymentType.FullTime,
    
    // Classification
    string? JobTitle = null,
    string? TradeCode = null,
    string? WorkersCompClassCode = null,
    Guid? DepartmentId = null,
    Guid? SupervisorId = null,
    
    // Tax
    string? HomeState = null,
    string? SUIState = null,
    
    // Payroll
    PayFrequency PayFrequency = PayFrequency.Weekly,
    PayType DefaultPayType = PayType.Hourly,
    decimal? DefaultHourlyRate = null,
    PaymentMethod PaymentMethod = PaymentMethod.DirectDeposit,
    
    // Union
    bool IsUnionMember = false,
    
    // Notes
    string? Notes = null
) : ICommand<EmployeeDto>;
