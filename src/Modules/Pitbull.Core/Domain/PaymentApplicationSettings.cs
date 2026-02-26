namespace Pitbull.Core.Domain;

/// <summary>
/// Company-scoped settings for payment application workflow and retainage defaults.
/// Stored as owned entity (columns on companies table) via OwnsOne.
/// </summary>
public class PaymentApplicationSettings
{
    /// <summary>Default retainage percent applied to new pay apps (typically 5-10%).</summary>
    public decimal DefaultRetainagePercent { get; set; } = 10m;

    /// <summary>Whether the approval workflow (Submit -> Review -> Approve -> Paid) is enforced.</summary>
    public bool EnableApprovalWorkflow { get; set; } = true;

    /// <summary>Block submit if subcontract has no execution date (unsigned).</summary>
    public bool RequireSignedSubcontract { get; set; } = true;

    /// <summary>Allow per-pay-app retainage percent override.</summary>
    public bool AllowRetainageOverride { get; set; }

    /// <summary>Allow retainage release before final/substantial completion.</summary>
    public bool AllowRetainageReleaseBeforeFinal { get; set; }

    /// <summary>Default accounting book mode for new pay apps.</summary>
    public string DefaultBookMode { get; set; } = "Both";

    /// <summary>Lock line items once pay app reaches Submitted status.</summary>
    public bool LockSubmittedLineItems { get; set; } = true;

    /// <summary>Require lien waiver before marking as Paid (future-compatible toggle).</summary>
    public bool RequireLienWaiverBeforePaid { get; set; }

    /// <summary>Default payment terms in days (Net 30/45/60). Used to auto-calculate ExpectedPaymentDate.</summary>
    public int DefaultPaymentTermDays { get; set; } = 30;
}
