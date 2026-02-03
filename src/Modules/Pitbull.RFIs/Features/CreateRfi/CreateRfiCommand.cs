using Pitbull.Core.CQRS;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.CreateRfi;

public record CreateRfiCommand(
    Guid ProjectId,
    string Subject,
    string Question,
    RfiPriority Priority,
    DateTime? DueDate,
    Guid? AssignedToUserId,
    string? AssignedToName,
    Guid? BallInCourtUserId,
    string? BallInCourtName,
    string? CreatedByName
) : ICommand<RfiDto>;