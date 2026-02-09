using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetEmploymentEpisode;

public record GetEmploymentEpisodeQuery(Guid Id) : IRequest<Result<EmploymentEpisodeDto>>;
