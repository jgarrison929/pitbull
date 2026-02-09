using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListDeductions;

public class ListDeductionsHandler : IRequestHandler<ListDeductionsQuery, Result<PagedResult<DeductionListDto>>>
{
    private readonly PitbullDbContext _context;
    public ListDeductionsHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PagedResult<DeductionListDto>>> Handle(ListDeductionsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<Deduction>().Include(d => d.Employee).Where(d => !d.IsDeleted).AsQueryable();

        if (request.EmployeeId.HasValue)
            query = query.Where(d => d.EmployeeId == request.EmployeeId.Value);
        if (!string.IsNullOrEmpty(request.DeductionCode))
            query = query.Where(d => d.DeductionCode == request.DeductionCode.ToUpperInvariant());
        if (request.ActiveOnly == true)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            query = query.Where(d => d.ExpirationDate == null || d.ExpirationDate >= today);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(d => d.Priority).ThenBy(d => d.DeductionCode)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(d => DeductionMapper.ToListDto(d, d.Employee.FirstName + " " + d.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<DeductionListDto>(items, totalCount, request.Page, request.PageSize));
    }
}
