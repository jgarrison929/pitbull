using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetDeduction;

public record GetDeductionQuery(Guid Id) : IRequest<Result<DeductionDto>>;
