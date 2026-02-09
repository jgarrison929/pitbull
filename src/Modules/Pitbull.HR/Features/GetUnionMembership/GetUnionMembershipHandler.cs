using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetUnionMembership;

public class GetUnionMembershipHandler : IRequestHandler<GetUnionMembershipQuery, Result<UnionMembershipDto>>
{
    private readonly PitbullDbContext _context;
    public GetUnionMembershipHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<UnionMembershipDto>> Handle(GetUnionMembershipQuery request, CancellationToken cancellationToken)
    {
        var membership = await _context.Set<UnionMembership>()
            .FirstOrDefaultAsync(u => u.Id == request.Id && !u.IsDeleted, cancellationToken);
        if (membership == null)
            return Result.Failure<UnionMembershipDto>("Union membership not found", "NOT_FOUND");
        return Result.Success(UnionMembershipMapper.ToDto(membership));
    }
}
