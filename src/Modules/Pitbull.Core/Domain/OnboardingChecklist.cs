namespace Pitbull.Core.Domain;

/// <summary>
/// Tracks onboarding progress for a user within a company.
/// Each checklist item represents a step the user should complete
/// to fully set up their workspace.
/// </summary>
public class OnboardingChecklist : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid CompanyId { get; set; }

    // Checklist items - each tracks whether the step has been completed
    public bool CompanyProfileCompleted { get; set; }
    public bool ContractorTypeSelected { get; set; }
    public bool ModulesActivated { get; set; }
    public bool ModulesConfigured { get; set; }
    public bool TeamMembersInvited { get; set; }
    public bool FirstProjectCreated { get; set; }
    public bool EmployeesAdded { get; set; }
    public bool CostCodesConfigured { get; set; }

    /// <summary>
    /// Whether the user has dismissed the onboarding checklist.
    /// </summary>
    public bool Dismissed { get; set; }

    /// <summary>
    /// When the checklist was fully completed (all items done).
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    // Navigation
    public AppUser User { get; set; } = null!;
    public Company Company { get; set; } = null!;

    /// <summary>
    /// Number of completed items out of total.
    /// </summary>
    public int CompletedCount =>
        (CompanyProfileCompleted ? 1 : 0) +
        (ContractorTypeSelected ? 1 : 0) +
        (ModulesActivated ? 1 : 0) +
        (ModulesConfigured ? 1 : 0) +
        (TeamMembersInvited ? 1 : 0) +
        (FirstProjectCreated ? 1 : 0) +
        (EmployeesAdded ? 1 : 0) +
        (CostCodesConfigured ? 1 : 0);

    public const int TotalItems = 8;

    public bool IsFullyCompleted => CompletedCount == TotalItems;

    /// <summary>
    /// True when the 4-step company setup wizard has been completed.
    /// </summary>
    public bool IsCompanySetupComplete =>
        CompanyProfileCompleted &&
        ContractorTypeSelected &&
        ModulesActivated &&
        ModulesConfigured;
}
