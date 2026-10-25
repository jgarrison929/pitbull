namespace Pitbull.Core.Domain;

/// <summary>
/// Company-level subcontract and billing configuration. Owned by Company entity.
/// Controls retainage defaults, approval workflows, and AIA form settings.
/// </summary>
public class ContractSettings
{
    /// <summary>
    /// Default retainage percentage applied to new subcontracts.
    /// Industry standard is 5-10%.
    /// </summary>
    public decimal DefaultRetainagePercent { get; set; } = 10m;

    /// <summary>
    /// Block pay app submission if the subcontract has no execution date (unsigned).
    /// Protects against paying on unsigned contracts.
    /// </summary>
    public bool RequireSignedSubcontractBeforePayApp { get; set; } = true;

    /// <summary>
    /// Approval workflow type for subcontracts.
    /// "None" = no approval needed; "Sequential" = PM -> Exec; "Parallel" = any approver.
    /// </summary>
    public string ApprovalWorkflowType { get; set; } = "Sequential";

    /// <summary>
    /// Default architect name pre-filled on AIA G702/G703 forms.
    /// </summary>
    public string AiaArchitectName { get; set; } = string.Empty;

    /// <summary>
    /// Default project owner/client name pre-filled on AIA forms.
    /// </summary>
    public string AiaOwnerName { get; set; } = string.Empty;
}
