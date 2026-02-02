namespace Pitbull.Core.MultiTenancy;

/// <summary>
/// Provides the current tenant context for the request.
/// Injected as scoped - resolved once per request.
/// </summary>
public interface ITenantContext
{
    Guid TenantId { get; }
    string TenantName { get; }
    bool IsResolved { get; }
}

/// <summary>
/// Mutable tenant context set by middleware.
/// </summary>
public class TenantContext : ITenantContext
{
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public bool IsResolved => TenantId != Guid.Empty;
}
