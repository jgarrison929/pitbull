using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Features.PostPayrollBatch;

public record PostPayrollBatchCommand(Guid Id, string PostedBy) : IRequest<Result<PayrollBatchDto>>;
