using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IBillingApplicationService
{
    Task<Result<ListBillingApplicationsResult>> ListAsync(ListBillingApplicationsQuery query, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> GetAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> CreateAsync(CreateBillingApplicationCommand command, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> RecalculateAsync(Guid billingApplicationId, CancellationToken ct = default);
    Task<Result<BillingApplicationLineItemDto>> UpdateLineAsync(UpdateBillingApplicationLineCommand command, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> BulkUpdateLinesAsync(BulkUpdateBillingLinesCommand command, CancellationToken ct = default);

    // Workflow
    Task<Result<BillingApplicationDto>> SubmitForReviewAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> ApproveReviewAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> RejectReviewAsync(Guid id, string? comments, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> ReturnToDraftAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> SubmitToOwnerAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> MarkArchitectCertifiedAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> MarkDisputedAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> ResolveDisputeAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> MarkPaymentDueAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> MarkPartiallyPaidAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> MarkPaidAsync(Guid id, CancellationToken ct = default);
    Task<Result<BillingApplicationDto>> VoidAsync(Guid id, CancellationToken ct = default);
}
