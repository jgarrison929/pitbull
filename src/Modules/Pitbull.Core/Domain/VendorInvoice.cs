namespace Pitbull.Core.Domain;

public class VendorInvoice : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid VendorId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateOnly InvoiceDate { get; set; }
    public DateOnly DueDate { get; set; }
    public decimal SubtotalAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal? TaxRate { get; set; }
    public Guid? TaxJurisdictionId { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public decimal ExchangeRate { get; set; } = 1.0m;
    public VendorInvoiceStatus Status { get; set; } = VendorInvoiceStatus.Pending;
    public Guid? PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public bool IsTaxExempt { get; set; }
    public string? TaxExemptReason { get; set; }

    public List<InvoiceMatchResult> MatchResults { get; set; } = [];
}

public class InvoiceMatchResult : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid VendorInvoiceId { get; set; }
    public VendorInvoice VendorInvoice { get; set; } = null!;

    public Guid? PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }

    public InvoiceMatchType MatchType { get; set; }
    public decimal VarianceAmount { get; set; }
    public decimal VariancePercent { get; set; }
    public bool AutoApproved { get; set; }
    public DateTime MatchedAt { get; set; }
}

public enum VendorInvoiceStatus
{
    Pending = 1,
    Matched = 2,
    PartiallyMatched = 3,
    Approved = 4,
    Paid = 5
}

public enum InvoiceMatchType
{
    TwoWay = 1,
    ThreeWay = 2
}
