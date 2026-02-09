using MediatR;

namespace Pitbull.HR.Features.DeletePayRate;

public record DeletePayRateCommand(Guid Id) : IRequest<bool>;
