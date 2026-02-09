using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListI9Records;

public class ListI9RecordsHandler : IRequestHandler<ListI9RecordsQuery, Result<PagedResult<I9RecordListDto>>>
{
    private readonly PitbullDbContext _context;
    public ListI9RecordsHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PagedResult<I9RecordListDto>>> Handle(ListI9RecordsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<I9Record>().Include(i => i.Employee).Where(i => !i.IsDeleted).AsQueryable();

        if (request.EmployeeId.HasValue)
            query = query.Where(i => i.EmployeeId == request.EmployeeId.Value);
        if (request.Status.HasValue)
            query = query.Where(i => i.Status == request.Status.Value);
        if (request.NeedsReverification == true)
        {
            var cutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(90));
            query = query.Where(i => i.WorkAuthorizationExpires.HasValue && i.WorkAuthorizationExpires.Value <= cutoff);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(i => i.WorkAuthorizationExpires ?? DateOnly.MaxValue)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(i => I9RecordMapper.ToListDto(i, i.Employee.FirstName + " " + i.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<I9RecordListDto>(items, totalCount, request.Page, request.PageSize));
    }
}
