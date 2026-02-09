using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListWithholdingElections;

public class ListWithholdingElectionsHandler : IRequestHandler<ListWithholdingElectionsQuery, Result<PagedResult<WithholdingElectionListDto>>>
{
    private readonly PitbullDbContext _context;

    public ListWithholdingElectionsHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<PagedResult<WithholdingElectionListDto>>> Handle(ListWithholdingElectionsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<WithholdingElection>()
            .Include(w => w.Employee)
            .Where(w => !w.IsDeleted)
            .AsQueryable();

        if (request.EmployeeId.HasValue)
            query = query.Where(w => w.EmployeeId == request.EmployeeId.Value);

        if (!string.IsNullOrEmpty(request.TaxJurisdiction))
            query = query.Where(w => w.TaxJurisdiction == request.TaxJurisdiction.ToUpperInvariant());

        if (request.CurrentOnly == true)
            query = query.Where(w => w.ExpirationDate == null);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(w => w.TaxJurisdiction)
            .ThenByDescending(w => w.EffectiveDate)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(w => WithholdingElectionMapper.ToListDto(w, w.Employee.FirstName + " " + w.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<WithholdingElectionListDto>(items, totalCount, request.Page, request.PageSize));
    }
}
