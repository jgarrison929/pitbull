using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Features.GetPayrollBatch;

public record GetPayrollBatchQuery(Guid Id) : IRequest<Result<PayrollBatchDto>>;
