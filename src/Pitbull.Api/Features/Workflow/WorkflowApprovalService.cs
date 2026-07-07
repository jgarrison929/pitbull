using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services;
using Pitbull.Projects.Domain;

namespace Pitbull.Api.Features.Workflow;

public sealed class WorkflowApprovalService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    IEnumerable<IWorkflowEntityCompleter> completers,
    IWorkflowTransitionService workflowTransitions,
    ILogger<WorkflowApprovalService> logger) : IWorkflowApprovalService
{
    private readonly Dictionary<string, IWorkflowEntityCompleter> _completers =
        completers.ToDictionary(c => c.EntityType, StringComparer.OrdinalIgnoreCase);

    public async Task<Result<WorkflowDefinitionDto>> CreateDefinitionAsync(
        CreateWorkflowDefinitionCommand command, CancellationToken ct = default)
    {
        if (!companyContext.IsResolved)
            return Result.Failure<WorkflowDefinitionDto>("No active company", "NO_COMPANY");

        var validation = ValidateDefinition(
            command.EntityType, command.TriggerStatus, command.ApprovedStatus, command.RejectedStatus, command.Steps);
        if (validation is not null)
            return Result.Failure<WorkflowDefinitionDto>(validation, "VALIDATION_ERROR");

        var definition = new WorkflowDefinition
        {
            CompanyId = companyContext.CompanyId,
            EntityType = command.EntityType,
            TriggerStatus = command.TriggerStatus,
            ApprovedStatus = command.ApprovedStatus,
            RejectedStatus = command.RejectedStatus,
            Name = command.Name,
            Description = command.Description,
            IsActive = command.IsActive,
            AmountThreshold = command.AmountThreshold,
            Mode = command.Mode,
            Priority = command.Priority,
            ProjectId = command.ProjectId,
            Steps = command.Steps.Select(s => new WorkflowApprovalStep
            {
                CompanyId = companyContext.CompanyId,
                StepOrder = s.StepOrder,
                Name = s.Name,
                ApproverType = s.ApproverType,
                ApproverRole = s.ApproverRole,
                ApproverUserId = s.ApproverUserId,
                ApproverRelationship = s.ApproverRelationship,
                IsOptional = s.IsOptional
            }).ToList()
        };

        db.WorkflowDefinitions.Add(definition);
        await db.SaveChangesAsync(ct);
        return Result.Success(MapDefinition(definition));
    }

    public async Task<Result<WorkflowDefinitionDto>> UpdateDefinitionAsync(
        Guid id, UpdateWorkflowDefinitionCommand command, CancellationToken ct = default)
    {
        if (!companyContext.IsResolved)
            return Result.Failure<WorkflowDefinitionDto>("No active company", "NO_COMPANY");

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Steps)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (definition is null)
            return Result.Failure<WorkflowDefinitionDto>("Workflow definition not found", "NOT_FOUND");

        var validation = ValidateDefinition(
            definition.EntityType, definition.TriggerStatus, definition.ApprovedStatus, definition.RejectedStatus, command.Steps);
        if (validation is not null)
            return Result.Failure<WorkflowDefinitionDto>(validation, "VALIDATION_ERROR");

        definition.Name = command.Name;
        definition.Description = command.Description;
        definition.IsActive = command.IsActive;
        definition.AmountThreshold = command.AmountThreshold;
        definition.Mode = command.Mode;
        definition.Priority = command.Priority;
        definition.ProjectId = command.ProjectId;

        db.WorkflowApprovalSteps.RemoveRange(definition.Steps);
        definition.Steps = command.Steps.Select(s => new WorkflowApprovalStep
        {
            CompanyId = definition.CompanyId,
            WorkflowDefinitionId = definition.Id,
            StepOrder = s.StepOrder,
            Name = s.Name,
            ApproverType = s.ApproverType,
            ApproverRole = s.ApproverRole,
            ApproverUserId = s.ApproverUserId,
            ApproverRelationship = s.ApproverRelationship,
            IsOptional = s.IsOptional
        }).ToList();

        await db.SaveChangesAsync(ct);
        return Result.Success(MapDefinition(definition));
    }

    public async Task<Result<List<WorkflowDefinitionDto>>> ListDefinitionsAsync(CancellationToken ct = default)
    {
        var items = await db.WorkflowDefinitions
            .AsNoTracking()
            .Include(d => d.Steps.OrderBy(s => s.StepOrder))
            .OrderByDescending(d => d.Priority)
            .ThenBy(d => d.Name)
            .ToListAsync(ct);

        return Result.Success(items.Select(MapDefinition).ToList());
    }

    public async Task<Result<WorkflowDefinitionDto>> GetDefinitionAsync(Guid id, CancellationToken ct = default)
    {
        var definition = await db.WorkflowDefinitions
            .AsNoTracking()
            .Include(d => d.Steps.OrderBy(s => s.StepOrder))
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (definition is null)
            return Result.Failure<WorkflowDefinitionDto>("Workflow definition not found", "NOT_FOUND");

        return Result.Success(MapDefinition(definition));
    }

    public async Task TryStartWorkflowAsync(
        string entityType,
        Guid entityId,
        string triggerStatus,
        Guid? projectId,
        decimal? amount,
        CancellationToken ct = default)
    {
        if (!companyContext.IsResolved)
            return;

        var definition = await FindMatchingDefinitionAsync(entityType, triggerStatus, projectId, amount, ct);
        if (definition is null)
            return;

        var hasExisting = await db.WorkflowApprovalActions
            .AnyAsync(a => a.EntityType == entityType
                           && a.EntityId == entityId
                           && a.WorkflowDefinitionId == definition.Id
                           && a.Status == ApprovalActionStatus.Pending, ct);

        if (hasExisting)
            return;

        var steps = definition.Steps.OrderBy(s => s.StepOrder).ToList();
        if (steps.Count == 0)
            return;

        var stepsToActivate = definition.Mode == ApprovalMode.Parallel
            ? steps
            : [steps[0]];

        foreach (var step in stepsToActivate)
        {
            var assignee = await ResolveApproverAsync(step, entityType, entityId, ct);
            if (assignee is null)
            {
                logger.LogWarning(
                    "Skipping workflow step {StepId} — no approver resolved for {EntityType} {EntityId}",
                    step.Id, entityType, entityId);
                continue;
            }

            db.WorkflowApprovalActions.Add(new WorkflowApprovalAction
            {
                CompanyId = companyContext.CompanyId,
                WorkflowDefinitionId = definition.Id,
                WorkflowApprovalStepId = step.Id,
                EntityType = entityType,
                EntityId = entityId,
                AssignedToUserId = assignee.Value.UserId,
                AssignedToUserName = assignee.Value.UserName,
                Status = ApprovalActionStatus.Pending,
                StepOrder = step.StepOrder,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> HasPendingApprovalsAsync(string entityType, Guid entityId, CancellationToken ct = default)
    {
        return await db.WorkflowApprovalActions
            .AnyAsync(a => a.EntityType == entityType
                           && a.EntityId == entityId
                           && a.Status == ApprovalActionStatus.Pending, ct);
    }

    public async Task<bool> BlocksTransitionAsync(
        string entityType,
        Guid entityId,
        string fromStatus,
        string toStatus,
        CancellationToken ct = default)
    {
        if (fromStatus == toStatus)
            return false;

        return await HasPendingApprovalsAsync(entityType, entityId, ct);
    }

    public async Task<Result<List<PendingApprovalDto>>> GetMyPendingAsync(Guid userId, CancellationToken ct = default)
    {
        var actions = await db.WorkflowApprovalActions
            .AsNoTracking()
            .Where(a => a.AssignedToUserId == userId && a.Status == ApprovalActionStatus.Pending)
            .OrderBy(a => a.CreatedAtUtc)
            .ToListAsync(ct);

        if (actions.Count == 0)
            return Result.Success(new List<PendingApprovalDto>());

        var definitionIds = actions.Select(a => a.WorkflowDefinitionId).Distinct().ToList();
        var stepIds = actions.Select(a => a.WorkflowApprovalStepId).Distinct().ToList();

        var definitions = await db.WorkflowDefinitions
            .AsNoTracking()
            .Where(d => definitionIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, ct);

        var steps = await db.WorkflowApprovalSteps
            .AsNoTracking()
            .Where(s => stepIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        var dtos = new List<PendingApprovalDto>();
        foreach (var action in actions)
        {
            if (!definitions.TryGetValue(action.WorkflowDefinitionId, out var definition))
                continue;
            if (!steps.TryGetValue(action.WorkflowApprovalStepId, out var step))
                continue;

            dtos.Add(new PendingApprovalDto(
                action.Id,
                action.EntityType,
                action.EntityId,
                definition.Name,
                step.Name,
                action.StepOrder,
                definition.TriggerStatus,
                definition.ApprovedStatus,
                definition.RejectedStatus,
                action.Status,
                action.CreatedAtUtc,
                await ResolveEntityTitleAsync(action.EntityType, action.EntityId, ct)));
        }

        return Result.Success(dtos);
    }

    public async Task<Result<PendingApprovalDto>> ApproveAsync(
        Guid actionId, Guid userId, string? userName, string? comment, CancellationToken ct = default)
    {
        var action = await LoadActionForUpdateAsync(actionId, ct);
        if (action is null)
            return Result.Failure<PendingApprovalDto>("Approval action not found", "NOT_FOUND");

        if (action.AssignedToUserId != userId)
            return Result.Failure<PendingApprovalDto>("Not assigned to this approver", "FORBIDDEN");

        if (action.Status != ApprovalActionStatus.Pending)
            return Result.Failure<PendingApprovalDto>("Action is no longer pending", "INVALID_STATUS");

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Steps)
            .FirstAsync(d => d.Id == action.WorkflowDefinitionId, ct);

        var willComplete = await WillCompleteAfterApprovalAsync(definition, action, ct);

        if (willComplete)
        {
            var complete = await CompleteWorkflowAsync(
                definition, action.EntityType, action.EntityId, approved: true, comment, userId, userName, ct);
            if (!complete.IsSuccess)
                return Result.Failure<PendingApprovalDto>(
                    complete.Error ?? "Workflow completion failed", complete.ErrorCode);
        }

        action.Status = ApprovalActionStatus.Approved;
        action.ResolvedAtUtc = DateTime.UtcNow;
        action.Comment = comment;
        await db.SaveChangesAsync(ct);

        if (!willComplete && definition.Mode == ApprovalMode.Sequential)
            await ActivateNextSequentialStepAsync(definition, action, ct);

        return Result.Success(await MapPendingActionAsync(action, definition, ct));
    }

    public async Task<Result<PendingApprovalDto>> RejectAsync(
        Guid actionId, Guid userId, string? userName, string? comment, CancellationToken ct = default)
    {
        var action = await LoadActionForUpdateAsync(actionId, ct);
        if (action is null)
            return Result.Failure<PendingApprovalDto>("Approval action not found", "NOT_FOUND");

        if (action.AssignedToUserId != userId)
            return Result.Failure<PendingApprovalDto>("Not assigned to this approver", "FORBIDDEN");

        if (action.Status != ApprovalActionStatus.Pending)
            return Result.Failure<PendingApprovalDto>("Action is no longer pending", "INVALID_STATUS");

        var definition = await db.WorkflowDefinitions
            .Include(d => d.Steps)
            .FirstAsync(d => d.Id == action.WorkflowDefinitionId, ct);

        await CancelSiblingPendingActionsAsync(action.EntityType, action.EntityId, action.Id, ct);

        var complete = await CompleteWorkflowAsync(
            definition, action.EntityType, action.EntityId, approved: false, comment, userId, userName, ct);
        if (!complete.IsSuccess)
            return Result.Failure<PendingApprovalDto>(
                complete.Error ?? "Workflow completion failed", complete.ErrorCode);

        action.Status = ApprovalActionStatus.Rejected;
        action.ResolvedAtUtc = DateTime.UtcNow;
        action.Comment = comment;
        await db.SaveChangesAsync(ct);

        return Result.Success(await MapPendingActionAsync(action, definition, ct));
    }

    internal static WorkflowDefinition? SelectBestDefinition(
        IEnumerable<WorkflowDefinition> candidates,
        string entityType,
        string triggerStatus,
        Guid? projectId,
        decimal? amount)
    {
        return candidates
            .Where(d => d.IsActive
                        && d.EntityType.Equals(entityType, StringComparison.OrdinalIgnoreCase)
                        && d.TriggerStatus.Equals(triggerStatus, StringComparison.OrdinalIgnoreCase)
                        && (d.ProjectId is null || d.ProjectId == projectId)
                        && (d.AmountThreshold is null || (amount ?? 0) >= d.AmountThreshold))
            .OrderByDescending(d => d.ProjectId.HasValue)
            .ThenByDescending(d => d.AmountThreshold ?? 0)
            .ThenByDescending(d => d.Priority)
            .FirstOrDefault();
    }

    private async Task<WorkflowDefinition?> FindMatchingDefinitionAsync(
        string entityType,
        string triggerStatus,
        Guid? projectId,
        decimal? amount,
        CancellationToken ct)
    {
        var candidates = await db.WorkflowDefinitions
            .AsNoTracking()
            .Include(d => d.Steps)
            .Where(d => d.IsActive && d.EntityType == entityType)
            .ToListAsync(ct);

        return SelectBestDefinition(candidates, entityType, triggerStatus, projectId, amount);
    }

    private async Task<WorkflowApprovalAction?> LoadActionForUpdateAsync(Guid actionId, CancellationToken ct)
    {
        return await db.WorkflowApprovalActions
            .FirstOrDefaultAsync(a => a.Id == actionId, ct);
    }

    private async Task ActivateNextSequentialStepAsync(
        WorkflowDefinition definition,
        WorkflowApprovalAction completedAction,
        CancellationToken ct)
    {
        var nextStep = definition.Steps
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault(s => s.StepOrder > completedAction.StepOrder);

        if (nextStep is null)
            return;

        var alreadyPending = await db.WorkflowApprovalActions
            .AnyAsync(a => a.EntityType == completedAction.EntityType
                           && a.EntityId == completedAction.EntityId
                           && a.WorkflowApprovalStepId == nextStep.Id
                           && a.Status == ApprovalActionStatus.Pending, ct);

        if (alreadyPending)
            return;

        var assignee = await ResolveApproverAsync(nextStep, completedAction.EntityType, completedAction.EntityId, ct);
        if (assignee is null)
            return;

        db.WorkflowApprovalActions.Add(new WorkflowApprovalAction
        {
            CompanyId = completedAction.CompanyId,
            WorkflowDefinitionId = definition.Id,
            WorkflowApprovalStepId = nextStep.Id,
            EntityType = completedAction.EntityType,
            EntityId = completedAction.EntityId,
            AssignedToUserId = assignee.Value.UserId,
            AssignedToUserName = assignee.Value.UserName,
            Status = ApprovalActionStatus.Pending,
            StepOrder = nextStep.StepOrder,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(ct);
    }

    private async Task<bool> WillCompleteAfterApprovalAsync(
        WorkflowDefinition definition,
        WorkflowApprovalAction action,
        CancellationToken ct)
    {
        var requiredStepIds = definition.Steps
            .Where(s => !s.IsOptional)
            .Select(s => s.Id)
            .ToHashSet();

        if (requiredStepIds.Count == 0)
            return true;

        var approvedStepIds = await db.WorkflowApprovalActions
            .Where(a => a.EntityType == action.EntityType
                        && a.EntityId == action.EntityId
                        && a.WorkflowDefinitionId == definition.Id
                        && a.Status == ApprovalActionStatus.Approved)
            .Select(a => a.WorkflowApprovalStepId)
            .ToListAsync(ct);

        approvedStepIds.Add(action.WorkflowApprovalStepId);
        return requiredStepIds.All(id => approvedStepIds.Contains(id));
    }

    private async Task CancelSiblingPendingActionsAsync(
        string entityType, Guid entityId, Guid exceptActionId, CancellationToken ct)
    {
        var siblings = await db.WorkflowApprovalActions
            .Where(a => a.EntityType == entityType
                        && a.EntityId == entityId
                        && a.Id != exceptActionId
                        && a.Status == ApprovalActionStatus.Pending)
            .ToListAsync(ct);

        foreach (var sibling in siblings)
        {
            sibling.Status = ApprovalActionStatus.Skipped;
            sibling.ResolvedAtUtc = DateTime.UtcNow;
        }
    }

    private async Task<Result> CompleteWorkflowAsync(
        WorkflowDefinition definition,
        string entityType,
        Guid entityId,
        bool approved,
        string? comment,
        Guid userId,
        string? userName,
        CancellationToken ct)
    {
        if (!_completers.TryGetValue(entityType, out var completer))
            return Result.Failure($"No workflow completer registered for {entityType}", "NOT_SUPPORTED");

        var targetStatus = approved ? definition.ApprovedStatus : definition.RejectedStatus;
        var result = approved
            ? await completer.ApplyApprovedStatusAsync(entityId, targetStatus, ct)
            : await completer.ApplyRejectedStatusAsync(entityId, targetStatus, comment, ct);

        if (result.IsSuccess)
        {
            await workflowTransitions.RecordTransitionAsync(
                entityType, entityId,
                definition.TriggerStatus, targetStatus,
                userId, userName, comment, ct);
        }

        return result;
    }

    private async Task<(Guid UserId, string? UserName)?> ResolveApproverAsync(
        WorkflowApprovalStep step, string entityType, Guid entityId, CancellationToken ct)
    {
        return step.ApproverType switch
        {
            ApproverType.User when step.ApproverUserId.HasValue =>
                (step.ApproverUserId.Value, null),
            ApproverType.Role when !string.IsNullOrWhiteSpace(step.ApproverRole) =>
                await ResolveRoleApproverAsync(step.ApproverRole, ct),
            ApproverType.EntityRelationship when !string.IsNullOrWhiteSpace(step.ApproverRelationship) =>
                await ResolveEntityRelationshipApproverAsync(entityType, entityId, step.ApproverRelationship, ct),
            _ => null
        };
    }

    private async Task<(Guid UserId, string? UserName)?> ResolveRoleApproverAsync(string role, CancellationToken ct)
    {
        if (!companyContext.IsResolved)
            return null;

        var user = await db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantContext.TenantId)
            .Join(
                db.UserCompanyAccess.Where(a => a.CompanyId == companyContext.CompanyId),
                u => u.Id,
                a => a.UserId,
                (u, _) => u)
            .Join(db.UserRolesMap, u => u.Id, ur => ur.UserId, (u, ur) => new { u, ur })
            .Join(db.RbacRoles, x => x.ur.RoleId, r => r.Id, (x, r) => new { x.u, r })
            .Where(x => x.r.Name == role)
            .Select(x => new { x.u.Id, Name = x.u.FirstName + " " + x.u.LastName })
            .FirstOrDefaultAsync(ct);

        return user is null ? null : (user.Id, user.Name);
    }

    private async Task<(Guid UserId, string? UserName)?> ResolveEntityRelationshipApproverAsync(
        string entityType, Guid entityId, string relationship, CancellationToken ct)
    {
        if (!companyContext.IsResolved)
            return null;

        var projectId = await ResolveProjectIdForEntityAsync(entityType, entityId, ct);
        if (projectId is null)
            return null;

        var project = await db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId, ct);

        if (project is null)
            return null;

        Guid? employeeId = relationship switch
        {
            "ProjectManager" => project.ProjectManagerId,
            "Superintendent" => project.SuperintendentId,
            _ => null
        };

        if (!employeeId.HasValue)
            return null;

        var user = await db.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantContext.TenantId && u.EmployeeId == employeeId)
            .Join(
                db.UserCompanyAccess.Where(a => a.CompanyId == companyContext.CompanyId),
                u => u.Id,
                a => a.UserId,
                (u, _) => u)
            .Select(u => new { u.Id, Name = u.FirstName + " " + u.LastName })
            .FirstOrDefaultAsync(ct);

        return user is null ? null : (user.Id, user.Name);
    }

    private async Task<Guid?> ResolveProjectIdForEntityAsync(string entityType, Guid entityId, CancellationToken ct)
    {
        return entityType switch
        {
            "ChangeOrder" => await (
                from co in db.Set<Pitbull.Contracts.Domain.ChangeOrder>().AsNoTracking()
                join sc in db.Set<Pitbull.Contracts.Domain.Subcontract>().AsNoTracking()
                    on co.SubcontractId equals sc.Id
                where co.Id == entityId
                select (Guid?)sc.ProjectId).FirstOrDefaultAsync(ct),
            "BillingApplication" => await db.Set<BillingApplication>()
                .AsNoTracking()
                .Where(a => a.Id == entityId)
                .Select(a => (Guid?)a.ProjectId)
                .FirstOrDefaultAsync(ct),
            _ => null
        };
    }

    private async Task<string?> ResolveEntityTitleAsync(string entityType, Guid entityId, CancellationToken ct)
    {
        return entityType switch
        {
            "ChangeOrder" => await db.Set<Pitbull.Contracts.Domain.ChangeOrder>()
                .AsNoTracking()
                .Where(co => co.Id == entityId)
                .Select(co => co.Title)
                .FirstOrDefaultAsync(ct),
            "BillingApplication" => await db.Set<Pitbull.Core.Domain.BillingApplication>()
                .AsNoTracking()
                .Where(a => a.Id == entityId)
                .Select(a => $"Pay App #{a.ApplicationNumber}")
                .FirstOrDefaultAsync(ct),
            _ => null
        };
    }

    private async Task<PendingApprovalDto> MapPendingActionAsync(
        WorkflowApprovalAction action, WorkflowDefinition definition, CancellationToken ct)
    {
        var step = definition.Steps.First(s => s.Id == action.WorkflowApprovalStepId);
        return new PendingApprovalDto(
            action.Id,
            action.EntityType,
            action.EntityId,
            definition.Name,
            step.Name,
            action.StepOrder,
            definition.TriggerStatus,
            definition.ApprovedStatus,
            definition.RejectedStatus,
            action.Status,
            action.CreatedAtUtc,
            await ResolveEntityTitleAsync(action.EntityType, action.EntityId, ct));
    }

    private static string? ValidateDefinition(
        string entityType,
        string triggerStatus,
        string approvedStatus,
        string rejectedStatus,
        IReadOnlyList<CreateWorkflowApprovalStepCommand> steps)
    {
        var stepValidation = ValidateSteps(steps);
        if (stepValidation is not null)
            return stepValidation;

        var transitionValidation = WorkflowStatusTransitionValidator.ValidateDefinition(
            entityType, triggerStatus, approvedStatus, rejectedStatus);
        if (transitionValidation is not null)
            return transitionValidation;

        foreach (var step in steps)
        {
            var approverValidation = step.ApproverType switch
            {
                ApproverType.User when !step.ApproverUserId.HasValue =>
                    $"Step {step.StepOrder} requires an approver user",
                ApproverType.Role when string.IsNullOrWhiteSpace(step.ApproverRole) =>
                    $"Step {step.StepOrder} requires an approver role",
                ApproverType.EntityRelationship when string.IsNullOrWhiteSpace(step.ApproverRelationship) =>
                    $"Step {step.StepOrder} requires an approver relationship",
                _ => null
            };

            if (approverValidation is not null)
                return approverValidation;
        }

        return null;
    }

    private static string? ValidateSteps(IReadOnlyList<CreateWorkflowApprovalStepCommand> steps)
    {
        if (steps.Count == 0)
            return "At least one approval step is required";

        if (steps.Any(s => s.StepOrder < 1))
            return "Step order must be 1 or greater";

        if (steps.Select(s => s.StepOrder).Distinct().Count() != steps.Count)
            return "Step orders must be unique";

        return null;
    }

    private static WorkflowDefinitionDto MapDefinition(WorkflowDefinition definition) => new(
        definition.Id,
        definition.EntityType,
        definition.TriggerStatus,
        definition.ApprovedStatus,
        definition.RejectedStatus,
        definition.Name,
        definition.Description,
        definition.IsActive,
        definition.AmountThreshold,
        definition.Mode,
        definition.Priority,
        definition.ProjectId,
        definition.Steps
            .OrderBy(s => s.StepOrder)
            .Select(s => new WorkflowApprovalStepDto(
                s.Id, s.StepOrder, s.Name, s.ApproverType,
                s.ApproverRole, s.ApproverUserId, s.ApproverRelationship, s.IsOptional))
            .ToList());
}