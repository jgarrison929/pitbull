using MediatR;

namespace Pitbull.HR.Features.DeleteDeduction;

public record DeleteDeductionCommand(Guid Id) : IRequest<bool>;
