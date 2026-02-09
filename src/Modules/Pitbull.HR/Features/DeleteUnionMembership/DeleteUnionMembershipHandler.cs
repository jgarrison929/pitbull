using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeleteUnionMembership;

public class DeleteUnionMembershipHandler : IRequestHandler<DeleteUnionMembershipCommand, bool>
{
    private readonly PitbullDbContext _context;
    public DeleteUnionMembershipHandler(PitbullDbContext context) => _context = context;

    public async Task<bool> Handle(DeleteUnionMembershipCommand request, CancellationToken cancellationToken)
    {
        var membership = await _context.Set<UnionMembership>()
            .FirstOrDefaultAsync(u => u.Id == request.Id && !u.IsDeleted, cancellationToken);
        if (membership == null) return false;
        membership.IsDeleted = true;
        membership.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
