using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.OwnerChangeOrders;

public record ListOwnerChangeOrdersQuery(
    Guid? ProjectId,
    ChangeOrderStatus? Status,
    string? Search,
    int Page = 1,
    int PageSize = 20
) : IQuery<PagedResult<OwnerChangeOrderDto>>;