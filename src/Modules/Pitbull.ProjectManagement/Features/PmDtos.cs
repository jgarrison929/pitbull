using Pitbull.Core.CQRS;

namespace Pitbull.ProjectManagement.Features;

public record PmEntityDto(
    Guid Id,
    Guid? ProjectId,
    string? Name,
    string? Title,
    string? Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    object? Data = null
);

public record PmActionResultDto(
    bool Success,
    string Message,
    Guid? Id = null,
    object? Data = null
);

public record PmListQuery(
    Guid? ProjectId = null,
    string? Status = null,
    string? Search = null,
    DateTime? StartDate = null,
    DateTime? EndDate = null
) : PaginationQuery;

public record PmUpsertRequest(
    string? Name = null,
    string? Title = null,
    string? Description = null,
    string? Status = null,
    Guid? ReferenceId = null,
    DateTime? DueDate = null,
    Dictionary<string, object?>? Data = null
);
