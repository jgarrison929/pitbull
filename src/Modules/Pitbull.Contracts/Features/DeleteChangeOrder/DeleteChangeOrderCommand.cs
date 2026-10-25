using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.DeleteChangeOrder;

public record DeleteChangeOrderCommand(Guid Id) : ICommand<bool>;
