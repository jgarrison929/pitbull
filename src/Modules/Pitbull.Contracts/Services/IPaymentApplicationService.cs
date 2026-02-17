using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Services;

/// <summary>
/// Service for enhanced payment application operations including G702/G703
/// line-item management, workflow transitions, and SOV integration.
/// </summary>
public interface IPaymentApplicationService
{
    // === Line Items (G703) ===

    Task<Result<IReadOnlyList<PaymentApplicationLineItemDto>>> GetLineItemsAsync(
        Guid paymentApplicationId, CancellationToken cancellationToken = default);

    Task<Result<IReadOnlyList<PaymentApplicationLineItemDto>>> UpdateLineItemsAsync(
        Guid paymentApplicationId, UpdatePaymentApplicationLineItemsRequest request,
        CancellationToken cancellationToken = default);

    // === Workflow Transitions ===

    Task<Result<PaymentApplicationDetailDto>> SubmitAsync(
        Guid id, CancellationToken cancellationToken = default);

    Task<Result<PaymentApplicationDetailDto>> ReviewAsync(
        Guid id, ReviewPaymentApplicationRequest request, CancellationToken cancellationToken = default);

    Task<Result<PaymentApplicationDetailDto>> ApproveAsync(
        Guid id, ApprovePaymentApplicationRequest request, CancellationToken cancellationToken = default);

    Task<Result<PaymentApplicationDetailDto>> MarkPaidAsync(
        Guid id, MarkPaymentApplicationPaidRequest request, CancellationToken cancellationToken = default);

    // === SOV Integration ===

    Task<Result<PaymentApplicationDetailDto>> CreateFromSovAsync(
        Guid sovId, CreatePaymentApplicationFromSovRequest request,
        CancellationToken cancellationToken = default);

    // === Summary ===

    Task<Result<PaymentApplicationDetailDto>> GetDetailAsync(
        Guid id, CancellationToken cancellationToken = default);

    Task<Result<PaymentApplicationG702Dto>> GetSummaryAsync(
        Guid id, AccountingBookType? bookType = null, CancellationToken cancellationToken = default);
}
