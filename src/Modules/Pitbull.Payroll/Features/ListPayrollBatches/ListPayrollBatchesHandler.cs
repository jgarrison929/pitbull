using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;

namespace Pitbull.Payroll.Features.ListPayrollBatches;

public class ListPayrollBatchesHandler : IRequestHandler<ListPayrollBatchesQuery, Result<PagedResult<PayrollBatchListDto>>>
{
    private readonly PitbullDbContext _context;
    public ListPayrollBatchesHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PagedResult<PayrollBatchListDto>>> Handle(ListPayrollBatchesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<PayrollBatch>().Where(b => !b.IsDeleted).AsQueryable();

        if (request.PayPeriodId.HasValue)
            query = query.Where(b => b.PayPeriodId == request.PayPeriodId.Value);
        if (request.Status.HasValue)
            query = query.Where(b => b.Status == request.Status.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(b => PayrollBatchMapper.ToListDto(b))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<PayrollBatchListDto>(items, totalCount, request.Page, request.PageSize));
    }
}
