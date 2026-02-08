using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

/// <summary>
/// Lightweight DTO for employee list views.
/// </summary>
public record EmployeeListDto(
    Guid Id,
    string EmployeeNumber,
    string FullName,
    EmploymentStatus Status,
    WorkerType WorkerType,
    string? JobTitle,
    string? TradeCode,
    DateOnly OriginalHireDate,
    DateTime CreatedAt
);

/// <summary>
/// Detailed DTO for single employee views.
/// </summary>
public record EmployeeDto(
    Guid Id,
    string EmployeeNumber,
    string FirstName,
    string? MiddleName,
    string LastName,
    string? PreferredName,
    string? Suffix,
    string FullName,
    DateOnly DateOfBirth,
    string SSNLast4,
    string? Email,
    string? PersonalEmail,
    string? Phone,
    string? SecondaryPhone,
    AddressDto? Address,
    EmploymentStatus Status,
    DateOnly OriginalHireDate,
    DateOnly MostRecentHireDate,
    DateOnly? TerminationDate,
    bool EligibleForRehire,
    WorkerType WorkerType,
    FLSAStatus FLSAStatus,
    EmploymentType EmploymentType,
    string? JobTitle,
    string? TradeCode,
    string? WorkersCompClassCode,
    Guid? DepartmentId,
    Guid? SupervisorId,
    string? HomeState,
    string? SUIState,
    PayFrequency PayFrequency,
    PayType DefaultPayType,
    decimal? DefaultHourlyRate,
    PaymentMethod PaymentMethod,
    bool IsUnionMember,
    I9Status I9Status,
    EVerifyStatus? EVerifyStatus,
    BackgroundCheckStatus? BackgroundCheckStatus,
    DrugTestStatus? DrugTestStatus,
    Guid? AppUserId,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

/// <summary>
/// Address DTO for employee addresses.
/// </summary>
public record AddressDto(
    string? Line1,
    string? Line2,
    string? City,
    string? State,
    string? ZipCode,
    string? Country
);
