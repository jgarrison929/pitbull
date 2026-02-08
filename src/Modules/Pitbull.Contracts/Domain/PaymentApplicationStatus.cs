namespace Pitbull.Contracts.Domain;

/// <summary>
/// Status of a payment application through the approval workflow.
/// </summary>
public enum PaymentApplicationStatus
{
    Draft = 0,           // Being prepared
    Submitted = 1,       // Submitted for review
    UnderReview = 2,     // Being reviewed by PM
    Approved = 3,        // Approved for payment
    PartiallyApproved = 4, // Approved for less than requested
    Rejected = 5,        // Rejected - needs revision
    Paid = 6,            // Payment processed
    Void = 7             // Cancelled
}
