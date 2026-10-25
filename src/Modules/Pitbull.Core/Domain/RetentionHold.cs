namespace Pitbull.Core.Domain;

public class RetentionHold : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public Guid ProjectId { get; set; }

    public Guid? ContractId { get; set; }

    public decimal OriginalAmount { get; set; }

    public decimal RetainedAmount { get; set; }

    public decimal ReleasedAmount { get; set; }

    public RetentionHoldStatus Status { get; set; } = RetentionHoldStatus.Held;

    public Guid? RetentionPolicyId { get; set; }

    public decimal RetainagePercent { get; set; }

    public string? Description { get; set; }

    public DateOnly EffectiveDate { get; set; }

    public Guid? ReleasedByUserId { get; set; }

    public DateTime? ReleasedAt { get; set; }
}

public enum RetentionHoldStatus
{
    Held = 1,
    PartiallyReleased = 2,
    Released = 3
}
