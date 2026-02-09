using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListCertifications;

public class ListCertificationsHandler : IRequestHandler<ListCertificationsQuery, Result<PagedResult<CertificationListDto>>>
{
    private readonly PitbullDbContext _context;

    public ListCertificationsHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PagedResult<CertificationListDto>>> Handle(ListCertificationsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<Certification>()
            .Include(c => c.Employee)
            .Where(c => !c.IsDeleted)
            .AsQueryable();

        // Apply filters
        if (request.EmployeeId.HasValue)
        {
            query = query.Where(c => c.EmployeeId == request.EmployeeId.Value);
        }

        if (!string.IsNullOrEmpty(request.CertificationTypeCode))
        {
            query = query.Where(c => c.CertificationTypeCode == request.CertificationTypeCode);
        }

        if (request.Status.HasValue)
        {
            query = query.Where(c => c.Status == request.Status.Value);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (request.ExpiringSoon == true)
        {
            var cutoff = today.AddDays(90);
            query = query.Where(c => c.ExpirationDate.HasValue 
                && c.ExpirationDate.Value >= today 
                && c.ExpirationDate.Value <= cutoff);
        }

        if (request.Expired == true)
        {
            query = query.Where(c => c.ExpirationDate.HasValue && c.ExpirationDate.Value < today);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(c => c.ExpirationDate ?? DateOnly.MaxValue)
            .ThenBy(c => c.Employee.LastName)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => CertificationMapper.ToListDto(c, c.Employee.FirstName + " " + c.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<CertificationListDto>(
            items,
            totalCount,
            request.Page,
            request.PageSize
        ));
    }
}
