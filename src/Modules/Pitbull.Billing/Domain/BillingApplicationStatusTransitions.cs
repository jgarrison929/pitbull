using Pitbull.Core.Domain;

namespace Pitbull.Billing.Domain;

/// <summary>
/// Owner billing (G702/G703) lifecycle transitions per AR monthly billing workflow.
/// </summary>
public static class BillingApplicationStatusTransitions
{
    private static readonly HashSet<BillingApplicationStatus> OutstandingBillable =
    [
        BillingApplicationStatus.SubmittedToOwner,
        BillingApplicationStatus.Disputed,
        BillingApplicationStatus.ArchitectCertified,
        BillingApplicationStatus.PaymentDue,
        BillingApplicationStatus.PartiallyPaid,
        BillingApplicationStatus.Paid,
    ];

    private static readonly Dictionary<BillingApplicationStatus, HashSet<BillingApplicationStatus>> Allowed = new()
    {
        [BillingApplicationStatus.Draft] = [BillingApplicationStatus.PmReview],
        [BillingApplicationStatus.PmReview] = [BillingApplicationStatus.ReadyToSubmit, BillingApplicationStatus.PmRejected],
        [BillingApplicationStatus.PmRejected] = [BillingApplicationStatus.Draft],
        [BillingApplicationStatus.ReadyToSubmit] = [BillingApplicationStatus.SubmittedToOwner],
        [BillingApplicationStatus.SubmittedToOwner] = [BillingApplicationStatus.ArchitectCertified, BillingApplicationStatus.Disputed],
        [BillingApplicationStatus.Disputed] = [BillingApplicationStatus.SubmittedToOwner],
        [BillingApplicationStatus.ArchitectCertified] = [BillingApplicationStatus.PaymentDue],
        [BillingApplicationStatus.PaymentDue] = [BillingApplicationStatus.PartiallyPaid, BillingApplicationStatus.Paid],
        [BillingApplicationStatus.PartiallyPaid] = [BillingApplicationStatus.Paid],
        [BillingApplicationStatus.Paid] = [],
        [BillingApplicationStatus.Void] = [],
    };

    public static bool IsValid(BillingApplicationStatus from, BillingApplicationStatus to) =>
        from == to || (Allowed.TryGetValue(from, out var targets) && targets.Contains(to));

    public static IReadOnlySet<BillingApplicationStatus> GetAllowed(BillingApplicationStatus from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : new HashSet<BillingApplicationStatus>();

    public static bool CountsTowardBillingsToDate(BillingApplicationStatus status) =>
        OutstandingBillable.Contains(status);
}