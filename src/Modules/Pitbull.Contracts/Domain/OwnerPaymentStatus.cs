namespace Pitbull.Contracts.Domain;

/// <summary>
/// Computed status reflecting whether an owner payment has been received,
/// is pending, overdue, or partially received.
/// </summary>
public enum OwnerPaymentStatus
{
    NotDue = 0,
    Pending = 1,
    Overdue = 2,
    Partial = 3,
    Received = 4
}
