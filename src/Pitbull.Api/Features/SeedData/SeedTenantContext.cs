using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Features.SeedData;

/// <summary>
/// Simple tenant context for CLI seeding operations
/// </summary>
public class SeedTenantContext : ITenantContext
{
    // Use a fixed tenant ID for seeding. In real usage, this would come from JWT claims
    public Guid TenantId { get; } = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public string TenantName { get; } = "Seed Tenant";
    public bool IsResolved => true;
}