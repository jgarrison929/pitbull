namespace Pitbull.HR.Features;

public record WithholdingElectionDto(
    Guid Id,
    Guid EmployeeId,
    string TaxJurisdiction,
    string FilingStatus,
    int Allowances,
    decimal AdditionalWithholding,
    bool IsExempt,
    bool MultipleJobsOrSpouseWorks,
    decimal? DependentCredits,
    decimal? OtherIncome,
    decimal? Deductions,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    DateOnly? SignedDate,
    string? Notes,
    bool IsCurrent,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record WithholdingElectionListDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string TaxJurisdiction,
    string FilingStatus,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    bool IsCurrent
);
