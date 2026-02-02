using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features;

public record RfiDto(
    Guid Id,
    int Number,
    string Subject,
    string Question,
    string? Answer,
    RfiStatus Status,
    RfiPriority Priority,
    DateTime? DueDate,
    DateTime? AnsweredAt,
    DateTime? ClosedAt,
    Guid ProjectId,
    Guid? BallInCourtUserId,
    string? BallInCourtName,
    Guid? AssignedToUserId,
    string? AssignedToName,
    string? CreatedByName,
    DateTime CreatedAt
);