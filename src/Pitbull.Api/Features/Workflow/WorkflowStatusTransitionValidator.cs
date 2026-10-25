using Pitbull.Billing.Domain;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Features.Workflow;

/// <summary>
/// Validates workflow definition target statuses against entity lifecycle graphs.
/// </summary>
internal static class WorkflowStatusTransitionValidator
{
    public static string? ValidateDefinition(
        string entityType,
        string triggerStatus,
        string approvedStatus,
        string rejectedStatus)
    {
        if (string.IsNullOrWhiteSpace(entityType))
            return "Entity type is required";

        if (approvedStatus == rejectedStatus)
            return "Approved and rejected statuses must differ";

        if (!IsValidTargetTransition(entityType, triggerStatus, approvedStatus))
            return $"Approved status '{approvedStatus}' is not a valid transition from trigger '{triggerStatus}' for {entityType}";

        if (!IsValidTargetTransition(entityType, triggerStatus, rejectedStatus))
            return $"Rejected status '{rejectedStatus}' is not a valid transition from trigger '{triggerStatus}' for {entityType}";

        return null;
    }

    public static bool IsValidTargetTransition(string entityType, string fromStatus, string toStatus)
    {
        if (fromStatus == toStatus)
            return false;

        return entityType switch
        {
            "ChangeOrder" when Enum.TryParse<ChangeOrderStatus>(fromStatus, out var from)
                               && Enum.TryParse<ChangeOrderStatus>(toStatus, out var to)
                => ChangeOrderStatusTransitions.IsValid(from, to),
            "BillingApplication" when Enum.TryParse<BillingApplicationStatus>(fromStatus, out var from)
                                      && Enum.TryParse<BillingApplicationStatus>(toStatus, out var to)
                => BillingApplicationStatusTransitions.IsValid(from, to),
            _ => false
        };
    }
}