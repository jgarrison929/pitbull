using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Features.ChartOfAccounts;

public class ChartOfAccountService(PitbullDbContext db, ILogger<ChartOfAccountService> logger) : IChartOfAccountService
{
    public async Task<Result<ChartOfAccountDto>> GetChartOfAccountAsync(Guid id, CancellationToken cancellationToken = default)
    {
        ChartOfAccount? account = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (account is null)
            return Result.Failure<ChartOfAccountDto>("Chart of account not found", "NOT_FOUND");

        return Result.Success(MapToDto(account));
    }

    public async Task<Result<ListChartOfAccountsResult>> ListChartOfAccountsAsync(
        ListChartOfAccountsQuery query,
        CancellationToken cancellationToken = default)
    {
        IQueryable<ChartOfAccount> dbQuery = db.Set<ChartOfAccount>()
            .AsNoTracking()
            .AsQueryable();

        if (query.IsActive.HasValue)
            dbQuery = dbQuery.Where(a => a.IsActive == query.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            string search = query.SearchTerm.Trim().ToLower();
            dbQuery = dbQuery.Where(a =>
                a.AccountNumber.ToLower().Contains(search) ||
                a.AccountName.ToLower().Contains(search) ||
                (a.Description != null && a.Description.ToLower().Contains(search)));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 50 : query.PageSize;

        List<ChartOfAccount> accounts = await dbQuery
            .OrderBy(a => a.AccountNumber)
            .ThenBy(a => a.AccountName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListChartOfAccountsResult(
            Items: accounts.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<ChartOfAccountDto>> CreateChartOfAccountAsync(
        CreateChartOfAccountCommand command,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.AccountNumber) || string.IsNullOrWhiteSpace(command.AccountName))
            return Result.Failure<ChartOfAccountDto>("Account number and account name are required", "VALIDATION_ERROR");

        string normalizedNumber = command.AccountNumber.Trim();

        bool duplicate = await db.Set<ChartOfAccount>()
            .AnyAsync(a => a.AccountNumber == normalizedNumber, cancellationToken);

        if (duplicate)
            return Result.Failure<ChartOfAccountDto>($"Account number '{normalizedNumber}' already exists", "DUPLICATE_ACCOUNT_NUMBER");

        if (command.ParentAccountId.HasValue)
        {
            bool parentExists = await db.Set<ChartOfAccount>()
                .AnyAsync(a => a.Id == command.ParentAccountId.Value, cancellationToken);

            if (!parentExists)
                return Result.Failure<ChartOfAccountDto>("Parent account not found", "PARENT_NOT_FOUND");
        }

        ChartOfAccount account = new()
        {
            AccountNumber = normalizedNumber,
            AccountName = command.AccountName.Trim(),
            AccountType = command.AccountType,
            ParentAccountId = command.ParentAccountId,
            Description = command.Description?.Trim(),
            IsActive = command.IsActive,
            NormalBalance = command.NormalBalance ?? GetDefaultNormalBalance(command.AccountType),
            DepartmentId = command.DepartmentId,
            IsSubledgerControl = command.IsSubledgerControl
        };

        db.Set<ChartOfAccount>().Add(account);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(account));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create chart of account {AccountNumber}", command.AccountNumber);
            return Result.Failure<ChartOfAccountDto>("Failed to create chart of account", "DATABASE_ERROR");
        }
    }

