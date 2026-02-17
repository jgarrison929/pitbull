using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Notifications.Domain;

namespace Pitbull.Notifications.Services;

public class NotificationService(PitbullDbContext db) : INotificationService
{
    public async Task<Result<NotificationDto>> CreateAsync(CreateNotificationCommand command, CancellationToken ct = default)
    {
        var notification = new Notification
        {
            UserId = command.UserId,
            Title = command.Title,
            Message = command.Message,
            Type = command.Type,
            IsRead = false,
            RelatedEntityType = command.RelatedEntityType,
            RelatedEntityId = command.RelatedEntityId,
        };

        db.Set<Notification>().Add(notification);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(notification));
    }

    public async Task<Result> MarkReadAsync(Guid notificationId, Guid userId, CancellationToken ct = default)
    {
        var notification = await db.Set<Notification>()
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId && !n.IsDeleted, ct);

        if (notification is null)
            return Result.Failure("Notification not found", "NOT_FOUND");

        if (notification.IsRead)
            return Result.Success();

        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }

    public async Task<Result<int>> MarkAllReadAsync(Guid userId, CancellationToken ct = default)
    {
        var count = await db.Set<Notification>()
            .Where(n => n.UserId == userId && !n.IsRead && !n.IsDeleted)
            .ExecuteUpdateAsync(s => s
                .SetProperty(n => n.IsRead, true)
                .SetProperty(n => n.ReadAt, DateTime.UtcNow), ct);

        return Result.Success(count);
    }

    public async Task<Result<IReadOnlyList<NotificationDto>>> GetUnreadAsync(Guid userId, CancellationToken ct = default)
    {
        var notifications = await db.Set<Notification>()
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsRead && !n.IsDeleted)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => ToDto(n))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<NotificationDto>>(notifications);
    }

    public async Task<Result<PagedResult<NotificationDto>>> GetAllAsync(Guid userId, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Set<Notification>()
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsDeleted);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => ToDto(n))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<NotificationDto>(items, totalCount, page, pageSize));
    }

    public async Task<Result<int>> GetUnreadCountAsync(Guid userId, CancellationToken ct = default)
    {
        var count = await db.Set<Notification>()
            .CountAsync(n => n.UserId == userId && !n.IsRead && !n.IsDeleted, ct);

        return Result.Success(count);
    }

    public async Task<Result> DeleteAsync(Guid notificationId, Guid userId, CancellationToken ct = default)
    {
        var notification = await db.Set<Notification>()
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId && !n.IsDeleted, ct);

        if (notification is null)
            return Result.Failure("Notification not found", "NOT_FOUND");

        notification.IsDeleted = true;
        notification.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }

    private static NotificationDto ToDto(Notification n) => new(
        n.Id, n.UserId, n.Title, n.Message, n.Type,
        n.IsRead, n.CreatedAt, n.ReadAt,
        n.RelatedEntityType, n.RelatedEntityId
    );
}
