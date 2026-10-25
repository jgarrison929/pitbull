using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Services;

/// <summary>
/// EF Core implementation of deadline notification tracking.
/// Checks the deadline_notifications table to prevent duplicate notifications.
/// </summary>
public class DeadlineNotificationTracker(PitbullDbContext db) : IDeadlineNotificationTracker
{
    public async Task<bool> HasBeenNotifiedAsync(string entityType, Guid entityId, string notificationType, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddHours(-24);
        return await db.DeadlineNotifications
            .AnyAsync(dn =>
                dn.EntityType == entityType &&
                dn.EntityId == entityId &&
                dn.NotificationType == notificationType &&
                dn.SentAt > cutoff, ct);
    }

    public async Task RecordNotificationAsync(string entityType, Guid entityId, string notificationType, CancellationToken ct = default)
    {
        db.DeadlineNotifications.Add(new DeadlineNotification
        {
            EntityType = entityType,
            EntityId = entityId,
            NotificationType = notificationType,
            SentAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(ct);
    }
}
