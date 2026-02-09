using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.ApprovePayrollBatch;

public class ApprovePayrollBatchHandler : IRequestHandler<ApprovePayrollBatchCommand, Result<PayrollBatchDto>>
{
    private readonly PitbullDbContext _context;
    public ApprovePayrollBatchHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PayrollBatchDto>> Handle(ApprovePayrollBatchCommand request, CancellationToken cancellationToken)
    {
        var batch = await _context.Set<PayrollBatch>()
            .FirstOrDefaultAsync(b => b.Id == request.Id && !b.IsDeleted, cancellationToken);
        
        if (batch == null)
            return Result.Failure<PayrollBatchDto>("Payroll batch not found", "NOT_FOUND");

        if (batch.Status != PayrollBatchStatus.Calculated)
            return Result.Failure<PayrollBatchDto>("Batch must be calculated before approval", "NOT_CALCULATED");

        batch.Status = PayrollBatchStatus.Approved;
        batch.ApprovedBy = request.ApprovedBy;
        batch.ApprovedAt = DateTime.UtcNow;
        batch.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result.Success(PayrollBatchMapper.ToDto(batch));
    }
}
