using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetEmergencyContact;

public class GetEmergencyContactHandler : IRequestHandler<GetEmergencyContactQuery, Result<EmergencyContactDto>>
{
    private readonly PitbullDbContext _context;

    public GetEmergencyContactHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<EmergencyContactDto>> Handle(GetEmergencyContactQuery request, CancellationToken cancellationToken)
    {
        var contact = await _context.Set<EmergencyContact>()
            .FirstOrDefaultAsync(c => c.Id == request.Id && !c.IsDeleted, cancellationToken);

        if (contact == null)
        {
            return Result.Failure<EmergencyContactDto>("Emergency contact not found", "NOT_FOUND");
        }

        return Result.Success(EmergencyContactMapper.ToDto(contact));
    }
}
