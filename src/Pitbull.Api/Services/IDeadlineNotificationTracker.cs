namespace Pitbull.Api.Services;

/// <summary>
/// Tracks which deadline notifications have been sent to prevent duplicate spam.
/// </summary>
public interface IDeadlineNotificationTracker
{
    /// <summary>
    /// Returns true if a notification of the given type was already sent
    /// for this entity within the last 24 hours.
    /// </summary>
    Task<bool> HasBeenNotifiedAsync(string entityType, Guid entityId, string notificationType, CancellationToken ct = default);

    /// <summary>
    /// Records that a notification was sent for this entity.
    /// </summary>
    Task RecordNotificationAsync(string entityType, Guid entityId, string notificationType, CancellationToken ct = default);
}
