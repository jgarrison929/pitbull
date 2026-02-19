namespace Pitbull.Core.Domain;

public class LienWaiver : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid ProjectId { get; set; }

    public Guid? VendorId { get; set; }

    public LienWaiverType WaiverType { get; set; }

    public decimal Amount { get; set; }

    public DateOnly ThroughDate { get; set; }

    public LienWaiverStatus Status { get; set; } = LienWaiverStatus.Requested;

    public string? DocumentPath { get; set; }

    public string? Description { get; set; }

    public Guid? ReviewedByUserId { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? RejectionReason { get; set; }
}

public enum LienWaiverType
{
    Conditional = 1,
    Unconditional = 2,
    Progress = 3,
    Final = 4
}

public enum LienWaiverStatus
{
    Requested = 1,
    Received = 2,
    Approved = 3,
    Rejected = 4
}
