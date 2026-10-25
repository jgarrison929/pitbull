using Pitbull.Billing.Features.AccountingPeriods;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IAccountingPeriodService
{
    Task<Result<ListAccountingPeriodsResult>> GetPeriodsAsync(ListAccountingPeriodsQuery query, CancellationToken cancellationToken = default);
    Task<Result<AccountingPeriodDto>> GetPeriodAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<AccountingPeriodDto>> CreatePeriodAsync(CreateAccountingPeriodCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeletePeriodAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<AccountingPeriodDto>> ClosePeriodAsync(Guid id, Guid closedByUserId, CancellationToken cancellationToken = default);
    Task<Result<AccountingPeriodDto>> ReopenPeriodAsync(Guid id, string reason, CancellationToken cancellationToken = default);
    Task<Result<List<AccountingPeriodDto>>> SeedFiscalYearAsync(int fiscalYear, CancellationToken cancellationToken = default);
}
