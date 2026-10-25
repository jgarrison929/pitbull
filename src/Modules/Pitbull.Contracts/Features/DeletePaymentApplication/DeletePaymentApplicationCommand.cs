using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.DeletePaymentApplication;

public record DeletePaymentApplicationCommand(Guid Id) : ICommand<bool>;
