namespace Pitbull.Contracts.Domain;

/// <summary>
/// Lifecycle status of a subcontract.
/// </summary>
public enum SubcontractStatus
{
    Draft = 0,           // Being prepared
    PendingApproval = 1, // Awaiting internal approval
    Issued = 2,          // Sent to subcontractor
    Executed = 3,        // Signed by both parties
    InProgress = 4,      // Work has started
    Complete = 5,        // Work finished, pending final payment
    ClosedOut = 6,       // Final payment made, retainage released
    Terminated = 7,      // Contract terminated early
    OnHold = 8           // Work suspended
}
