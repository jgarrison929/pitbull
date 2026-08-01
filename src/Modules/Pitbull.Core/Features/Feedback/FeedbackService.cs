using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;
using Pitbull.Core.Entities;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Logging;

namespace Pitbull.Core.Features.Feedback;

public sealed class FeedbackService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ILogger<FeedbackService> logger) : IFeedbackService
{
    // Align with EF HasMaxLength on feedback table (see model snapshot).
    private const int MaxPageLength = 1000;
    private const int MaxUserRoleLength = 100;
    private const int MaxCategoryLength = 50;
    private const int MaxMessageLength = 4000;
    private const int MaxContactEmailLength = 256;
    private const int MaxScreenshotUrlLength = 2000;
    private const int MaxBrowserInfoLength = 500;
    private const int MaxBulkIds = 100;

    public async Task<FeedbackDto> CreateAsync(CreateFeedbackRequest request, string createdBy, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Page))
            throw new ArgumentException("Page is required");
        if (string.IsNullOrWhiteSpace(request.Category))
            throw new ArgumentException("Category is required");
        if (string.IsNullOrWhiteSpace(request.Message))
            throw new ArgumentException("Message is required");

        var page = request.Page.Trim();
        var userRole = (request.UserRole ?? string.Empty).Trim();
        var category = request.Category.Trim();
        var message = request.Message.Trim();
        var contactEmail = string.IsNullOrWhiteSpace(request.ContactEmail) ? null : request.ContactEmail.Trim();
        var screenshotUrl = string.IsNullOrWhiteSpace(request.ScreenshotUrl) ? null : request.ScreenshotUrl.Trim();
        var browserInfo = string.IsNullOrWhiteSpace(request.BrowserInfo) ? null : request.BrowserInfo.Trim();

        if (page.Length > MaxPageLength)
            throw new ArgumentException($"Page cannot exceed {MaxPageLength} characters");
        if (userRole.Length > MaxUserRoleLength)
            throw new ArgumentException($"UserRole cannot exceed {MaxUserRoleLength} characters");
        if (category.Length > MaxCategoryLength)
            throw new ArgumentException($"Category cannot exceed {MaxCategoryLength} characters");
        if (message.Length > MaxMessageLength)
            throw new ArgumentException($"Message cannot exceed {MaxMessageLength} characters");
        if (contactEmail is { Length: > MaxContactEmailLength })
            throw new ArgumentException($"ContactEmail cannot exceed {MaxContactEmailLength} characters");
        if (screenshotUrl is { Length: > MaxScreenshotUrlLength })
            throw new ArgumentException($"ScreenshotUrl cannot exceed {MaxScreenshotUrlLength} characters");
        if (browserInfo is { Length: > MaxBrowserInfoLength })
            throw new ArgumentException($"BrowserInfo cannot exceed {MaxBrowserInfoLength} characters");
        if (!Enum.IsDefined(typeof(FeedbackType), request.Type))
            throw new ArgumentException("Invalid feedback type");

        var feedback = new Entities.Feedback
        {
            Page = page,
            UserRole = userRole,
            Category = category,
            Message = message,
            ContactEmail = contactEmail,
            Type = request.Type,
            ScreenshotUrl = screenshotUrl,
            BrowserInfo = browserInfo,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = string.IsNullOrWhiteSpace(createdBy) ? "unknown" : createdBy.Trim(),
            Status = FeedbackStatus.New
        };

        // Unit tests and background workers can run without a resolved tenant context.
        if (tenantContext.IsResolved)
            feedback.TenantId = tenantContext.TenantId;

        db.Set<Entities.Feedback>().Add(feedback);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Feedback created {FeedbackId} category={Category} type={Type}", feedback.Id, LogSafe.Text(feedback.Category), LogSafe.Text(feedback.Type));
        return ToDto(feedback);
    }

    private const int MaxListTake = 500;

    public async Task<IReadOnlyList<FeedbackDto>> ListAsync(FeedbackListQuery query, CancellationToken cancellationToken = default)
    {
        var set = db.Set<Entities.Feedback>().AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim();
            if (category.Length > 100)
                category = category[..100];
            set = set.Where(x => x.Category == category);
        }

        if (query.Status.HasValue)
            set = set.Where(x => x.Status == query.Status.Value);

        if (query.Type.HasValue)
            set = set.Where(x => x.Type == query.Type.Value);

        if (query.DateFromUtc.HasValue)
            set = set.Where(x => x.CreatedAt >= query.DateFromUtc.Value);

        if (query.DateToUtc.HasValue)
            set = set.Where(x => x.CreatedAt <= query.DateToUtc.Value);

        return await set
            .OrderByDescending(x => x.CreatedAt)
            .Take(MaxListTake)
            .Select(x => new FeedbackDto(
                x.Id,
                x.Page,
                x.UserRole,
                x.Category,
                x.Message,
                x.ContactEmail,
                x.Status,
                x.Type,
                x.ScreenshotUrl,
                x.BrowserInfo,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<FeedbackDto?> UpdateStatusAsync(Guid feedbackId, FeedbackStatus status, CancellationToken cancellationToken = default)
    {
        var feedback = await db.Set<Entities.Feedback>()
            .FirstOrDefaultAsync(x => x.Id == feedbackId, cancellationToken);

        if (feedback is null)
            return null;

        feedback.Status = status;
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(feedback);
    }

    public async Task<int> BulkUpdateStatusAsync(IReadOnlyList<Guid> feedbackIds, FeedbackStatus status, CancellationToken cancellationToken = default)
    {
        if (feedbackIds.Count == 0)
            return 0;
        if (feedbackIds.Count > MaxBulkIds)
            throw new ArgumentException($"Cannot bulk-update more than {MaxBulkIds} feedback items at once");
        if (!Enum.IsDefined(typeof(FeedbackStatus), status))
            throw new ArgumentException("Invalid feedback status");

        var items = await db.Set<Entities.Feedback>()
            .Where(x => feedbackIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        foreach (var item in items)
            item.Status = status;

        await db.SaveChangesAsync(cancellationToken);
        return items.Count;
    }

    private static FeedbackDto ToDto(Entities.Feedback feedback)
        => new(
            feedback.Id,
            feedback.Page,
            feedback.UserRole,
            feedback.Category,
            feedback.Message,
            feedback.ContactEmail,
            feedback.Status,
            feedback.Type,
            feedback.ScreenshotUrl,
            feedback.BrowserInfo,
            feedback.CreatedAt);
}
