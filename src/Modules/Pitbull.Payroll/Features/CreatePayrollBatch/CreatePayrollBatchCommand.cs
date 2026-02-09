using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Features.CreatePayrollBatch;

public record CreatePayrollBatchCommand(
    Guid PayPeriodId, string? Notes
) : IRequest<Result<PayrollBatchDto>>;
