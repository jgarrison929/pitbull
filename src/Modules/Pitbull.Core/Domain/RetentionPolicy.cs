namespace Pitbull.Core.Domain;

public class RetentionPolicy : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }

    public string Name { get; set; } = string.Empty;

    public decimal PercentageRate { get; set; }

    public decimal? MaxAmount { get; set; }

    public decimal? ReleaseThreshold { get; set; }

    public RetentionAppliesTo AppliesTo { get; set; } = RetentionAppliesTo.Both;

    public bool IsDefault { get; set; }

    public bool IsActive { get; set; } = true;
}

public enum RetentionAppliesTo
{
    Contract = 1,
    ChangeOrder = 2,
    Both = 3
}
