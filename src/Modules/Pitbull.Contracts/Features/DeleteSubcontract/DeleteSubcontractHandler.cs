using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.DeleteSubcontract;

public sealed class DeleteSubcontractHandler(PitbullDbContext db)
    : IRequestHandler<DeleteSubcontractCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(
        DeleteSubcontractCommand request, CancellationToken cancellationToken)
    {
        var subcontract = await db.Set<Subcontract>()
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        if (subcontract is null)
            return Result.Failure<bool>("Subcontract not found", "NOT_FOUND");

        // Can only delete Draft subcontracts
        if (subcontract.Status != SubcontractStatus.Draft)
            return Result.Failure<bool>("Cannot delete subcontract that is not in Draft status", "CANNOT_DELETE");

        // Hard delete for Draft status
        db.Set<Subcontract>().Remove(subcontract);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}
