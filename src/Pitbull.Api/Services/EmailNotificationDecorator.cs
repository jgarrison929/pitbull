using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Notifications.Domain;
using Pitbull.Notifications.Services;

namespace Pitbull.Api.Services;

/// <summary>
/// Decorates INotificationService to fire-and-forget email notifications
/// when the user has email enabled for the notification category.
/// </summary>
public class EmailNotificationDecorator(
    INotificationService inner,
    IEmailService emailService,
    INotificationPreferenceService preferenceService,
    PitbullDbContext db,
    ILogger<EmailNotificationDecorator> logger) : INotificationService
{
    public async Task<Result<NotificationDto>> CreateAsync(CreateNotificationCommand command, CancellationToken ct = default)
    {
        var result = await inner.CreateAsync(command, ct);

        if (result.IsSuccess)
        {
            // Fire-and-forget — don't block notification creation on email delivery
            _ = TrySendEmailAsync(command);
        }

        return result;
    }

    // All other methods delegate directly
    public Task<Result> MarkReadAsync(Guid notificationId, Guid userId, CancellationToken ct = default)
        => inner.MarkReadAsync(notificationId, userId, ct);

    public Task<Result<int>> MarkAllReadAsync(Guid userId, CancellationToken ct = default)
        => inner.MarkAllReadAsync(userId, ct);

    public Task<Result<IReadOnlyList<NotificationDto>>> GetUnreadAsync(Guid userId, CancellationToken ct = default)
        => inner.GetUnreadAsync(userId, ct);

    public Task<Result<PagedResult<NotificationDto>>> GetAllAsync(Guid userId, int page = 1, int pageSize = 20, CancellationToken ct = default)
        => inner.GetAllAsync(userId, page, pageSize, ct);

    public Task<Result<int>> GetUnreadCountAsync(Guid userId, CancellationToken ct = default)
        => inner.GetUnreadCountAsync(userId, ct);

    public Task<Result> DeleteAsync(Guid notificationId, Guid userId, CancellationToken ct = default)
        => inner.DeleteAsync(notificationId, userId, ct);

    private async Task TrySendEmailAsync(CreateNotificationCommand command)
    {
        try
        {
            var category = MapTypeToCategory(command.Type);
            if (category is null)
                return;

            // Look up user email and tenant
            var user = await db.Users
                .AsNoTracking()
                .Where(u => u.Id == command.UserId)
                .Select(u => new { u.Email, u.FirstName, u.TenantId })
                .FirstOrDefaultAsync();

            if (user?.Email is null)
                return;

            // Check if user has email enabled for this category
            var preferences = await preferenceService.GetPreferencesAsync(command.UserId, user.TenantId);
            var pref = preferences.FirstOrDefault(p => p.Category == category);

            if (pref is null || !pref.Email)
                return;

            // Build action URL from related entity
            var actionUrl = BuildActionUrl(command);

            await emailService.SendNotificationEmailAsync(
                user.Email,
                user.FirstName,
                command.Title,
                command.Message,
                actionUrl);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send notification email for user {UserId}", command.UserId);
        }
    }

    private static string? MapTypeToCategory(NotificationType type) => type switch
    {
        NotificationType.TimeEntrySubmitted => "time_entry_submitted",
        NotificationType.TimeEntryApproved => "time_entry_approved",
        NotificationType.TimeEntryRejected => "time_entry_rejected",
        NotificationType.PendingApproval => "time_entry_submitted",
        NotificationType.RfiCreated => "rfi_created",
        NotificationType.RfiAnswered => "rfi_responded",
        NotificationType.OverdueRfi => "rfi_created",
        NotificationType.SystemUpdate => "system_announcement",
        // Info, Success, Warning, Error, ChangeOrder — no email preference category
        _ => null,
    };

    private static string? BuildActionUrl(CreateNotificationCommand command)
    {
        if (command.RelatedEntityType is null || command.RelatedEntityId is null)
            return null;

        return command.RelatedEntityType.ToLowerInvariant() switch
        {
            "timeentry" or "time_entry" => "/time-tracking",
            "rfi" => $"/rfis",
            "changeorder" or "change_order" => "/change-orders",
            "project" => $"/projects/{command.RelatedEntityId}",
            _ => null,
        };
    }
}
