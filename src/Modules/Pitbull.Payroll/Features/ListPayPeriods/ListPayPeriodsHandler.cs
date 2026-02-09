using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.ListPayPeriods;

public class ListPayPeriodsHandler : IRequestHandler<ListPayPeriodsQuery, Result<PagedResult<PayPeriodListDto>>>
{
    private readonly PitbullDbContext _context;
    public ListPayPeriodsHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PagedResult<PayPeriodListDto>>> Handle(ListPayPeriodsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<PayPeriod>().Include(p => p.Batches).Where(p => !p.IsDeleted).AsQueryable();

        if (request.Status.HasValue)
            query = query.Where(p => p.Status == request.Status.Value);
        if (request.Year.HasValue)
            query = query.Where(p => p.StartDate.Year == request.Year.Value || p.EndDate.Year == request.Year.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(p => p.StartDate)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(p => PayPeriodMapper.ToListDto(p))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<PayPeriodListDto>(items, totalCount, request.Page, request.PageSize));
    }
}
