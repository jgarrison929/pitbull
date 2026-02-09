using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.ClosePayPeriod;

public class ClosePayPeriodHandler : IRequestHandler<ClosePayPeriodCommand, Result<PayPeriodDto>>
{
    private readonly PitbullDbContext _context;
    public ClosePayPeriodHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PayPeriodDto>> Handle(ClosePayPeriodCommand request, CancellationToken cancellationToken)
    {
        var period = await _context.Set<PayPeriod>()
            .Include(p => p.Batches)
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);
        
        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status == PayPeriodStatus.Closed)
            return Result.Failure<PayPeriodDto>("Pay period is already closed", "ALREADY_CLOSED");

        // Verify all batches are posted
        if (period.Batches.Any(b => b.Status != PayrollBatchStatus.Posted && !b.IsDeleted))
            return Result.Failure<PayPeriodDto>("All batches must be posted before closing period", "BATCHES_NOT_POSTED");

        period.Status = PayPeriodStatus.Closed;
        period.ApprovedBy = request.ClosedBy;
        period.ApprovedAt = DateTime.UtcNow;
        period.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result.Success(PayPeriodMapper.ToDto(period));
    }
}
