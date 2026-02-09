using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeletePayRate;

public class DeletePayRateHandler : IRequestHandler<DeletePayRateCommand, bool>
{
    private readonly PitbullDbContext _context;

    public DeletePayRateHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeletePayRateCommand request, CancellationToken cancellationToken)
    {
        var payRate = await _context.Set<PayRate>()
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);

        if (payRate == null)
        {
            return false;
        }

        payRate.IsDeleted = true;
        payRate.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
