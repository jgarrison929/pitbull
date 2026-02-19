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
    Approved = 3,
    Exported = 4
}

public enum CertifiedPayrollStatus
{
    Draft = 1,
    Submitted = 2
}
