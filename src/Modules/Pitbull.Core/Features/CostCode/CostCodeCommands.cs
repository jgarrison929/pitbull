using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Features.CostCode;

public record CreateCostCodeCommand(
    string Code,
    string Description,
    string? Division = null,
    CostType CostType = CostType.Labor,
    bool IsActive = true
) : ICommand<CostCodeDto>;

public record UpdateCostCodeCommand(
    Guid CostCodeId,
    string? Code = null,
    string? Description = null,
    string? Division = null,
    CostType? CostType = null,
    bool? IsActive = null
) : ICommand<CostCodeDto>;

public record ListCostCodesQuery(
    CostType? CostType = null,
    bool? IsActive = null,
    string? SearchTerm = null,
    int Page = 1,
    int PageSize = 100
) : IQuery<ListCostCodesResult>;

public record ListCostCodesResult(
    IReadOnlyList<CostCodeDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
