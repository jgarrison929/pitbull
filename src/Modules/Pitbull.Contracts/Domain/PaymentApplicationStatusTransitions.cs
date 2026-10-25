namespace Pitbull.Contracts.Domain;

/// <summary>
/// Subcontractor pay application (AP) lifecycle transitions per AIA G702/G703 workflow.
/// Owner AR billing uses <see cref="Billing.Domain.BillingApplicationStatusTransitions"/>.
/// </summary>
public static class PaymentApplicationStatusTransitions
{
    private static readonly Dictionary<PaymentApplicationStatus, HashSet<PaymentApplicationStatus>> Allowed = new()
    {
        [PaymentApplicationStatus.Draft] = [PaymentApplicationStatus.Submitted],
        [PaymentApplicationStatus.Submitted] = [PaymentApplicationStatus.Reviewed, PaymentApplicationStatus.Rejected],
        [PaymentApplicationStatus.Reviewed] = [PaymentApplicationStatus.Approved, PaymentApplicationStatus.Rejected],
        [PaymentApplicationStatus.Approved] = [PaymentApplicationStatus.Paid],
        [PaymentApplicationStatus.Rejected] = [PaymentApplicationStatus.Draft],
        [PaymentApplicationStatus.Paid] = [],
        [PaymentApplicationStatus.Void] = [],
    };

    public static bool IsValid(PaymentApplicationStatus from, PaymentApplicationStatus to) =>
        from == to || (Allowed.TryGetValue(from, out var targets) && targets.Contains(to));

    public static IReadOnlySet<PaymentApplicationStatus> GetAllowed(PaymentApplicationStatus from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : new HashSet<PaymentApplicationStatus>();

    /// <summary>
    /// When approval workflow is disabled, Submitted may skip Reviewed and go directly to Approved.
    /// </summary>
    public static bool IsValid(PaymentApplicationStatus from, PaymentApplicationStatus to, bool enableApprovalWorkflow) =>
        enableApprovalWorkflow
            ? IsValid(from, to)
            : from == to
              || (from == PaymentApplicationStatus.Submitted && to == PaymentApplicationStatus.Approved)
              || (Allowed.TryGetValue(from, out var targets) && targets.Contains(to));
}