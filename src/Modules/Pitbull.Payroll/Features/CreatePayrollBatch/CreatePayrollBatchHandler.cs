using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.CreatePayrollBatch;

public class CreatePayrollBatchHandler : IRequestHandler<CreatePayrollBatchCommand, Result<PayrollBatchDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreatePayrollBatchHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<PayrollBatchDto>> Handle(CreatePayrollBatchCommand request, CancellationToken cancellationToken)
    {
        var period = await _context.Set<PayPeriod>()
            .Include(p => p.Batches)
            .FirstOrDefaultAsync(p => p.Id == request.PayPeriodId && !p.IsDeleted, cancellationToken);
        
        if (period == null)
            return Result.Failure<PayrollBatchDto>("Pay period not found", "PERIOD_NOT_FOUND");

        if (period.Status == PayPeriodStatus.Closed)
            return Result.Failure<PayrollBatchDto>("Pay period is closed", "PERIOD_CLOSED");

        // Generate batch number
        var batchCount = period.Batches.Count(b => !b.IsDeleted) + 1;
        var batchNumber = $"{period.EndDate:yyyyMMdd}-{batchCount:D2}";

        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PayPeriodId = request.PayPeriodId,
            BatchNumber = batchNumber,
            Status = PayrollBatchStatus.Draft,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<PayrollBatch>().Add(batch);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(PayrollBatchMapper.ToDto(batch));
    }
}
