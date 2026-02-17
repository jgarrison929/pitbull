using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.CreateChangeOrder;

public record CreateChangeOrderCommand(
    Guid SubcontractId,
    string ChangeOrderNumber,
    string Title,
    string Description,
    string? Reason,
    decimal Amount,
    int? DaysExtension,
    string? ReferenceNumber,
    Guid? OriginatingRfiId = null,
    ChangeOrderStatus Status = ChangeOrderStatus.Pending,
    int? ScheduleImpactDays = null,
    decimal? CostImpact = null,
    string? RequestedBy = null,
    DateTime? RequestDate = null,
    DateTime? ApprovedDate = null
) : ICommand<ChangeOrderDto>
{
    public string Number => ChangeOrderNumber;
}

public record ChangeOrderDto(
    Guid Id,
    Guid SubcontractId,
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
