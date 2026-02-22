namespace Pitbull.Core.Domain;

public class PurchaseOrder : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public string PONumber { get; set; } = string.Empty;
    public Guid ProjectId { get; set; }
    public Guid VendorId { get; set; }
    public string? Description { get; set; }
    public decimal SubtotalAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public Guid? TaxJurisdictionId { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public decimal ExchangeRate { get; set; } = 1.0m;
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;
    public Guid? ApprovedById { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public bool IsTaxExempt { get; set; }
    public string? TaxExemptReason { get; set; }

    public List<PurchaseOrderLine> Lines { get; set; } = [];
}

public class PurchaseOrderLine : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid PurchaseOrderId { get; set; }
    public PurchaseOrder PurchaseOrder { get; set; } = null!;

    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal? TaxRate { get; set; }
    public bool IsTaxable { get; set; } = true;
    public Guid? CostCodeId { get; set; }
    public decimal ReceivedQuantity { get; set; }
}

public enum PurchaseOrderStatus
{
    Draft = 1,
    Approved = 2,
    PartiallyReceived = 3,
    Received = 4,
    Closed = 5
}
