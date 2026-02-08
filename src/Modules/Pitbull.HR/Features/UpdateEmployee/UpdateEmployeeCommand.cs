using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateEmployee;

/// <summary>
/// Command to update an existing employee.
/// </summary>
public record UpdateEmployeeCommand(
    Guid Id,
    
    // Identity
    string FirstName,
    string LastName,
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
    string? Country = null,
    
    // Classification
    WorkerType? WorkerType = null,
    FLSAStatus? FLSAStatus = null,
    EmploymentType? EmploymentType = null,
    string? JobTitle = null,
    string? TradeCode = null,
    string? WorkersCompClassCode = null,
    Guid? DepartmentId = null,
    Guid? SupervisorId = null,
    
    // Tax
    string? HomeState = null,
    string? SUIState = null,
    
    // Payroll
    PayFrequency? PayFrequency = null,
    PayType? DefaultPayType = null,
    decimal? DefaultHourlyRate = null,
    PaymentMethod? PaymentMethod = null,
    
    // Union
    bool? IsUnionMember = null,
    
    // Notes
    string? Notes = null
) : ICommand<EmployeeDto>;
