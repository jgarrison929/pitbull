using Pitbull.Core.Domain;

namespace Pitbull.Core.Entities;

public sealed class NotificationPreference : BaseEntity
{
    public Guid UserId { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool InApp { get; set; } = true;
    public bool Email { get; set; } = false;
}
