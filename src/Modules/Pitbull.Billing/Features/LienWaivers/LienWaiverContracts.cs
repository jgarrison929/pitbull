using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.LienWaivers;

public record LienWaiverDto(
    Guid Id,
    Guid ProjectId,
    Guid? VendorId,
    LienWaiverType WaiverType,
    decimal Amount,
    DateOnly ThroughDate,
    LienWaiverStatus Status,
    string? DocumentPath,
    string? Description,
    Guid? ReviewedByUserId,
    DateTime? ReviewedAt,
    string? RejectionReason,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateLienWaiverCommand(
    Guid ProjectId,
    Guid? VendorId,
    LienWaiverType WaiverType,
    decimal Amount,
    DateOnly ThroughDate,
    string? Description = null
) : ICommand<LienWaiverDto>;

public record UpdateLienWaiverCommand(
    Guid WaiverId,
    decimal? Amount = null,
    DateOnly? ThroughDate = null,
    string? Description = null,
    string? DocumentPath = null
) : ICommand<LienWaiverDto>;

public record ListLienWaiversQuery(
    Guid? ProjectId = null,
    Guid? VendorId = null,
    LienWaiverType? WaiverType = null,
    LienWaiverStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListLienWaiversResult>;

public record ListLienWaiversResult(
    IReadOnlyList<LienWaiverDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
