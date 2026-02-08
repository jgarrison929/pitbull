using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.DeletePaymentApplication;

public record DeletePaymentApplicationCommand(Guid Id) : IRequest<Result<bool>>;
