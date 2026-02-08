using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

/// <summary>
/// Maps Employee entities to DTOs.
/// </summary>
public static class EmployeeMapper
{
    public static EmployeeListDto ToListDto(Employee employee) => new(
        Id: employee.Id,
        EmployeeNumber: employee.EmployeeNumber,
        FullName: employee.FullName,
        Status: employee.Status,
        WorkerType: employee.WorkerType,
        JobTitle: employee.JobTitle,
        TradeCode: employee.TradeCode,
        OriginalHireDate: employee.OriginalHireDate,
        CreatedAt: employee.CreatedAt
    );

    public static EmployeeDto ToDto(Employee employee) => new(
        Id: employee.Id,
        EmployeeNumber: employee.EmployeeNumber,
        FirstName: employee.FirstName,
        MiddleName: employee.MiddleName,
        LastName: employee.LastName,
        PreferredName: employee.PreferredName,
        Suffix: employee.Suffix,
        FullName: employee.FullName,
        DateOfBirth: employee.DateOfBirth,
        SSNLast4: employee.SSNLast4,
        Email: employee.Email,
        PersonalEmail: employee.PersonalEmail,
        Phone: employee.Phone,
        SecondaryPhone: employee.SecondaryPhone,
        Address: employee.AddressLine1 != null 
            ? new AddressDto(
                employee.AddressLine1,
                employee.AddressLine2,
                employee.City,
                employee.State,
                employee.ZipCode,
                employee.Country)
            : null,
        Status: employee.Status,
        OriginalHireDate: employee.OriginalHireDate,
        MostRecentHireDate: employee.MostRecentHireDate,
        TerminationDate: employee.TerminationDate,
        EligibleForRehire: employee.EligibleForRehire,
        WorkerType: employee.WorkerType,
        FLSAStatus: employee.FLSAStatus,
        EmploymentType: employee.EmploymentType,
        JobTitle: employee.JobTitle,
        TradeCode: employee.TradeCode,
        WorkersCompClassCode: employee.WorkersCompClassCode,
        DepartmentId: employee.DepartmentId,
        SupervisorId: employee.SupervisorId,
        HomeState: employee.HomeState,
        SUIState: employee.SUIState,
        PayFrequency: employee.PayFrequency,
        DefaultPayType: employee.DefaultPayType,
        DefaultHourlyRate: employee.DefaultHourlyRate,
        PaymentMethod: employee.PaymentMethod,
        IsUnionMember: employee.IsUnionMember,
        I9Status: employee.I9Status,
        EVerifyStatus: employee.EVerifyStatus,
        BackgroundCheckStatus: employee.BackgroundCheckStatus,
        DrugTestStatus: employee.DrugTestStatus,
        AppUserId: employee.AppUserId,
        Notes: employee.Notes,
        CreatedAt: employee.CreatedAt,
        UpdatedAt: employee.UpdatedAt
    );
}
