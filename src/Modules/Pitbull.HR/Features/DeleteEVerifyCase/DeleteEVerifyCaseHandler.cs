using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeleteEVerifyCase;

public class DeleteEVerifyCaseHandler : IRequestHandler<DeleteEVerifyCaseCommand, bool>
{
    private readonly PitbullDbContext _context;
    public DeleteEVerifyCaseHandler(PitbullDbContext context) => _context = context;

    public async Task<bool> Handle(DeleteEVerifyCaseCommand request, CancellationToken cancellationToken)
    {
        var evCase = await _context.Set<EVerifyCase>()
            .FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);
        if (evCase == null) return false;
        evCase.IsDeleted = true;
        evCase.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
