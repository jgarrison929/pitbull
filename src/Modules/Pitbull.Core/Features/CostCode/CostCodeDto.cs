using Pitbull.Core.Domain;

namespace Pitbull.Core.Features.CostCode;

public record CostCodeDto(
    Guid Id,
    string Code,
    string Description,
    string? Division,
    CostType CostType,
    string CostTypeName,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public static class CostCodeMapper
{
    public static CostCodeDto ToDto(Domain.CostCode costCode)
    {
        return new CostCodeDto(
            Id: costCode.Id,
            Code: costCode.Code,
            Description: costCode.Description,
            Division: costCode.Division,
            CostType: costCode.CostType,
            CostTypeName: CostTypeLabels.DisplayName(costCode.CostType),
            IsActive: costCode.IsActive,
            CreatedAt: costCode.CreatedAt,
            UpdatedAt: costCode.UpdatedAt
        );
    }

    public static List<CostCodeDto> ToDto(IEnumerable<Domain.CostCode> costCodes)
    {
        return costCodes.Select(ToDto).ToList();
    }
}
