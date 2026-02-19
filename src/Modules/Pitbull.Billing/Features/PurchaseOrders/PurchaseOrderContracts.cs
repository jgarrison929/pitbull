using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.PurchaseOrders;

public record PurchaseOrderDto(
    Guid Id,
    string PONumber,
    Guid ProjectId,
    Guid VendorId,
    string? Description,
    decimal TotalAmount,
    PurchaseOrderStatus Status,
    string StatusName,
    Guid? ApprovedById,
    DateTime? ApprovedAt,
    IReadOnlyList<PurchaseOrderLineDto> Lines,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record PurchaseOrderLineDto(
    Guid Id,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Amount,
    Guid? CostCodeId,
    decimal ReceivedQuantity
);

public record CreatePurchaseOrderCommand(
    Guid ProjectId,
    Guid VendorId,
    string? Description,
    List<CreatePurchaseOrderLineCommand> Lines
) : ICommand<PurchaseOrderDto>;

public record CreatePurchaseOrderLineCommand(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    Guid? CostCodeId = null
);

public record UpdatePurchaseOrderCommand(
    Guid PurchaseOrderId,
    Guid? ProjectId = null,
    Guid? VendorId = null,
    string? Description = null,
    List<CreatePurchaseOrderLineCommand>? Lines = null,
    PurchaseOrderStatus? Status = null
) : ICommand<PurchaseOrderDto>;

public record ReceivePurchaseOrderCommand(
    Guid PurchaseOrderId,
    List<PurchaseOrderReceiveLineCommand> Lines
) : ICommand<PurchaseOrderDto>;

public record PurchaseOrderReceiveLineCommand(
    Guid PurchaseOrderLineId,
    decimal ReceivedQuantity
);

public record ListPurchaseOrdersQuery(
    PurchaseOrderStatus? Status = null,
    Guid? VendorId = null,
    Guid? ProjectId = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListPurchaseOrdersResult>;

public record ListPurchaseOrdersResult(
    IReadOnlyList<PurchaseOrderDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
