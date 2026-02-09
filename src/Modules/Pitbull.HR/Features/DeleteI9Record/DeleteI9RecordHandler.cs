using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeleteI9Record;

public class DeleteI9RecordHandler : IRequestHandler<DeleteI9RecordCommand, bool>
{
    private readonly PitbullDbContext _context;
    public DeleteI9RecordHandler(PitbullDbContext context) => _context = context;

    public async Task<bool> Handle(DeleteI9RecordCommand request, CancellationToken cancellationToken)
    {
        var i9 = await _context.Set<I9Record>()
            .FirstOrDefaultAsync(i => i.Id == request.Id && !i.IsDeleted, cancellationToken);
        if (i9 == null) return false;
        i9.IsDeleted = true;
        i9.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
