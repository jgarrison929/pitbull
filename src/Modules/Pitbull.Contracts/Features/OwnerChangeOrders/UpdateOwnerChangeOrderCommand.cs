using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.OwnerChangeOrders;

public record UpdateOwnerChangeOrderCommand(
    Guid Id,
    string ChangeOrderNumber,
    string Title,
    string Description,
    string? Reason,
    decimal Amount,
    int? DaysExtension,
    ChangeOrderStatus Status,
    string? ReferenceNumber,
    Guid? OwnerContractId = null,
    int? ScheduleImpactDays = null,
    decimal? CostImpact = null,
    string? RequestedBy = null,
    DateTime? RequestDate = null,
    DateTime? ApprovedDate = null
) : ICommand<OwnerChangeOrderDto>
{
    public string Number => ChangeOrderNumber;
}