using Pitbull.Core.CQRS;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.UpdateRfi;

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
) : ICommand<RfiDto>;