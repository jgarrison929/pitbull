namespace Pitbull.Core.Domain;

/// <summary>
/// Root tenant entity. Every piece of data in the system belongs to a tenant.
/// </summary>
public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? ConnectionString { get; set; }
    public TenantStatus Status { get; set; } = TenantStatus.Active;
    public TenantPlan Plan { get; set; } = TenantPlan.Standard;
    public string Settings { get; set; } = "{}"; // JSONB for tenant-specific config
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public enum TenantStatus
{
    Active,
    Suspended,
    Deactivated
}

public enum TenantPlan
{
    Trial,
    Standard,
    Professional,
    Enterprise
}
