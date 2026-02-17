using Pitbull.Core.CQRS;
using Pitbull.Notifications.Domain;

namespace Pitbull.Notifications.Services;

public interface INotificationService
{
    Task<Result<NotificationDto>> CreateAsync(CreateNotificationCommand command, CancellationToken ct = default);
    Task<Result> MarkReadAsync(Guid notificationId, Guid userId, CancellationToken ct = default);
    Task<Result<int>> MarkAllReadAsync(Guid userId, CancellationToken ct = default);
    Task<Result<IReadOnlyList<NotificationDto>>> GetUnreadAsync(Guid userId, CancellationToken ct = default);
    Task<Result<PagedResult<NotificationDto>>> GetAllAsync(Guid userId, int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<Result<int>> GetUnreadCountAsync(Guid userId, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid notificationId, Guid userId, CancellationToken ct = default);
}

public record NotificationDto(
    Guid Id,
    Guid UserId,
    string Title,
    string Message,
    NotificationType Type,
    bool IsRead,
    DateTime CreatedAt,
    DateTime? ReadAt,
    string? RelatedEntityType,
    Guid? RelatedEntityId
);

public record CreateNotificationCommand(
    Guid UserId,
    string Title,
    string Message,
    NotificationType Type = NotificationType.Info,
    string? RelatedEntityType = null,
    Guid? RelatedEntityId = null
);
