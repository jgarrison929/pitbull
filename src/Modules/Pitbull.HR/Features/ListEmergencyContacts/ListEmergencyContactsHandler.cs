using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListEmergencyContacts;

public class ListEmergencyContactsHandler : IRequestHandler<ListEmergencyContactsQuery, Result<PagedResult<EmergencyContactListDto>>>
{
    private readonly PitbullDbContext _context;

    public ListEmergencyContactsHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PagedResult<EmergencyContactListDto>>> Handle(ListEmergencyContactsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<EmergencyContact>()
            .Include(c => c.Employee)
            .Where(c => !c.IsDeleted)
            .AsQueryable();

        if (request.EmployeeId.HasValue)
        {
            query = query.Where(c => c.EmployeeId == request.EmployeeId.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(c => c.Priority)
            .ThenBy(c => c.Name)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => EmergencyContactMapper.ToListDto(c, c.Employee.FirstName + " " + c.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<EmergencyContactListDto>(
            items,
            totalCount,
            request.Page,
            request.PageSize
        ));
    }
}
