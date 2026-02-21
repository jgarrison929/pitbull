using Pitbull.Core.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Tax and compliance data for an employee, including W-4, I-9,
/// Davis-Bacon, and certified payroll flags. One record per employee.
/// </summary>
public class EmployeeTaxCompliance : BaseEntity
{
    public Guid EmployeeId { get; set; }

    [Encrypted]
    public string? SsnLastFour { get; set; }

    // W-4 Federal Tax
    public W4FilingStatus W4FilingStatus { get; set; } = W4FilingStatus.Single;
    public decimal W4AdditionalWithholding { get; set; }
    public bool W4Exempt { get; set; }

    // I-9 Employment Eligibility
    public I9Status I9Status { get; set; } = I9Status.NotStarted;
    public DateTime? I9Section1Date { get; set; }
    public DateTime? I9Section2Date { get; set; }
    public string? I9VerifiedBy { get; set; }

    // Davis-Bacon / Certified Payroll
    public bool CertifiedPayrollRequired { get; set; }
    public bool DavisBaconApplicable { get; set; }

    public string? PayrollNotes { get; set; }

    // Navigation
    public Employee? Employee { get; set; }
}
