using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.UpdateRfi;

/// <summary>
/// Command for updating an existing RFI. Used by RfiService.
/// </summary>
public record UpdateRfiCommand(
    Guid Id,
    Guid ProjectId,
    string Subject,
    string Question,
    string? Answer,
    RfiStatus Status,
    RfiPriority Priority,
    DateTime? DueDate,
    Guid? AssignedToUserId,
    string? AssignedToName,
    Guid? BallInCourtUserId,
    string? BallInCourtName
);
