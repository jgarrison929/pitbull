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
            return Result.Failure<bool>("Subcontract not found");

        // Soft delete
        subcontract.IsDeleted = true;
        subcontract.DeletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}
