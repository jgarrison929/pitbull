using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.ListEmploymentEpisodes;

public record ListEmploymentEpisodesQuery(
    Guid? EmployeeId = null,
    bool? CurrentOnly = null
) : IRequest<Result<PagedResult<EmploymentEpisodeListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
