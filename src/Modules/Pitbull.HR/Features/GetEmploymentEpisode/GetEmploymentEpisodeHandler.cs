using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetEmploymentEpisode;

public class GetEmploymentEpisodeHandler : IRequestHandler<GetEmploymentEpisodeQuery, Result<EmploymentEpisodeDto>>
{
    private readonly PitbullDbContext _context;

    public GetEmploymentEpisodeHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<EmploymentEpisodeDto>> Handle(GetEmploymentEpisodeQuery request, CancellationToken cancellationToken)
    {
        var episode = await _context.Set<EmploymentEpisode>()
            .FirstOrDefaultAsync(ep => ep.Id == request.Id && !ep.IsDeleted, cancellationToken);

        if (episode == null)
            return Result.Failure<EmploymentEpisodeDto>("Employment episode not found", "NOT_FOUND");

        return Result.Success(EmploymentEpisodeMapper.ToDto(episode));
    }
}
