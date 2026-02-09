using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListPayRates;

public class ListPayRatesHandler : IRequestHandler<ListPayRatesQuery, Result<PagedResult<PayRateListDto>>>
{
    private readonly PitbullDbContext _context;

    public ListPayRatesHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PagedResult<PayRateListDto>>> Handle(ListPayRatesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<PayRate>()
            .Include(p => p.Employee)
            .Where(p => !p.IsDeleted)
            .AsQueryable();

        // Apply filters
        if (request.EmployeeId.HasValue)
        {
            query = query.Where(p => p.EmployeeId == request.EmployeeId.Value);
        }

        if (request.RateType.HasValue)
        {
            query = query.Where(p => p.RateType == request.RateType.Value);
        }

        if (request.ProjectId.HasValue)
        {
            query = query.Where(p => p.ProjectId == request.ProjectId.Value);
        }

        if (!string.IsNullOrEmpty(request.ShiftCode))
        {
            query = query.Where(p => p.ShiftCode == request.ShiftCode);
        }

        if (!string.IsNullOrEmpty(request.WorkState))
        {
            query = query.Where(p => p.WorkState == request.WorkState);
        }

        var asOfDate = request.AsOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        if (request.ActiveOnly == true)
        {
            query = query.Where(p => 
                p.EffectiveDate <= asOfDate && 
                (!p.ExpirationDate.HasValue || p.ExpirationDate.Value >= asOfDate));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(p => p.Priority)
            .ThenByDescending(p => p.EffectiveDate)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => PayRateMapper.ToListDto(p, p.Employee.FirstName + " " + p.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<PayRateListDto>(
            items,
            totalCount,
            request.Page,
            request.PageSize
        ));
    }
}
