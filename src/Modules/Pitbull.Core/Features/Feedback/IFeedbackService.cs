using Pitbull.Core.Entities;

namespace Pitbull.Core.Features.Feedback;

public interface IFeedbackService
{
    Task<FeedbackDto> CreateAsync(CreateFeedbackRequest request, string createdBy, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<FeedbackDto>> ListAsync(FeedbackListQuery query, CancellationToken cancellationToken = default);
    Task<FeedbackDto?> UpdateStatusAsync(Guid feedbackId, FeedbackStatus status, CancellationToken cancellationToken = default);
    Task<int> BulkUpdateStatusAsync(IReadOnlyList<Guid> feedbackIds, FeedbackStatus status, CancellationToken cancellationToken = default);
}

public sealed record CreateFeedbackRequest(
    string Page,
    string UserRole,
    string Category,
    string Message,
    string? ContactEmail,
    FeedbackType Type = FeedbackType.General,
    string? ScreenshotUrl = null,
    string? BrowserInfo = null);

public sealed record FeedbackListQuery(
    string? Category,
    FeedbackStatus? Status,
    DateTime? DateFromUtc,
    DateTime? DateToUtc,
    FeedbackType? Type = null);

public sealed record FeedbackDto(
    Guid Id,
    string Page,
    string UserRole,
    string Category,
    string Message,
    string? ContactEmail,
    FeedbackStatus Status,
    FeedbackType Type,
    string? ScreenshotUrl,
    string? BrowserInfo,
    DateTime CreatedAt);
