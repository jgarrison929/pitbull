using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeleteCertification;

public class DeleteCertificationHandler : IRequestHandler<DeleteCertificationCommand, bool>
{
    private readonly PitbullDbContext _context;

    public DeleteCertificationHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteCertificationCommand request, CancellationToken cancellationToken)
    {
        var certification = await _context.Set<Certification>()
            .FirstOrDefaultAsync(c => c.Id == request.Id && !c.IsDeleted, cancellationToken);

        if (certification == null)
        {
            return false;
        }

        certification.IsDeleted = true;
        certification.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
