using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Features.Wip;

public interface IWipGlPostingService
{
    Task<Result<WipGlPostResult>> PostToGlAsync(Guid wipReportId, string postedByUserId, CancellationToken ct = default);
}
