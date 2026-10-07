using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Payroll.Features.WorkClassifications;

public record WorkClassificationDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsActive,
    string? Craft,
    string? ClassName,
    bool Apprenticeable,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateWorkClassificationCommand(
    string Code,
    string Name,
    string? Description,
    bool IsActive = true,
    string? Craft = null,
    string? ClassName = null,
    bool Apprenticeable = false) : ICommand<WorkClassificationDto>;

public record UpdateWorkClassificationCommand(
    Guid Id,
    string? Code = null,
    string? Name = null,
    string? Description = null,
    bool? IsActive = null,
    string? Craft = null,
    string? ClassName = null,
    bool? Apprenticeable = null) : ICommand<WorkClassificationDto>;

public record ListWorkClassificationsQuery(
    bool? IsActive = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25) : IQuery<ListWorkClassificationsResult>;

public record ListWorkClassificationsResult(
    IReadOnlyList<WorkClassificationDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);
