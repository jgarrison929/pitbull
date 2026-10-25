using Pitbull.Billing.Features.LienWaivers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public interface ILienWaiverService
{
    Task<Result<ListLienWaiversResult>> GetLienWaiversAsync(ListLienWaiversQuery query, CancellationToken cancellationToken = default);
    Task<Result<LienWaiverDto>> GetLienWaiverAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<LienWaiverDto>> CreateLienWaiverAsync(CreateLienWaiverCommand command, CancellationToken cancellationToken = default);
    Task<Result<LienWaiverDto>> UpdateLienWaiverAsync(UpdateLienWaiverCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteLienWaiverAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<LienWaiverDto>> ApproveAsync(Guid id, Guid reviewedByUserId, CancellationToken cancellationToken = default);
    Task<Result<LienWaiverDto>> RejectAsync(Guid id, Guid reviewedByUserId, string reason, CancellationToken cancellationToken = default);
    Task<Result<LienWaiverDto>> MarkReceivedAsync(Guid id, string? documentPath, CancellationToken cancellationToken = default);
}
