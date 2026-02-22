namespace Pitbull.Core.Services;

public interface IWorkflowTransitionService
{
    Task RecordTransitionAsync(
        string entityType,
        Guid entityId,
        string? fromStatus,
        string toStatus,
        Guid changedByUserId,
        string? changedByName,
        string? comment,
        CancellationToken ct);
}
