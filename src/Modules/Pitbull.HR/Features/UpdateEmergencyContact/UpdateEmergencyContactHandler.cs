using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateEmergencyContact;

public class UpdateEmergencyContactHandler : IRequestHandler<UpdateEmergencyContactCommand, Result<EmergencyContactDto>>
{
    private readonly PitbullDbContext _context;

    public UpdateEmergencyContactHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<EmergencyContactDto>> Handle(UpdateEmergencyContactCommand request, CancellationToken cancellationToken)
    {
        var contact = await _context.Set<EmergencyContact>()
            .FirstOrDefaultAsync(c => c.Id == request.Id && !c.IsDeleted, cancellationToken);

        if (contact == null)
        {
            return Result.Failure<EmergencyContactDto>("Emergency contact not found", "NOT_FOUND");
        }

        contact.Name = request.Name;
        contact.Relationship = request.Relationship;
        contact.PrimaryPhone = request.PrimaryPhone;
        contact.SecondaryPhone = request.SecondaryPhone;
        contact.Email = request.Email;
        contact.Priority = request.Priority ?? contact.Priority;
        contact.Notes = request.Notes;
        contact.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(EmergencyContactMapper.ToDto(contact));
    }
}
