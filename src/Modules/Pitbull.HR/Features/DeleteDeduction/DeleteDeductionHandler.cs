using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.DeleteDeduction;

public class DeleteDeductionHandler : IRequestHandler<DeleteDeductionCommand, bool>
{
    private readonly PitbullDbContext _context;
    public DeleteDeductionHandler(PitbullDbContext context) => _context = context;

    public async Task<bool> Handle(DeleteDeductionCommand request, CancellationToken cancellationToken)
    {
        var deduction = await _context.Set<Deduction>()
            .FirstOrDefaultAsync(d => d.Id == request.Id && !d.IsDeleted, cancellationToken);
        if (deduction == null) return false;
        deduction.IsDeleted = true;
        deduction.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
