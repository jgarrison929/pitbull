using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.GetRfi;

public sealed class GetRfiHandler(PitbullDbContext db) : IRequestHandler<GetRfiQuery, Result<RfiDto>>
{
    public async Task<Result<RfiDto>> Handle(GetRfiQuery request, CancellationToken cancellationToken)
    {
        var rfi = await db.Set<Rfi>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == request.Id && r.ProjectId == request.ProjectId,
                cancellationToken);

        if (rfi is null)
            return Result.Failure<RfiDto>("RFI not found", "NOT_FOUND");

        return Result.Success(RfiMapper.ToDto(rfi));
    }
}