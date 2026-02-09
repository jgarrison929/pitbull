namespace Pitbull.HR.Features;

public record DeductionDto(
    Guid Id, Guid EmployeeId, string DeductionCode, string Description, string Method,
    decimal Amount, decimal? MaxPerPeriod, decimal? AnnualMax, decimal YtdAmount,
    int Priority, bool IsPreTax, decimal? EmployerMatch, decimal? EmployerMatchMax,
    DateOnly EffectiveDate, DateOnly? ExpirationDate, string? CaseNumber,
    string? GarnishmentPayee, string? Notes, bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt
);

public record DeductionListDto(
    Guid Id, Guid EmployeeId, string EmployeeName, string DeductionCode, string Description,
    string Method, decimal Amount, int Priority, bool IsPreTax, bool IsActive
);
