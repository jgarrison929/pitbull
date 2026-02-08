using MediatR;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.UpdateChangeOrder;

public record UpdateChangeOrderCommand(
    Guid Id,
    string ChangeOrderNumber,
    string Title,
    string Description,
    string? Reason,
    decimal Amount,
    int? DaysExtension,
    ChangeOrderStatus Status,
    string? ReferenceNumber
) : IRequest<Result<ChangeOrderDto>>;
