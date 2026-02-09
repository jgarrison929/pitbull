using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Features.ApprovePayrollBatch;

public record ApprovePayrollBatchCommand(Guid Id, string ApprovedBy) : IRequest<Result<PayrollBatchDto>>;
