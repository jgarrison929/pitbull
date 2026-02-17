namespace Pitbull.Contracts.Domain;

/// <summary>
/// Status of a payment application through the approval workflow.
/// </summary>
public enum PaymentApplicationStatus
{
    Draft = 0,
    Submitted = 1,
    Reviewed = 2,
    Approved = 3,
    Paid = 4,
    Rejected = 5,
    Void = 6
}
