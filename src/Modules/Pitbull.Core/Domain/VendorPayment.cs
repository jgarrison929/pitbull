namespace Pitbull.Core.Domain;

/// <summary>
/// Records a payment against one or more vendor invoices.
/// Supports partial payments, multiple payment methods, and GL posting.
/// </summary>
public class VendorPayment : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    /// <summary>Auto-generated payment number (e.g., "PMT-2026-000001").</summary>
    public string PaymentNumber { get; set; } = string.Empty;

    public Guid VendorId { get; set; }
    public Vendor? Vendor { get; set; }

    public DateOnly PaymentDate { get; set; }

    /// <summary>Total payment amount across all applied invoices.</summary>
    public decimal TotalAmount { get; set; }

    public PaymentMethod PaymentMethod { get; set; }

    /// <summary>Check number, ACH reference, wire confirmation, etc.</summary>
    public string? ReferenceNumber { get; set; }

    /// <summary>FK to BankAccount — the account funds are drawn from.</summary>
    public Guid? BankAccountId { get; set; }
    public BankAccount? BankAccount { get; set; }

    public VendorPaymentStatus Status { get; set; } = VendorPaymentStatus.Draft;

    public string? Memo { get; set; }

    /// <summary>FK to the journal entry created when posted.</summary>
    public Guid? JournalEntryId { get; set; }

    /// <summary>User who posted the payment.</summary>
    public Guid? PostedByUserId { get; set; }
    public DateTime? PostedAt { get; set; }

    // Navigation
    public List<VendorPaymentApplication> Applications { get; set; } = [];
}

/// <summary>
/// Joins a payment to a specific invoice with the amount applied.
/// Allows partial payments — one invoice can receive multiple payment applications.
/// </summary>
public class VendorPaymentApplication : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid VendorPaymentId { get; set; }
    public VendorPayment VendorPayment { get; set; } = null!;

    public Guid VendorInvoiceId { get; set; }
    public VendorInvoice VendorInvoice { get; set; } = null!;

    /// <summary>Amount from this payment applied to this invoice.</summary>
    public decimal AppliedAmount { get; set; }
}

public enum VendorPaymentStatus
{
    Draft = 1,
    Approved = 2,
    Posted = 3,
    Voided = 4
}

public enum PaymentMethod
{
    Check = 1,
    ACH = 2,
    Wire = 3,
    CreditCard = 4,
    Cash = 5,
    Other = 6
}
