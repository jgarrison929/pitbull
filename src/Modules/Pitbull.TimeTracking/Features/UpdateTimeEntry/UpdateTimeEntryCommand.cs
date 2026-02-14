using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.UpdateTimeEntry;

/// <summary>
/// Update an existing time entry. Supports status changes for the approval workflow.
/// </summary>
public record UpdateTimeEntryCommand(
    Guid TimeEntryId,
    /// <summary>
    /// Optional: update regular hours (only allowed in Draft/Submitted status)
    /// </summary>
    decimal? RegularHours = null,
    /// <summary>
    /// Optional: update overtime hours (only allowed in Draft/Submitted status)
    /// </summary>
    decimal? OvertimeHours = null,
    /// <summary>
    /// Optional: update doubletime hours (only allowed in Draft/Submitted status)
    /// </summary>
    decimal? DoubletimeHours = null,
    /// <summary>
    /// Optional: update description
    /// </summary>
    string? Description = null,
    /// <summary>
    /// Optional: new status (triggers workflow transition)
    /// </summary>
    TimeEntryStatus? NewStatus = null,
    /// <summary>
    /// User ID of the person making the change (required for approval/rejection)
    /// </summary>
    Guid? ApproverId = null,
    /// <summary>
    /// Comments from approver (for approval/rejection)
    /// </summary>
    string? ApproverNotes = null,
    /// <summary>
    /// Optional: update phase ID (only allowed in Draft/Submitted status)
    /// </summary>
    Guid? PhaseId = null,
    /// <summary>
    /// Optional: update equipment ID (only allowed in Draft/Submitted status)
    /// </summary>
    Guid? EquipmentId = null,
    /// <summary>
    /// Optional: update equipment hours (only allowed in Draft/Submitted status)
    /// </summary>
    decimal? EquipmentHours = null
) : ICommand<TimeEntryDto>;
