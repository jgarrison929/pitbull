using MediatR;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.ListChangeOrders;

public record ListChangeOrdersQuery(
    Guid? SubcontractId,
    ChangeOrderStatus? Status,
    string? Search,
    int Page = 1,
    int PageSize = 20
) : IRequest<Result<PagedResult<ChangeOrderDto>>>;
