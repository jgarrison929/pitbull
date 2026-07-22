using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.OwnerChangeOrders;

namespace Pitbull.Contracts.Features;

/// <summary>
/// Slim change-order row for phone lists (GET …/changeorders?view=mobile,
/// GET …/owner-change-orders?view=mobile).
/// Band 3.6 contract: id, number, title, status, projectId, amount?, dueDate?.
/// Omits description body, approval actor bags, and any health/KPI fields.
/// </summary>
public record ChangeOrderMobileListItemDto(
    Guid Id,
    string Number,
    string Title,
    string Status,
    Guid ProjectId,
    decimal? Amount,
    DateTime? DueDate,
    /// <summary>Subcontract scope when this is a sub CO (null for owner COs).</summary>
    Guid? SubcontractId = null
);

/// <summary>Maps full CO DTOs to the mobile list contract (no KPI fields).</summary>
public static class ChangeOrderListViewMapper
{
    public static ChangeOrderMobileListItemDto ToMobileListItem(
        ChangeOrderDto dto,
        Guid? projectId = null) =>
        new(
            dto.Id,
            Number: dto.ChangeOrderNumber ?? dto.Number ?? string.Empty,
            Title: dto.Title,
            Status: dto.Status.ToString(),
            ProjectId: projectId ?? Guid.Empty,
            Amount: dto.Amount,
            DueDate: dto.RequestDate ?? dto.SubmittedDate,
            SubcontractId: dto.SubcontractId
        );

    public static ChangeOrderMobileListItemDto ToMobileListItem(OwnerChangeOrderDto dto) =>
        new(
            dto.Id,
            Number: dto.ChangeOrderNumber ?? dto.Number ?? string.Empty,
            Title: dto.Title,
            Status: dto.Status.ToString(),
            ProjectId: dto.ProjectId,
            Amount: dto.Amount,
            DueDate: dto.RequestDate ?? dto.SubmittedDate,
            SubcontractId: null
        );
}
