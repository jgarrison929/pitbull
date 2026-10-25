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
    string? BallInCourtName,

    // Document references
    string? SpecSection = null,
    List<string>? DrawingReferences = null,

    // Cost impact tracking
    bool HasCostImpact = false,
    decimal? EstimatedCostImpact = null,
    int? EstimatedDelayDays = null
);
