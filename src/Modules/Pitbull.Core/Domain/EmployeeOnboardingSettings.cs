namespace Pitbull.Core.Domain;

/// <summary>
/// Company-level configuration for employee onboarding workflow.
/// Stored as owned entity on Company (columns on companies table).
/// </summary>
public class EmployeeOnboardingSettings
{
    /// <summary>
    /// Whether onboarding wizard is enabled for this company.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Whether a multi-step approval workflow is required
    /// (HR -> Safety -> Payroll) before onboarding is marked complete.
    /// </summary>
    public bool RequireApprovalWorkflow { get; set; }

    /// <summary>
    /// Require at least one emergency contact during onboarding.
    /// </summary>
    public bool RequireEmergencyContact { get; set; } = true;

    /// <summary>
    /// Require I-9 employment eligibility verification.
    /// </summary>
    public bool RequireI9 { get; set; } = true;

    /// <summary>
    /// Require W-4 federal tax withholding data.
    /// </summary>
    public bool RequireW4 { get; set; } = true;

    /// <summary>
    /// Require at least one valid certification (e.g., OSHA-10).
    /// </summary>
    public bool RequireCertifications { get; set; }

    /// <summary>
    /// Comma-separated list of certification types required
    /// (e.g., "OSHA-10,OSHA-30,CDL"). Empty means no specific types required.
    /// </summary>
    public string RequiredCertificationTypes { get; set; } = string.Empty;

    /// <summary>
    /// Default prevailing wage classification for new employees.
    /// </summary>
    public string DefaultPrevailingWageClass { get; set; } = string.Empty;

    /// <summary>
    /// Enable union affiliation and prevailing wage fields.
    /// </summary>
    public bool EnableUnionFields { get; set; }
}
