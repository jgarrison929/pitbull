using Pitbull.Billing.Features.Retention;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IRetentionService
{
    // Policies
    Task<Result<ListRetentionPoliciesResult>> GetPoliciesAsync(ListRetentionPoliciesQuery query, CancellationToken cancellationToken = default);
    Task<Result<RetentionPolicyDto>> GetPolicyAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<RetentionPolicyDto>> CreatePolicyAsync(CreateRetentionPolicyCommand command, CancellationToken cancellationToken = default);
    Task<Result<RetentionPolicyDto>> UpdatePolicyAsync(UpdateRetentionPolicyCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeletePolicyAsync(Guid id, CancellationToken cancellationToken = default);

    // Holds
    Task<Result<ListRetentionHoldsResult>> GetHoldsAsync(ListRetentionHoldsQuery query, CancellationToken cancellationToken = default);
    Task<Result<RetentionHoldDto>> GetHoldAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<RetentionHoldDto>> CreateHoldAsync(CreateRetentionHoldCommand command, CancellationToken cancellationToken = default);
    Task<Result<RetentionHoldDto>> ReleaseRetentionAsync(ReleaseRetentionCommand command, CancellationToken cancellationToken = default);
}
