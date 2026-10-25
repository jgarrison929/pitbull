namespace Pitbull.Core.Domain;

/// <summary>
/// Persisted dashboard layout and widget configuration per user.
/// Replaces the in-memory ConcurrentDictionary storage.
/// </summary>
public class DashboardPreference : BaseEntity
{
    public Guid UserId { get; set; }
    public string Layout { get; set; } = "default";
    public string? WidgetConfiguration { get; set; }
}
