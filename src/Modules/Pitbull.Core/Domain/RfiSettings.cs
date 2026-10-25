namespace Pitbull.Core.Domain;

/// <summary>
/// Company-level RFI workflow configuration. Owned by Company entity.
/// Controls response deadlines, auto-assignment, and cost impact requirements.
/// </summary>
public class RfiSettings
{
    /// <summary>
    /// Default number of days given for an RFI response before it's considered overdue.
    /// Industry standard is typically 7-14 days.
    /// </summary>
    public int DefaultResponseDeadlineDays { get; set; } = 14;

    /// <summary>
    /// Automatically assign new RFIs to the project manager.
    /// When false, RFIs are unassigned until manually routed.
    /// </summary>
    public bool AutoAssignToPm { get; set; } = true;

    /// <summary>
    /// Require cost impact assessment on every RFI before it can be closed.
    /// Ensures financial tracking of RFI-driven changes.
    /// </summary>
    public bool RequireCostImpact { get; set; } = false;
}
