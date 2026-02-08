namespace Pitbull.Contracts.Domain;

/// <summary>
/// Approval status of a change order.
/// </summary>
public enum ChangeOrderStatus
{
    Pending = 0,         // Submitted, awaiting review
    UnderReview = 1,     // Being evaluated
    Approved = 2,        // Approved - impacts contract value
    Rejected = 3,        // Denied
    Withdrawn = 4,       // Pulled back by submitter
    Void = 5             // Cancelled after approval
}
