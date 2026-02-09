using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

public record EmploymentEpisodeDto(
    Guid Id,
    Guid EmployeeId,
    int EpisodeNumber,
    DateOnly HireDate,
    DateOnly? TerminationDate,
    string? SeparationReason,
    bool? EligibleForRehire,
    string? SeparationNotes,
    bool? WasVoluntary,
    string? UnionDispatchReference,
    string? JobClassificationAtHire,
    decimal? HourlyRateAtHire,
    string? PositionAtHire,
    string? PositionAtTermination,
    bool IsCurrent,
    int? DaysEmployed,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record EmploymentEpisodeListDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    int EpisodeNumber,
    DateOnly HireDate,
    DateOnly? TerminationDate,
    string? SeparationReason,
    bool IsCurrent
);
