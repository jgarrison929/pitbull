using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.GetPayPeriod;

public class GetPayPeriodHandler : IRequestHandler<GetPayPeriodQuery, Result<PayPeriodDto>>
{
    private readonly PitbullDbContext _context;
    public GetPayPeriodHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PayPeriodDto>> Handle(GetPayPeriodQuery request, CancellationToken cancellationToken)
    {
        var period = await _context.Set<PayPeriod>()
            .Include(p => p.Batches)
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);
        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");
        return Result.Success(PayPeriodMapper.ToDto(period));
    }
}
