using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.DeleteChangeOrder;

public record DeleteChangeOrderCommand(Guid Id) : IRequest<Result<bool>>;
