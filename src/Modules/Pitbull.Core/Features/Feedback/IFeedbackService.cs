using Pitbull.Core.Entities;

namespace Pitbull.Core.Features.Feedback;

public interface IFeedbackService
{
    Task<FeedbackDto> CreateAsync(CreateFeedbackRequest request, string createdBy, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<FeedbackDto>> ListAsync(FeedbackListQuery query, CancellationToken cancellationToken = default);
    Task<FeedbackDto?> UpdateStatusAsync(Guid feedbackId, FeedbackStatus status, CancellationToken cancellationToken = default);
}

public sealed record CreateFeedbackRequest(
    string Page,
    string UserRole,
    string Category,
    string Message,
    string? ContactEmail);

public sealed record FeedbackListQuery(
    string? Category,
    FeedbackStatus? Status,
    DateTime? DateFromUtc,
    DateTime? DateToUtc);

public sealed record FeedbackDto(
    Guid Id,
    string Page,
    string UserRole,
    string Category,
    string Message,
    string? ContactEmail,
    FeedbackStatus Status,
    DateTime CreatedAt);
