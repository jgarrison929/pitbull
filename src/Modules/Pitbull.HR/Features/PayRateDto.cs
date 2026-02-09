namespace Pitbull.HR.Features;

/// <summary>
/// DTO for employee pay rate data.
/// </summary>
public record PayRateDto(
    Guid Id,
    Guid EmployeeId,
    string? Description,
    string RateType,
    decimal Amount,
    string Currency,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    Guid? ProjectId,
    string? ShiftCode,
    string? WorkState,
    int Priority,
    bool IncludesFringe,
    decimal? FringeRate,
    decimal? HealthWelfareRate,
    decimal? PensionRate,
    decimal? TrainingRate,
    decimal? OtherFringeRate,
    decimal TotalHourlyCost,
    string Source,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

/// <summary>
/// Lightweight DTO for pay rate lists.
/// </summary>
public record PayRateListDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string? Description,
    string RateType,
    decimal Amount,
    decimal TotalHourlyCost,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    bool IsActive
);
