using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.ListPayPeriods;

/// <summary>
/// Query to list pay periods with filtering
/// </summary>
public record ListPayPeriodsQuery(
    PayPeriodStatus? Status = null,
    DateOnly? StartDateFrom = null,
    DateOnly? StartDateTo = null
) : PaginationQuery, IQuery<PagedResult<PayPeriodDto>>;

public sealed class ListPayPeriodsHandler(PitbullDbContext db)
    : IRequestHandler<ListPayPeriodsQuery, Result<PagedResult<PayPeriodDto>>>
{
    public async Task<Result<PagedResult<PayPeriodDto>>> Handle(
        ListPayPeriodsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Set<PayPeriod>()
            .Include(p => p.LockedBy)
            .Include(p => p.ProcessedBy)
            .AsQueryable();

        // Apply filters
        if (request.Status.HasValue)
            query = query.Where(p => p.Status == request.Status.Value);

        if (request.StartDateFrom.HasValue)
            query = query.Where(p => p.StartDate >= request.StartDateFrom.Value);

        if (request.StartDateTo.HasValue)
            query = query.Where(p => p.StartDate <= request.StartDateTo.Value);

        // Order by start date descending (most recent first)
        query = query.OrderByDescending(p => p.StartDate);

        // Get total count
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply pagination
        var items = await query
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(PayPeriodMapper.ToDto).ToList();

        return Result.Success(new PagedResult<PayPeriodDto>(
            dtos,
            totalCount,
            request.Page,
            request.PageSize));
    }
}
