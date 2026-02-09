using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateEmploymentEpisode;

/// <summary>
/// Update employment episode - primarily used to terminate/separate an employee.
/// </summary>
public record UpdateEmploymentEpisodeCommand(
    Guid Id,
    DateOnly? TerminationDate,
    SeparationReason? SeparationReason,
    bool? EligibleForRehire,
    string? SeparationNotes,
    bool? WasVoluntary,
    string? PositionAtTermination
) : IRequest<Result<EmploymentEpisodeDto>>;
