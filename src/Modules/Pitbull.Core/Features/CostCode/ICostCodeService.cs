using Pitbull.Core.CQRS;

namespace Pitbull.Core.Features.CostCode;

public interface ICostCodeService
{
    Task<Result<CostCodeDto>> GetCostCodeAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result<ListCostCodesResult>> ListCostCodesAsync(
        ListCostCodesQuery query,
        CancellationToken cancellationToken = default);

    Task<Result<CostCodeDto>> CreateCostCodeAsync(
        CreateCostCodeCommand command,
        CancellationToken cancellationToken = default);

    Task<Result<CostCodeDto>> UpdateCostCodeAsync(
        UpdateCostCodeCommand command,
        CancellationToken cancellationToken = default);

    Task<Result> DeleteCostCodeAsync(
        Guid id,
        CancellationToken cancellationToken = default);
}
