using Pitbull.Core.Domain;

namespace Pitbull.Core.Entities;

public sealed class UserRole
{
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }

    public AppUser User { get; set; } = null!;
    public Role Role { get; set; } = null!;
}
