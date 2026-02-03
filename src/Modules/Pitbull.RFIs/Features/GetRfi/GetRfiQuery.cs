using Pitbull.Core.CQRS;

namespace Pitbull.RFIs.Features.GetRfi;

public record GetRfiQuery(Guid ProjectId, Guid Id) : IQuery<RfiDto>;