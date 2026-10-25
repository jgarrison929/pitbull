namespace Pitbull.Core.Domain;

// ── Owner Contract ──

public class OwnerContract : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }

    public string ContractNumber { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string? OwnerName { get; set; }
    public string? OwnerAddress { get; set; }
    public string? ArchitectName { get; set; }
    public string? ArchitectProjectNumber { get; set; }

    public decimal OriginalContractSum { get; set; }
    public decimal ApprovedChangeOrderAmount { get; set; }
    public decimal ContractSumToDate { get; set; }

    public decimal DefaultRetainagePercent { get; set; } = 10m;
    public decimal RetainagePercentMaterials { get; set; } = 10m;

    public DateOnly? ContractDate { get; set; }
    public int PaymentTermsDays { get; set; } = 30;

    public OwnerContractStatus Status { get; set; } = OwnerContractStatus.Active;
    public string? Notes { get; set; }
}

public enum OwnerContractStatus
{
    Active = 1,
    Closed = 2,
    Void = 3
}

// ── Owner Schedule of Values ──

public class OwnerScheduleOfValues : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid OwnerContractId { get; set; }

    public string Name { get; set; } = "Main SOV";
    public decimal OriginalContractAmount { get; set; }
    public decimal ApprovedChangeOrderAmount { get; set; }
    public decimal RevisedContractAmount { get; set; }
    public decimal TotalScheduledValue { get; set; }
    public decimal DefaultRetainagePercent { get; set; } = 10m;

    public OwnerSOVStatus Status { get; set; } = OwnerSOVStatus.Draft;
    public DateTime? LockedDate { get; set; }
    public string? Notes { get; set; }

    public ICollection<OwnerSOVLineItem> LineItems { get; set; } = new List<OwnerSOVLineItem>();
}

public enum OwnerSOVStatus
{
    Draft = 1,
    Active = 2,
    Locked = 3,
    Closed = 4
}

// ── Owner SOV Line Item ──

public class OwnerSOVLineItem : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid OwnerScheduleOfValuesId { get; set; }

    // Identity
    public string ItemNumber { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    // Values
    public decimal OriginalValue { get; set; }
    public decimal ApprovedChangeOrderValue { get; set; }
    public decimal ScheduledValue { get; set; } // Original + CO adjustments (G703 Column C)

    // Retainage
    public decimal? RetainagePercent { get; set; } // Override per line (null = use SOV default)

    // Cost Code Mapping
    public Guid? CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }

    // Tracking
    public bool IsFromChangeOrder { get; set; }
    public Guid? SourceChangeOrderId { get; set; }

    public string? Notes { get; set; }
}

// ── Billing Application (G702) ──

public class BillingApplication : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid OwnerContractId { get; set; }
    public Guid OwnerScheduleOfValuesId { get; set; }

    // Identity
    public int ApplicationNumber { get; set; }
    public DateOnly PeriodFrom { get; set; }
    public DateOnly PeriodThrough { get; set; }
    public DateOnly ApplicationDate { get; set; }

    // G702 Lines 1-3: Contract Summary
    public decimal OriginalContractSum { get; set; }
    public decimal NetChangeByChangeOrders { get; set; }
    public decimal ContractSumToDate { get; set; }

    // G702 Line 4: Work Progress
    public decimal TotalCompletedAndStoredToDate { get; set; }

    // G702 Line 5: Retainage
    public decimal RetainageOnCompletedWork { get; set; }
    public decimal RetainageOnStoredMaterials { get; set; }
    public decimal TotalRetainage { get; set; }
    public decimal RetainagePercentWork { get; set; }
    public decimal RetainagePercentMaterials { get; set; }

    // G702 Lines 6-9: Net Amounts
    public decimal TotalEarnedLessRetainage { get; set; }
    public decimal LessPreviousCertificates { get; set; }
    public decimal CurrentPaymentDue { get; set; }
    public decimal BalanceToFinishIncludingRetainage { get; set; }

    // Status
    public BillingApplicationStatus Status { get; set; } = BillingApplicationStatus.Draft;

    // Notes
    public string? InternalNotes { get; set; }
    public string? BillingNarrative { get; set; }

    public ICollection<BillingApplicationLineItem> LineItems { get; set; } = new List<BillingApplicationLineItem>();
}

public enum BillingApplicationStatus
{
    Draft = 1,
    PmReview = 2,
    PmRejected = 3,
    ReadyToSubmit = 4,
    SubmittedToOwner = 5,
    Disputed = 6,
    ArchitectCertified = 7,
    PaymentDue = 8,
    PartiallyPaid = 9,
    Paid = 10,
    Void = 11
}

// ── Billing Application Line Item (G703) ──

public class BillingApplicationLineItem : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid BillingApplicationId { get; set; }
    public Guid OwnerSOVLineItemId { get; set; }

    // Snapshot (frozen at time of application creation)
    public string ItemNumber { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal ScheduledValue { get; set; } // Column C
    public int SortOrder { get; set; }

    // G703 Columns D-F (editable during draft)
    public decimal WorkCompletedPrevious { get; set; } // Column D
    public decimal WorkCompletedThisPeriod { get; set; } // Column E
    public decimal MaterialsStoredToDate { get; set; } // Column F

    // G703 Columns G-I (computed)
    public decimal TotalCompletedAndStored { get; set; } // Column G = D + E + F
    public decimal PercentComplete { get; set; } // Column H = G / C
    public decimal BalanceToFinish { get; set; } // Column I = C - G

    // Retainage
    public decimal? RetainagePercent { get; set; } // Line-level override
    public decimal RetainageAmount { get; set; }

    // Cost Alignment
    public Guid? CostCodeId { get; set; }
}

// ── Billing Period ──

public class BillingPeriod : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public string Name { get; set; } = string.Empty;
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public int BillingDeadlineDay { get; set; } = 25;

    public BillingPeriodStatus Status { get; set; } = BillingPeriodStatus.Open;
    public string? Notes { get; set; }
}

public enum BillingPeriodStatus
{
    Open = 1,
    Closed = 2
}

// ── Billing Package Document ──

public class BillingPackageDocument : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid BillingApplicationId { get; set; }

    public string DocumentType { get; set; } = string.Empty; // G702, G703, LienWaiver, InsuranceCert, etc.
    public string FileName { get; set; } = string.Empty;
    public string? FilePath { get; set; }
    public bool IsRequired { get; set; }
    public bool IsReceived { get; set; }
    public string? Notes { get; set; }
}
