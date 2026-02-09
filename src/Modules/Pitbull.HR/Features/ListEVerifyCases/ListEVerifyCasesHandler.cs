using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListEVerifyCases;

public class ListEVerifyCasesHandler : IRequestHandler<ListEVerifyCasesQuery, Result<PagedResult<EVerifyCaseListDto>>>
{
    private readonly PitbullDbContext _context;
    public ListEVerifyCasesHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PagedResult<EVerifyCaseListDto>>> Handle(ListEVerifyCasesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<EVerifyCase>().Include(e => e.Employee).Where(e => !e.IsDeleted).AsQueryable();

        if (request.EmployeeId.HasValue)
            query = query.Where(e => e.EmployeeId == request.EmployeeId.Value);
        if (request.Status.HasValue)
            query = query.Where(e => e.Status == request.Status.Value);
        if (request.NeedsAction == true)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            query = query.Where(e => e.Status == EVerifyStatus.TNCPending && e.TNCDeadline.HasValue && e.TNCDeadline >= today);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(e => e.SubmittedDate)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(e => EVerifyCaseMapper.ToListDto(e, e.Employee.FirstName + " " + e.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<EVerifyCaseListDto>(items, totalCount, request.Page, request.PageSize));
    }
}
