using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.OwnerChangeOrders;

public record CreateOwnerChangeOrderCommand(
    Guid ProjectId,
    string ChangeOrderNumber,
    string Title,
    string Description,
    string? Reason,
    decimal Amount,
    int? DaysExtension,
    string? ReferenceNumber,
    Guid? OwnerContractId = null,
    Guid? OriginatingRfiId = null,
    ChangeOrderStatus Status = ChangeOrderStatus.Pending,
    int? ScheduleImpactDays = null,
    decimal? CostImpact = null,
    string? RequestedBy = null,
    DateTime? RequestDate = null,
    DateTime? ApprovedDate = null
) : ICommand<OwnerChangeOrderDto>
{
    public string Number => ChangeOrderNumber;
}

public record OwnerChangeOrderDto(
    Guid Id,
    Guid ProjectId,
    Guid? OwnerContractId,
    string ChangeOrderNumber,
    string Title,
    string Description,
    string? Reason,
    decimal Amount,
    int? DaysExtension,
    ChangeOrderStatus Status,
    DateTime? SubmittedDate,
    DateTime? ApprovedDate,
    DateTime? RejectedDate,
    string? ApprovedBy,
    string? RejectedBy,
    string? RejectionReason,
    string? ReferenceNumber,
    string? Number = null,
    int? ScheduleImpactDays = null,
    decimal? CostImpact = null,
    string? RequestedBy = null,
    DateTime? RequestDate = null,
    DateTime CreatedAt = default
);