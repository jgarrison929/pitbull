using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.AccountingPeriods;

public record AccountingPeriodDto(
    Guid Id,
    int PeriodNumber,
    int FiscalYear,
    string PeriodName,
    DateOnly StartDate,
    DateOnly EndDate,
    PeriodStatus Status,
    Guid? ClosedByUserId,
    DateTime? ClosedAt,
    int ReopenedCount,
    DateTime? LastReopenedAt,
    string? LastReopenReason,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateAccountingPeriodCommand(
    int PeriodNumber,
    int FiscalYear,
    string PeriodName,
    DateOnly StartDate,
    DateOnly EndDate
) : ICommand<AccountingPeriodDto>;

public record ListAccountingPeriodsQuery(
    int? FiscalYear = null,
    PeriodStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListAccountingPeriodsResult>;

public record ListAccountingPeriodsResult(
    IReadOnlyList<AccountingPeriodDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
