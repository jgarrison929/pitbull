using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Services;

public interface IWorkflowApprovalService
{
    Task<Result<WorkflowDefinitionDto>> CreateDefinitionAsync(
        CreateWorkflowDefinitionCommand command, CancellationToken ct = default);

    Task<Result<WorkflowDefinitionDto>> UpdateDefinitionAsync(
        Guid id, UpdateWorkflowDefinitionCommand command, CancellationToken ct = default);

    Task<Result<List<WorkflowDefinitionDto>>> ListDefinitionsAsync(CancellationToken ct = default);

    Task<Result<WorkflowDefinitionDto>> GetDefinitionAsync(Guid id, CancellationToken ct = default);

    Task TryStartWorkflowAsync(
        string entityType,
        Guid entityId,
        string triggerStatus,
        Guid? projectId,
        decimal? amount,
        CancellationToken ct = default);

    Task<bool> HasPendingApprovalsAsync(string entityType, Guid entityId, CancellationToken ct = default);

    Task<bool> BlocksTransitionAsync(
        string entityType,
        Guid entityId,
        string fromStatus,
        string toStatus,
        CancellationToken ct = default);

    Task<Result<List<PendingApprovalDto>>> GetMyPendingAsync(Guid userId, CancellationToken ct = default);

    Task<Result<PendingApprovalDto>> ApproveAsync(
        Guid actionId, Guid userId, string? userName, string? comment, CancellationToken ct = default);

    Task<Result<PendingApprovalDto>> RejectAsync(
        Guid actionId, Guid userId, string? userName, string? comment, CancellationToken ct = default);
}

public interface IWorkflowEntityCompleter
{
    string EntityType { get; }
    Task<Result> ApplyApprovedStatusAsync(Guid entityId, string approvedStatus, CancellationToken ct);
    Task<Result> ApplyRejectedStatusAsync(Guid entityId, string rejectedStatus, string? comment, CancellationToken ct);
}

public sealed record CreateWorkflowDefinitionCommand(
    string EntityType,
    string TriggerStatus,
    string ApprovedStatus,
    string RejectedStatus,
    string Name,
    string? Description,
    bool IsActive,
    decimal? AmountThreshold,
    ApprovalMode Mode,
    int Priority,
    Guid? ProjectId,
    IReadOnlyList<CreateWorkflowApprovalStepCommand> Steps);

public sealed record CreateWorkflowApprovalStepCommand(
    int StepOrder,
    string Name,
    ApproverType ApproverType,
    string? ApproverRole,
    Guid? ApproverUserId,
    string? ApproverRelationship,
    bool IsOptional);

public sealed record UpdateWorkflowDefinitionCommand(
    string Name,
    string? Description,
    bool IsActive,
    decimal? AmountThreshold,
    ApprovalMode Mode,
    int Priority,
    Guid? ProjectId,
    IReadOnlyList<CreateWorkflowApprovalStepCommand> Steps);

public sealed record WorkflowDefinitionDto(
    Guid Id,
    string EntityType,
    string TriggerStatus,
    string ApprovedStatus,
    string RejectedStatus,
    string Name,
    string? Description,
    bool IsActive,
    decimal? AmountThreshold,
    ApprovalMode Mode,
    int Priority,
    Guid? ProjectId,
    IReadOnlyList<WorkflowApprovalStepDto> Steps);

public sealed record WorkflowApprovalStepDto(
    Guid Id,
    int StepOrder,
    string Name,
    ApproverType ApproverType,
    string? ApproverRole,
    Guid? ApproverUserId,
    string? ApproverRelationship,
    bool IsOptional);

public sealed record PendingApprovalDto(
    Guid Id,
    string EntityType,
    Guid EntityId,
    string WorkflowName,
    string StepName,
    int StepOrder,
    string TriggerStatus,
    string ApprovedStatus,
    string RejectedStatus,
    ApprovalActionStatus Status,
    DateTime CreatedAtUtc,
    string? EntityTitle);