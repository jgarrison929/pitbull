using Pitbull.Core.CQRS;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.ListRfis;

public record ListRfisQuery(
    Guid ProjectId,
    RfiStatus? Status = null,
    RfiPriority? Priority = null,
    Guid? BallInCourtUserId = null,
    string? Search = null
) : PaginationQuery, IQuery<PagedResult<RfiDto>>;