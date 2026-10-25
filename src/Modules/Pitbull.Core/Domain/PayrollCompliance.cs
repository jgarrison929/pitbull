namespace Pitbull.Core.Domain;

public class PayrollRun : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public DateOnly RunDate { get; set; }
    public Guid PayPeriodId { get; set; }
    public PayrollRunStatus Status { get; set; } = PayrollRunStatus.Draft;
    public decimal TotalGross { get; set; }
    public decimal TotalNet { get; set; }
    public int EmployeeCount { get; set; }

    public List<PayrollRunLine> Lines { get; set; } = [];
}

public class PayrollRunLine : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid PayrollRunId { get; set; }
    public PayrollRun PayrollRun { get; set; } = null!;

    public Guid EmployeeId { get; set; }
    public decimal RegularHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal DoubletimeHours { get; set; }
    public decimal RegularPay { get; set; }
    public decimal OvertimePay { get; set; }
    public decimal DoubletimePay { get; set; }
    public decimal GrossPay { get; set; }
}

public class CertifiedPayrollReport : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid PayrollRunId { get; set; }
    public PayrollRun PayrollRun { get; set; } = null!;

    public Guid ProjectId { get; set; }
    public DateOnly WeekEnding { get; set; }
    public string WHDFormNumber { get; set; } = "WH-347";
    public CertifiedPayrollStatus Status { get; set; } = CertifiedPayrollStatus.Draft;
}

public enum PayrollRunStatus
{
    Draft = 1,
    Processing = 2,
    Submitted = 3,
    UnderReview = 4,
    Approved = 5,
    Exported = 6
}

public enum CertifiedPayrollStatus
{
    Draft = 1,
    Submitted = 2
}

public class WageDetermination : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid ProjectId { get; set; }
    public WageJurisdictionType JurisdictionType { get; set; } = WageJurisdictionType.Federal;
    public string DeterminationNumber { get; set; } = string.Empty;
    public string? SourceAgency { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }
    public WageDeterminationStatus Status { get; set; } = WageDeterminationStatus.Active;

    public List<WageDeterminationRate> Rates { get; set; } = [];
}

public class WageDeterminationRate : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid WageDeterminationId { get; set; }
    public WageDetermination WageDetermination { get; set; } = null!;

    public Guid WorkClassificationId { get; set; }
    public WorkClassification WorkClassification { get; set; } = null!;

    public decimal BaseRate { get; set; }
    public decimal FringeRate { get; set; }
    public decimal TotalRate { get; set; }
}

public class WorkClassification : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class PayrollRunReview : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid PayrollRunId { get; set; }
    public PayrollRun PayrollRun { get; set; } = null!;

    public string ReviewerUserId { get; set; } = string.Empty;
    public PayrollReviewStatus Status { get; set; } = PayrollReviewStatus.Pending;
    public string? Comments { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime? EscalatedAt { get; set; }
}

public class PayrollExport : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid PayrollRunId { get; set; }
    public PayrollRun PayrollRun { get; set; } = null!;

    public PayrollExportFormat Format { get; set; } = PayrollExportFormat.Csv;
    public DateTime ExportedAt { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;

    public List<PayrollExportLine> Lines { get; set; } = [];
}

public class PayrollExportLine : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid PayrollExportId { get; set; }
    public PayrollExport PayrollExport { get; set; } = null!;

    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string MaskedSsn { get; set; } = string.Empty;
    public decimal StraightTimeHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal DoubletimeHours { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal GrossPay { get; set; }
    public decimal Deductions { get; set; }
    public decimal NetPay { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? WorkClassificationId { get; set; }
}

public class FringeBenefitAllocation : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid EmployeeId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? PayrollRunLineId { get; set; }
    public FringeAllocationMethod AllocationMethod { get; set; } = FringeAllocationMethod.Cash;
    public decimal RequiredFringeRate { get; set; }
    public decimal CashFringeAmount { get; set; }
    public decimal BenefitFringeAmount { get; set; }
}

public enum WageJurisdictionType
{
    Federal = 1,
    State = 2
}

public enum WageDeterminationStatus
{
    Active = 1,
    Superseded = 2,
    Expired = 3
}

public enum PayrollReviewStatus
{
    Pending = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4,
    Escalated = 5
}

public enum PayrollExportFormat
{
    Csv = 1,
    Adp = 2,
    Paychex = 3,
    QuickBooks = 4
}

public enum FringeAllocationMethod
{
    Cash = 1,
    Benefits = 2,
    Split = 3
}
