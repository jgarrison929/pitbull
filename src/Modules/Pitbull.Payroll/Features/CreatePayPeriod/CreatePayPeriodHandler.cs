using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.CreatePayPeriod;

public class CreatePayPeriodHandler : IRequestHandler<CreatePayPeriodCommand, Result<PayPeriodDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreatePayPeriodHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<PayPeriodDto>> Handle(CreatePayPeriodCommand request, CancellationToken cancellationToken)
    {
        // Check for overlapping periods
        var overlap = await _context.Set<PayPeriod>()
            .AnyAsync(p => !p.IsDeleted && 
                ((p.StartDate <= request.StartDate && p.EndDate >= request.StartDate) ||
                 (p.StartDate <= request.EndDate && p.EndDate >= request.EndDate) ||
                 (p.StartDate >= request.StartDate && p.EndDate <= request.EndDate)), cancellationToken);
        
        if (overlap)
            return Result.Failure<PayPeriodDto>("Pay period overlaps with existing period", "OVERLAP");

        var period = new PayPeriod
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            PayDate = request.PayDate,
            Frequency = request.Frequency,
            Status = PayPeriodStatus.Open,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<PayPeriod>().Add(period);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }
}
