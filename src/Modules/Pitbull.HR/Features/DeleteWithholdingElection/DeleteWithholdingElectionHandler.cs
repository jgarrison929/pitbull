using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeleteWithholdingElection;

public class DeleteWithholdingElectionHandler : IRequestHandler<DeleteWithholdingElectionCommand, bool>
{
    private readonly PitbullDbContext _context;

    public DeleteWithholdingElectionHandler(PitbullDbContext context) => _context = context;

    public async Task<bool> Handle(DeleteWithholdingElectionCommand request, CancellationToken cancellationToken)
    {
        var election = await _context.Set<WithholdingElection>()
            .FirstOrDefaultAsync(w => w.Id == request.Id && !w.IsDeleted, cancellationToken);

        if (election == null) return false;

        election.IsDeleted = true;
        election.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
