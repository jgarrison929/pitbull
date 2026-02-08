using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.GetSubcontract;

public sealed class GetSubcontractHandler(PitbullDbContext db)
    : IRequestHandler<GetSubcontractQuery, Result<SubcontractDto>>
{
    public async Task<Result<SubcontractDto>> Handle(
        GetSubcontractQuery request, CancellationToken cancellationToken)
    {
        var subcontract = await db.Set<Subcontract>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        if (subcontract is null)
            return Result.Failure<SubcontractDto>("Subcontract not found");

        return Result.Success(CreateSubcontractHandler.MapToDto(subcontract));
    }
}
