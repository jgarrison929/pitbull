using Pitbull.Core.CQRS;

namespace Pitbull.Core.Features.ChartOfAccounts;

public interface IChartOfAccountService
{
    Task<Result<ChartOfAccountDto>> GetChartOfAccountAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result<ListChartOfAccountsResult>> ListChartOfAccountsAsync(
        ListChartOfAccountsQuery query,
        CancellationToken cancellationToken = default);

    Task<Result<ChartOfAccountDto>> CreateChartOfAccountAsync(
        CreateChartOfAccountCommand command,
        CancellationToken cancellationToken = default);

    Task<Result<ChartOfAccountDto>> UpdateChartOfAccountAsync(
        UpdateChartOfAccountCommand command,
        CancellationToken cancellationToken = default);

    Task<Result> DeleteChartOfAccountAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result<IReadOnlyList<ChartOfAccountTreeNodeDto>>> GetTreeAsync(CancellationToken cancellationToken = default);
}
