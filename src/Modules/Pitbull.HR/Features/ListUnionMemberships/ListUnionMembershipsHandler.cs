using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListUnionMemberships;

public class ListUnionMembershipsHandler : IRequestHandler<ListUnionMembershipsQuery, Result<PagedResult<UnionMembershipListDto>>>
{
    private readonly PitbullDbContext _context;
    public ListUnionMembershipsHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PagedResult<UnionMembershipListDto>>> Handle(ListUnionMembershipsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<UnionMembership>().Include(u => u.Employee).Where(u => !u.IsDeleted).AsQueryable();

        if (request.EmployeeId.HasValue)
            query = query.Where(u => u.EmployeeId == request.EmployeeId.Value);
        if (!string.IsNullOrEmpty(request.UnionLocal))
            query = query.Where(u => u.UnionLocal.Contains(request.UnionLocal));
        if (request.ActiveOnly == true)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            query = query.Where(u => u.ExpirationDate == null || u.ExpirationDate >= today);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(u => u.UnionLocal).ThenBy(u => u.Classification)
            .Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(u => UnionMembershipMapper.ToListDto(u, u.Employee.FirstName + " " + u.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<UnionMembershipListDto>(items, totalCount, request.Page, request.PageSize));
    }
}
