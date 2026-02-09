using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

public static class EmploymentEpisodeMapper
{
    public static EmploymentEpisodeDto ToDto(EmploymentEpisode ep)
    {
        var isCurrent = !ep.TerminationDate.HasValue;
        int? daysEmployed = null;
        
        if (ep.TerminationDate.HasValue)
            daysEmployed = ep.TerminationDate.Value.DayNumber - ep.HireDate.DayNumber;
        else
            daysEmployed = DateOnly.FromDateTime(DateTime.UtcNow).DayNumber - ep.HireDate.DayNumber;

        return new EmploymentEpisodeDto(
            Id: ep.Id,
            EmployeeId: ep.EmployeeId,
            EpisodeNumber: ep.EpisodeNumber,
            HireDate: ep.HireDate,
            TerminationDate: ep.TerminationDate,
            SeparationReason: ep.SeparationReason?.ToString(),
            EligibleForRehire: ep.EligibleForRehire,
            SeparationNotes: ep.SeparationNotes,
            WasVoluntary: ep.WasVoluntary,
            UnionDispatchReference: ep.UnionDispatchReference,
            JobClassificationAtHire: ep.JobClassificationAtHire,
            HourlyRateAtHire: ep.HourlyRateAtHire,
            PositionAtHire: ep.PositionAtHire,
            PositionAtTermination: ep.PositionAtTermination,
            IsCurrent: isCurrent,
            DaysEmployed: daysEmployed,
            CreatedAt: ep.CreatedAt,
            UpdatedAt: ep.UpdatedAt
        );
    }

    public static EmploymentEpisodeListDto ToListDto(EmploymentEpisode ep, string employeeName)
    {
        return new EmploymentEpisodeListDto(
            Id: ep.Id,
            EmployeeId: ep.EmployeeId,
            EmployeeName: employeeName,
            EpisodeNumber: ep.EpisodeNumber,
            HireDate: ep.HireDate,
            TerminationDate: ep.TerminationDate,
            SeparationReason: ep.SeparationReason?.ToString(),
            IsCurrent: !ep.TerminationDate.HasValue
        );
    }
}
