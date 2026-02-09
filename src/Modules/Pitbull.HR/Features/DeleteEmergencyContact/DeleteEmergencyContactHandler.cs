using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeleteEmergencyContact;

public class DeleteEmergencyContactHandler : IRequestHandler<DeleteEmergencyContactCommand, bool>
{
    private readonly PitbullDbContext _context;

    public DeleteEmergencyContactHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteEmergencyContactCommand request, CancellationToken cancellationToken)
    {
        var contact = await _context.Set<EmergencyContact>()
            .FirstOrDefaultAsync(c => c.Id == request.Id && !c.IsDeleted, cancellationToken);

        if (contact == null)
        {
            return false;
        }

        contact.IsDeleted = true;
        contact.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
