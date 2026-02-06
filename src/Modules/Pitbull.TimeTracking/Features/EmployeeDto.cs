using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features;

/// <summary>
/// Employee data transfer object
/// </summary>
public record EmployeeDto(
    Guid Id,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string FullName,
    string? Email,
    string? Phone,
    string? Title,
    EmployeeClassification Classification,
    decimal BaseHourlyRate,
    bool IsActive,
    DateOnly? HireDate,
    DateOnly? TerminationDate,
    Guid? SupervisorId,
    string? SupervisorName,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public static class EmployeeMapper
{
    public static EmployeeDto ToDto(Employee employee) => new(
        Id: employee.Id,
        EmployeeNumber: employee.EmployeeNumber,
        FirstName: employee.FirstName,
        LastName: employee.LastName,
        FullName: employee.FullName,
        Email: employee.Email,
        Phone: employee.Phone,
        Title: employee.Title,
        Classification: employee.Classification,
        BaseHourlyRate: employee.BaseHourlyRate,
        IsActive: employee.IsActive,
        HireDate: employee.HireDate,
        TerminationDate: employee.TerminationDate,
        SupervisorId: employee.SupervisorId,
        SupervisorName: employee.Supervisor?.FullName,
        CreatedAt: employee.CreatedAt,
        UpdatedAt: employee.UpdatedAt);
}