    public async Task<Result<ChartOfAccountDto>> UpdateChartOfAccountAsync(
        UpdateChartOfAccountCommand command,
        CancellationToken cancellationToken = default)
    {
        ChartOfAccount? account = await db.Set<ChartOfAccount>()
            .FirstOrDefaultAsync(a => a.Id == command.ChartOfAccountId, cancellationToken);

        if (account is null)
            return Result.Failure<ChartOfAccountDto>("Chart of account not found", "NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(command.AccountNumber))
        {
            string normalizedNumber = command.AccountNumber.Trim();
            if (!string.Equals(account.AccountNumber, normalizedNumber, StringComparison.OrdinalIgnoreCase))
            {
                bool duplicate = await db.Set<ChartOfAccount>()
                    .AnyAsync(a => a.Id != command.ChartOfAccountId && a.AccountNumber == normalizedNumber, cancellationToken);

                if (duplicate)
                    return Result.Failure<ChartOfAccountDto>($"Account number '{normalizedNumber}' already exists", "DUPLICATE_ACCOUNT_NUMBER");

                account.AccountNumber = normalizedNumber;
            }
        }

        if (!string.IsNullOrWhiteSpace(command.AccountName))
            account.AccountName = command.AccountName.Trim();

        if (command.AccountType.HasValue)
            account.AccountType = command.AccountType.Value;

        Guid? targetParentId = command.ClearParentAccountId
            ? null
            : command.ParentAccountId ?? account.ParentAccountId;

        if (targetParentId == account.Id)
            return Result.Failure<ChartOfAccountDto>("Account cannot be its own parent", "INVALID_PARENT");

        if (targetParentId.HasValue)
        {
            bool parentExists = await db.Set<ChartOfAccount>()
                .AnyAsync(a => a.Id == targetParentId.Value, cancellationToken);

            if (!parentExists)
                return Result.Failure<ChartOfAccountDto>("Parent account not found", "PARENT_NOT_FOUND");

            bool createsCycle = await WouldCreateCycleAsync(account.Id, targetParentId.Value, cancellationToken);
            if (createsCycle)
                return Result.Failure<ChartOfAccountDto>("Parent account would create a hierarchy cycle", "INVALID_PARENT");
        }

        account.ParentAccountId = targetParentId;

        if (command.Description != null)
            account.Description = string.IsNullOrWhiteSpace(command.Description) ? null : command.Description.Trim();

        if (command.IsActive.HasValue)
            account.IsActive = command.IsActive.Value;

        if (command.NormalBalance.HasValue)
            account.NormalBalance = command.NormalBalance.Value;
        else if (command.AccountType.HasValue)
            account.NormalBalance = GetDefaultNormalBalance(command.AccountType.Value);

        if (command.ClearDepartmentId)
            account.DepartmentId = null;
        else if (command.DepartmentId.HasValue)
            account.DepartmentId = command.DepartmentId;

        if (command.IsSubledgerControl.HasValue)
            account.IsSubledgerControl = command.IsSubledgerControl.Value;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(account));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<ChartOfAccountDto>("Chart of account was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update chart of account {ChartOfAccountId}", command.ChartOfAccountId);
            return Result.Failure<ChartOfAccountDto>("Failed to update chart of account", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteChartOfAccountAsync(Guid id, CancellationToken cancellationToken = default)
    {
        ChartOfAccount? account = await db.Set<ChartOfAccount>()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (account is null)
            return Result.Failure("Chart of account not found", "NOT_FOUND");

        bool hasChildren = await db.Set<ChartOfAccount>()
            .AnyAsync(a => a.ParentAccountId == id, cancellationToken);

        if (hasChildren)
            return Result.Failure("Cannot delete an account with child accounts", "HAS_CHILDREN");

        db.Set<ChartOfAccount>().Remove(account);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete chart of account {ChartOfAccountId}", id);
            return Result.Failure("Failed to delete chart of account", "DATABASE_ERROR");
        }
    }

    public async Task<Result<IReadOnlyList<ChartOfAccountTreeNodeDto>>> GetTreeAsync(CancellationToken cancellationToken = default)
    {
        List<ChartOfAccount> accounts = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .OrderBy(a => a.AccountNumber)
            .ThenBy(a => a.AccountName)
            .ToListAsync(cancellationToken);

        List<ChartOfAccountTreeNodeDto> tree = BuildTree(accounts);
        return Result.Success<IReadOnlyList<ChartOfAccountTreeNodeDto>>(tree);
    }

    private static ChartOfAccountDto MapToDto(ChartOfAccount account)
    {
        return new ChartOfAccountDto(
            Id: account.Id,
            AccountNumber: account.AccountNumber,
            AccountName: account.AccountName,
            AccountType: account.AccountType,
            AccountTypeName: account.AccountType.ToString(),
            ParentAccountId: account.ParentAccountId,
            Description: account.Description,
            IsActive: account.IsActive,
            NormalBalance: account.NormalBalance,
            NormalBalanceName: account.NormalBalance.ToString(),
            DepartmentId: account.DepartmentId,
            IsSubledgerControl: account.IsSubledgerControl,
            CreatedAt: account.CreatedAt,
            UpdatedAt: account.UpdatedAt);
    }

    private static List<ChartOfAccountTreeNodeDto> BuildTree(IReadOnlyList<ChartOfAccount> accounts)
    {
        Dictionary<Guid, List<ChartOfAccount>> childrenByParent = accounts
            .Where(a => a.ParentAccountId.HasValue)
            .GroupBy(a => a.ParentAccountId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderBy(a => a.AccountNumber).ThenBy(a => a.AccountName).ToList());

        List<ChartOfAccount> roots = accounts
            .Where(a => !a.ParentAccountId.HasValue)
            .OrderBy(a => a.AccountNumber)
            .ThenBy(a => a.AccountName)
            .ToList();

        return roots.Select(root => MapToTreeNode(root, childrenByParent)).ToList();
    }

    private static ChartOfAccountTreeNodeDto MapToTreeNode(
        ChartOfAccount account,
        IReadOnlyDictionary<Guid, List<ChartOfAccount>> childrenByParent)
    {
        List<ChartOfAccountTreeNodeDto> children = childrenByParent.TryGetValue(account.Id, out List<ChartOfAccount>? childList)
            ? childList.Select(child => MapToTreeNode(child, childrenByParent)).ToList()
            : [];

        return new ChartOfAccountTreeNodeDto(
            Id: account.Id,
            AccountNumber: account.AccountNumber,
            AccountName: account.AccountName,
            AccountType: account.AccountType,
            AccountTypeName: account.AccountType.ToString(),
            ParentAccountId: account.ParentAccountId,
            Description: account.Description,
            IsActive: account.IsActive,
            NormalBalance: account.NormalBalance,
            NormalBalanceName: account.NormalBalance.ToString(),
            DepartmentId: account.DepartmentId,
            IsSubledgerControl: account.IsSubledgerControl,
            Children: children);
    }

    private async Task<bool> WouldCreateCycleAsync(Guid accountId, Guid targetParentId, CancellationToken cancellationToken)
    {
        Guid? cursor = targetParentId;

        while (cursor.HasValue)
        {
            if (cursor.Value == accountId)
                return true;

            cursor = await db.Set<ChartOfAccount>()
                .Where(a => a.Id == cursor.Value)
                .Select(a => a.ParentAccountId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return false;
    }

    private static NormalBalance GetDefaultNormalBalance(AccountType accountType)
    {
        return accountType switch
        {
            AccountType.Asset => NormalBalance.Debit,
            AccountType.Expense => NormalBalance.Debit,
            AccountType.Liability => NormalBalance.Credit,
            AccountType.Equity => NormalBalance.Credit,
            AccountType.Revenue => NormalBalance.Credit,
            _ => NormalBalance.Debit
        };
    }
}
