using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListEmploymentEpisodes;

public class ListEmploymentEpisodesHandler : IRequestHandler<ListEmploymentEpisodesQuery, Result<PagedResult<EmploymentEpisodeListDto>>>
{
    private readonly PitbullDbContext _context;

    public ListEmploymentEpisodesHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PagedResult<EmploymentEpisodeListDto>>> Handle(ListEmploymentEpisodesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Set<EmploymentEpisode>()
            .Include(ep => ep.Employee)
            .Where(ep => !ep.IsDeleted)
            .AsQueryable();

        if (request.EmployeeId.HasValue)
            query = query.Where(ep => ep.EmployeeId == request.EmployeeId.Value);

        if (request.CurrentOnly == true)
            query = query.Where(ep => ep.TerminationDate == null);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(ep => ep.HireDate)
            .ThenBy(ep => ep.EpisodeNumber)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(ep => EmploymentEpisodeMapper.ToListDto(ep, ep.Employee.FirstName + " " + ep.Employee.LastName))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<EmploymentEpisodeListDto>(
            items, totalCount, request.Page, request.PageSize
        ));
    }
}
