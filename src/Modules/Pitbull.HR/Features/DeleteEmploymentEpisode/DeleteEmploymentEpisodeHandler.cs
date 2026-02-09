using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeleteEmploymentEpisode;

public class DeleteEmploymentEpisodeHandler : IRequestHandler<DeleteEmploymentEpisodeCommand, bool>
{
    private readonly PitbullDbContext _context;

    public DeleteEmploymentEpisodeHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteEmploymentEpisodeCommand request, CancellationToken cancellationToken)
    {
        var episode = await _context.Set<EmploymentEpisode>()
            .FirstOrDefaultAsync(ep => ep.Id == request.Id && !ep.IsDeleted, cancellationToken);

        if (episode == null)
            return false;

        episode.IsDeleted = true;
        episode.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
