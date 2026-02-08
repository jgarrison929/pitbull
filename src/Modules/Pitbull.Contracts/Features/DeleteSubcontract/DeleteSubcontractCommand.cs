using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.DeleteSubcontract;

public record DeleteSubcontractCommand(Guid Id) : ICommand<bool>;
