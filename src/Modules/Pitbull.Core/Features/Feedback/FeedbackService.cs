using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;
using Pitbull.Core.Entities;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Core.Features.Feedback;

public sealed class FeedbackService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ILogger<FeedbackService> logger) : IFeedbackService
{
    public async Task<FeedbackDto> CreateAsync(CreateFeedbackRequest request, string createdBy, CancellationToken cancellationToken = default)
    {
        var feedback = new Entities.Feedback
        {
            Page = request.Page.Trim(),
            UserRole = request.UserRole.Trim(),
            Category = request.Category.Trim(),
            Message = request.Message.Trim(),
            ContactEmail = string.IsNullOrWhiteSpace(request.ContactEmail)
                ? null
                : request.ContactEmail.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = string.IsNullOrWhiteSpace(createdBy) ? "unknown" : createdBy,
            Status = FeedbackStatus.New
        };

        // Unit tests and background workers can run without a resolved tenant context.
        if (tenantContext.IsResolved)
            feedback.TenantId = tenantContext.TenantId;

        db.Set<Entities.Feedback>().Add(feedback);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Feedback created {FeedbackId} category={Category}", feedback.Id, feedback.Category);
        return ToDto(feedback);
    }

    public async Task<IReadOnlyList<FeedbackDto>> ListAsync(FeedbackListQuery query, CancellationToken cancellationToken = default)
    {
        var set = db.Set<Entities.Feedback>().AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Category))
            set = set.Where(x => x.Category == query.Category);

        if (query.Status.HasValue)
            set = set.Where(x => x.Status == query.Status.Value);

        if (query.DateFromUtc.HasValue)
            set = set.Where(x => x.CreatedAt >= query.DateFromUtc.Value);

        if (query.DateToUtc.HasValue)
            set = set.Where(x => x.CreatedAt <= query.DateToUtc.Value);

        return await set
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new FeedbackDto(
                x.Id,
                x.Page,
                x.UserRole,
                x.Category,
                x.Message,
                x.ContactEmail,
                x.Status,
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

    private static FeedbackDto ToDto(Entities.Feedback feedback)
        => new(
            feedback.Id,
            feedback.Page,
            feedback.UserRole,
            feedback.Category,
            feedback.Message,
            feedback.ContactEmail,
            feedback.Status,
            feedback.CreatedAt);
}
