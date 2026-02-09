using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateEmploymentEpisode;

public class UpdateEmploymentEpisodeHandler : IRequestHandler<UpdateEmploymentEpisodeCommand, Result<EmploymentEpisodeDto>>
{
    private readonly PitbullDbContext _context;

    public UpdateEmploymentEpisodeHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<EmploymentEpisodeDto>> Handle(UpdateEmploymentEpisodeCommand request, CancellationToken cancellationToken)
    {
        var episode = await _context.Set<EmploymentEpisode>()
            .FirstOrDefaultAsync(ep => ep.Id == request.Id && !ep.IsDeleted, cancellationToken);

        if (episode == null)
            return Result.Failure<EmploymentEpisodeDto>("Employment episode not found", "NOT_FOUND");

        // Validate termination date is after hire date
        if (request.TerminationDate.HasValue && request.TerminationDate.Value < episode.HireDate)
            return Result.Failure<EmploymentEpisodeDto>("Termination date cannot be before hire date", "INVALID_TERMINATION_DATE");

        episode.TerminationDate = request.TerminationDate ?? episode.TerminationDate;
        episode.SeparationReason = request.SeparationReason ?? episode.SeparationReason;
        episode.EligibleForRehire = request.EligibleForRehire ?? episode.EligibleForRehire;
        episode.SeparationNotes = request.SeparationNotes ?? episode.SeparationNotes;
        episode.WasVoluntary = request.WasVoluntary ?? episode.WasVoluntary;
        episode.PositionAtTermination = request.PositionAtTermination ?? episode.PositionAtTermination;
        episode.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(EmploymentEpisodeMapper.ToDto(episode));
    }
}
