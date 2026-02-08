using MediatR;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.GetChangeOrder;

public record GetChangeOrderQuery(Guid Id) : IRequest<Result<ChangeOrderDto>>;
