using Pitbull.Core.CQRS;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.ListRfis;

/// <summary>
/// Query parameters for listing RFIs with filtering and pagination. Used by RfiService.
/// </summary>
public record ListRfisQuery(
    Guid ProjectId,
    RfiStatus? Status = null,
    RfiPriority? Priority = null,
    Guid? BallInCourtUserId = null,
    string? Search = null
) : PaginationQuery;