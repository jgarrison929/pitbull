using MediatR;
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
    string? ReferenceNumber
) : IRequest<Result<ChangeOrderDto>>;

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
    DateTime CreatedAt
);
