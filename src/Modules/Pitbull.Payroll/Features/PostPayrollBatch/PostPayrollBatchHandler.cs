using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.PostPayrollBatch;

public class PostPayrollBatchHandler : IRequestHandler<PostPayrollBatchCommand, Result<PayrollBatchDto>>
{
    private readonly PitbullDbContext _context;
    public PostPayrollBatchHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PayrollBatchDto>> Handle(PostPayrollBatchCommand request, CancellationToken cancellationToken)
    {
        var batch = await _context.Set<PayrollBatch>()
            .FirstOrDefaultAsync(b => b.Id == request.Id && !b.IsDeleted, cancellationToken);
        
        if (batch == null)
            return Result.Failure<PayrollBatchDto>("Payroll batch not found", "NOT_FOUND");

        if (batch.Status != PayrollBatchStatus.Approved)
            return Result.Failure<PayrollBatchDto>("Batch must be approved before posting", "NOT_APPROVED");

        batch.Status = PayrollBatchStatus.Posted;
        batch.PostedBy = request.PostedBy;
        batch.PostedAt = DateTime.UtcNow;
        batch.UpdatedAt = DateTime.UtcNow;

        // TODO: Update YTD amounts on payroll entries
        // TODO: Create GL journal entries

        await _context.SaveChangesAsync(cancellationToken);
        return Result.Success(PayrollBatchMapper.ToDto(batch));
    }
}
