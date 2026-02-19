using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Features.ChartOfAccounts;

public record ChartOfAccountDto(
    Guid Id,
    string AccountNumber,
    string AccountName,
    AccountType AccountType,
    string AccountTypeName,
    Guid? ParentAccountId,
    string? Description,
    bool IsActive,
    NormalBalance NormalBalance,
    string NormalBalanceName,
    Guid? DepartmentId,
    bool IsSubledgerControl,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record ChartOfAccountTreeNodeDto(
    Guid Id,
    string AccountNumber,
    string AccountName,
    AccountType AccountType,
    string AccountTypeName,
    Guid? ParentAccountId,
    string? Description,
    bool IsActive,
    NormalBalance NormalBalance,
    string NormalBalanceName,
    Guid? DepartmentId,
    bool IsSubledgerControl,
    IReadOnlyList<ChartOfAccountTreeNodeDto> Children
);

public record CreateChartOfAccountCommand(
    string AccountNumber,
    string AccountName,
    AccountType AccountType,
    Guid? ParentAccountId = null,
    string? Description = null,
    bool IsActive = true,
    NormalBalance? NormalBalance = null,
    Guid? DepartmentId = null,
    bool IsSubledgerControl = false
) : ICommand<ChartOfAccountDto>;

public record UpdateChartOfAccountCommand(
    Guid ChartOfAccountId,
    string? AccountNumber = null,
    string? AccountName = null,
    AccountType? AccountType = null,
    Guid? ParentAccountId = null,
    bool ClearParentAccountId = false,
    string? Description = null,
    bool? IsActive = null,
    NormalBalance? NormalBalance = null,
    Guid? DepartmentId = null,
    bool ClearDepartmentId = false,
    bool? IsSubledgerControl = null
) : ICommand<ChartOfAccountDto>;

public record ListChartOfAccountsQuery(
    string? SearchTerm = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 50
) : IQuery<ListChartOfAccountsResult>;

public record ListChartOfAccountsResult(
    IReadOnlyList<ChartOfAccountDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
