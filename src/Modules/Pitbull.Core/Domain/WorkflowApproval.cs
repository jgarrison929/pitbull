namespace Pitbull.Core.Domain;

/// <summary>
/// Defines an approval chain for a specific entity type at a trigger status.
/// </summary>
public class WorkflowDefinition : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string TriggerStatus { get; set; } = string.Empty;
    public string ApprovedStatus { get; set; } = string.Empty;
    public string RejectedStatus { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public decimal? AmountThreshold { get; set; }
    public ApprovalMode Mode { get; set; } = ApprovalMode.Sequential;
    public int Priority { get; set; }
    public Guid? ProjectId { get; set; }
    public List<WorkflowApprovalStep> Steps { get; set; } = [];
}

public enum ApprovalMode
{
    Sequential = 0,
    Parallel = 1
}

/// <summary>
/// One step in an approval chain.
/// </summary>
public class WorkflowApprovalStep : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid WorkflowDefinitionId { get; set; }
    public int StepOrder { get; set; }
    public string Name { get; set; } = string.Empty;
    public ApproverType ApproverType { get; set; }
    public string? ApproverRole { get; set; }
    public Guid? ApproverUserId { get; set; }
    public string? ApproverRelationship { get; set; }
    public bool IsOptional { get; set; }
    public WorkflowDefinition WorkflowDefinition { get; set; } = null!;
}

public enum ApproverType
{
    Role = 0,
    User = 1,
    EntityRelationship = 2
}

/// <summary>
/// A concrete approval action for a specific entity instance.
/// </summary>
public class WorkflowApprovalAction : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid WorkflowDefinitionId { get; set; }
    public Guid WorkflowApprovalStepId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public Guid AssignedToUserId { get; set; }
    public string? AssignedToUserName { get; set; }
    public ApprovalActionStatus Status { get; set; } = ApprovalActionStatus.Pending;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAtUtc { get; set; }
    public string? Comment { get; set; }
    public int StepOrder { get; set; }
    public WorkflowApprovalStep ApprovalStep { get; set; } = null!;
}

public enum ApprovalActionStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Skipped = 3
}