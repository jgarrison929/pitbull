namespace Pitbull.HR.Features;

public record UnionMembershipDto(
    Guid Id, Guid EmployeeId, string UnionLocal, string MembershipNumber, string Classification,
    int? ApprenticeLevel, DateOnly? JoinDate, bool DuesPaid, DateOnly? DuesPaidThrough,
    string? DispatchNumber, DateOnly? DispatchDate, int? DispatchListPosition,
    decimal? FringeRate, decimal? HealthWelfareRate, decimal? PensionRate, decimal? TrainingRate,
    DateOnly EffectiveDate, DateOnly? ExpirationDate, string? Notes, bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt
);

public record UnionMembershipListDto(
    Guid Id, Guid EmployeeId, string EmployeeName, string UnionLocal, string MembershipNumber,
    string Classification, bool DuesPaid, string? DispatchNumber, bool IsActive
);
