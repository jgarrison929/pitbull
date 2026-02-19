namespace Pitbull.Core.Domain;

/// <summary>
/// Marker interface for entities that belong to a specific tenant.
/// BaseEntity already provides TenantId; this interface makes tenant scope explicit.
/// </summary>
public interface ITenantScoped
{
    Guid TenantId { get; set; }
}
