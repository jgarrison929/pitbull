using MediatR;

namespace Pitbull.HR.Features.DeleteEmploymentEpisode;

public record DeleteEmploymentEpisodeCommand(Guid Id) : IRequest<bool>;
