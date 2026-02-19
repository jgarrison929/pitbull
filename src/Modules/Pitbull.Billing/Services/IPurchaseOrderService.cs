using Pitbull.Billing.Features.PurchaseOrders;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IPurchaseOrderService
{
    Task<Result<ListPurchaseOrdersResult>> GetPurchaseOrdersAsync(ListPurchaseOrdersQuery query, CancellationToken cancellationToken = default);
    Task<Result<PurchaseOrderDto>> GetPurchaseOrderAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PurchaseOrderDto>> CreatePurchaseOrderAsync(CreatePurchaseOrderCommand command, CancellationToken cancellationToken = default);
    Task<Result<PurchaseOrderDto>> UpdatePurchaseOrderAsync(UpdatePurchaseOrderCommand command, CancellationToken cancellationToken = default);
    Task<Result<PurchaseOrderDto>> ApprovePurchaseOrderAsync(Guid id, Guid approvedById, CancellationToken cancellationToken = default);
    Task<Result<PurchaseOrderDto>> ReceivePurchaseOrderAsync(ReceivePurchaseOrderCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeletePurchaseOrderAsync(Guid id, CancellationToken cancellationToken = default);
}
