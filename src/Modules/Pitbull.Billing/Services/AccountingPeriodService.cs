using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.AccountingPeriods;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class AccountingPeriodService(PitbullDbContext db, ILogger<AccountingPeriodService> logger) : IAccountingPeriodService
{
    public async Task<Result<ListAccountingPeriodsResult>> GetPeriodsAsync(ListAccountingPeriodsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<AccountingPeriod> dbQuery = db.Set<AccountingPeriod>().AsNoTracking();

        if (query.FiscalYear.HasValue)
            dbQuery = dbQuery.Where(p => p.FiscalYear == query.FiscalYear.Value);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(p => p.Status == query.Status.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<AccountingPeriod> items = await dbQuery
            .OrderByDescending(p => p.FiscalYear)
            .ThenBy(p => p.PeriodNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListAccountingPeriodsResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<AccountingPeriodDto>> GetPeriodAsync(Guid id, CancellationToken cancellationToken = default)
    {
        AccountingPeriod? period = await db.Set<AccountingPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (period is null)
            return Result.Failure<AccountingPeriodDto>("Accounting period not found", "NOT_FOUND");

        return Result.Success(MapToDto(period));
    }

    public async Task<Result<AccountingPeriodDto>> CreatePeriodAsync(CreateAccountingPeriodCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.PeriodName))
            return Result.Failure<AccountingPeriodDto>("Period name is required", "VALIDATION_ERROR");

        if (command.EndDate < command.StartDate)
            return Result.Failure<AccountingPeriodDto>("End date must be on or after start date", "VALIDATION_ERROR");

        bool duplicate = await db.Set<AccountingPeriod>()
            .AnyAsync(p => p.FiscalYear == command.FiscalYear && p.PeriodNumber == command.PeriodNumber, cancellationToken);

        if (duplicate)
            return Result.Failure<AccountingPeriodDto>(
                $"Period {command.PeriodNumber} already exists for fiscal year {command.FiscalYear}", "DUPLICATE_PERIOD");

        AccountingPeriod period = new()
        {
            PeriodNumber = command.PeriodNumber,
            FiscalYear = command.FiscalYear,
            PeriodName = command.PeriodName.Trim(),
            StartDate = command.StartDate,
            EndDate = command.EndDate,
            Status = PeriodStatus.Open
        };

        db.Set<AccountingPeriod>().Add(period);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(period));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create accounting period {FiscalYear}-{PeriodNumber}", command.FiscalYear, command.PeriodNumber);
            return Result.Failure<AccountingPeriodDto>("Failed to create accounting period", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeletePeriodAsync(Guid id, CancellationToken cancellationToken = default)
    {
        AccountingPeriod? period = await db.Set<AccountingPeriod>().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (period is null)
            return Result.Failure("Accounting period not found", "NOT_FOUND");

        if (period.Status != PeriodStatus.Open)
            return Result.Failure("Only open periods can be deleted", "INVALID_STATUS");

        db.Set<AccountingPeriod>().Remove(period);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete accounting period {Id}", id);
            return Result.Failure("Failed to delete accounting period", "DATABASE_ERROR");
        }
    }

    public async Task<Result<AccountingPeriodDto>> ClosePeriodAsync(Guid id, Guid closedByUserId, CancellationToken cancellationToken = default)
    {
        AccountingPeriod? period = await db.Set<AccountingPeriod>().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (period is null)
            return Result.Failure<AccountingPeriodDto>("Accounting period not found", "NOT_FOUND");

        if (period.Status == PeriodStatus.HardClosed)
            return Result.Failure<AccountingPeriodDto>("Period is already closed", "INVALID_STATUS");

        period.Status = PeriodStatus.HardClosed;
        period.ClosedByUserId = closedByUserId;
        period.ClosedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(period));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<AccountingPeriodDto>("Period was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to close accounting period {Id}", id);
            return Result.Failure<AccountingPeriodDto>("Failed to close accounting period", "DATABASE_ERROR");
        }
    }

    public async Task<Result<AccountingPeriodDto>> ReopenPeriodAsync(Guid id, string reason, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            return Result.Failure<AccountingPeriodDto>("Reason is required to reopen a period", "VALIDATION_ERROR");

        AccountingPeriod? period = await db.Set<AccountingPeriod>().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (period is null)
            return Result.Failure<AccountingPeriodDto>("Accounting period not found", "NOT_FOUND");

        if (period.Status != PeriodStatus.HardClosed)
            return Result.Failure<AccountingPeriodDto>("Only closed periods can be reopened", "INVALID_STATUS");

        period.Status = PeriodStatus.Open;
        period.ReopenedCount++;
        period.LastReopenedAt = DateTime.UtcNow;
        period.LastReopenReason = reason.Trim();

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(period));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<AccountingPeriodDto>("Period was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to reopen accounting period {Id}", id);
            return Result.Failure<AccountingPeriodDto>("Failed to reopen accounting period", "DATABASE_ERROR");
        }
    }

    public async Task<Result<List<AccountingPeriodDto>>> SeedFiscalYearAsync(int fiscalYear, CancellationToken cancellationToken = default)
    {
        bool exists = await db.Set<AccountingPeriod>()
            .AnyAsync(p => p.FiscalYear == fiscalYear, cancellationToken);

        if (exists)
            return Result.Failure<List<AccountingPeriodDto>>($"Periods already exist for fiscal year {fiscalYear}", "DUPLICATE_PERIOD");

        List<AccountingPeriod> periods = [];
        for (int month = 1; month <= 12; month++)
        {
            var startDate = new DateOnly(fiscalYear, month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);

            periods.Add(new AccountingPeriod
            {
                PeriodNumber = month,
                FiscalYear = fiscalYear,
                PeriodName = startDate.ToString("MMMM yyyy"),
                StartDate = startDate,
                EndDate = endDate,
                Status = PeriodStatus.Open
            });
        }

        db.Set<AccountingPeriod>().AddRange(periods);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(periods.Select(MapToDto).ToList());
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to seed fiscal year {FiscalYear}", fiscalYear);
            return Result.Failure<List<AccountingPeriodDto>>("Failed to seed fiscal year", "DATABASE_ERROR");
        }
    }

    private static AccountingPeriodDto MapToDto(AccountingPeriod period)
    {
        return new AccountingPeriodDto(
            Id: period.Id,
            PeriodNumber: period.PeriodNumber,
            FiscalYear: period.FiscalYear,
            PeriodName: period.PeriodName,
            StartDate: period.StartDate,
            EndDate: period.EndDate,
            Status: period.Status,
            ClosedByUserId: period.ClosedByUserId,
            ClosedAt: period.ClosedAt,
            ReopenedCount: period.ReopenedCount,
            LastReopenedAt: period.LastReopenedAt,
            LastReopenReason: period.LastReopenReason,
            CreatedAt: period.CreatedAt,
            UpdatedAt: period.UpdatedAt);
    }
}
