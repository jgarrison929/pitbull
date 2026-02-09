using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.ListUnionMemberships;

public record ListUnionMembershipsQuery(
    Guid? EmployeeId = null, string? UnionLocal = null, bool? ActiveOnly = null
) : IRequest<Result<PagedResult<UnionMembershipListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
