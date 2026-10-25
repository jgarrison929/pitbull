using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.CreateRfi;

/// <summary>
/// Command for creating a new RFI. Used by RfiService.
/// </summary>
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
    string? CreatedByName,

    // Document references
    string? SpecSection = null,
    List<string>? DrawingReferences = null,

    // Cost impact tracking
    bool HasCostImpact = false,
    decimal? EstimatedCostImpact = null,
    int? EstimatedDelayDays = null
);
