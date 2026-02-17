using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Pay period operations including period lifecycle and configuration-based generation.
/// </summary>
public class PayPeriodService(PitbullDbContext db, ITenantContext tenantContext) : IPayPeriodService
{
    public (DateOnly StartDate, DateOnly EndDate) CalculatePeriodBoundaries(DateOnly date, PayPeriodConfiguration config)
    {
        return config.Type switch
        {
            PayPeriodType.Weekly => CalculateWeeklyPeriod(date, config.WeekStartDay),
            PayPeriodType.BiWeekly => CalculateBiWeeklyPeriod(date, config.WeekStartDay, config.BiWeeklyReferenceDate),
            PayPeriodType.SemiMonthly => CalculateSemiMonthlyPeriod(date, config.SemiMonthlyFirstDay, config.SemiMonthlySecondDay),
            PayPeriodType.Monthly => CalculateMonthlyPeriod(date),
            _ => throw new ArgumentOutOfRangeException(nameof(config.Type), config.Type, "Unknown pay period type")
        };
    }

    public List<(DateOnly StartDate, DateOnly EndDate)> GenerateFuturePeriods(
        PayPeriodConfiguration config,
        DateOnly fromDate,
        int periodsAhead)
    {
        var periods = new List<(DateOnly StartDate, DateOnly EndDate)>();
        var (currentStart, currentEnd) = CalculatePeriodBoundaries(fromDate, config);
        periods.Add((currentStart, currentEnd));

        for (var i = 0; i < periodsAhead; i++)
        {
            var nextDate = currentEnd.AddDays(1);
            var (nextStart, nextEnd) = CalculatePeriodBoundaries(nextDate, config);
            periods.Add((nextStart, nextEnd));
            currentEnd = nextEnd;
        }

        return periods;
    }

    public async Task<bool> IsDateInLockedPeriodAsync(DateOnly date, CancellationToken cancellationToken = default)
    {
        var period = await GetPayPeriodForDateAsync(date, cancellationToken);
        return period?.IsLocked ?? false;
    }

    public async Task<PayPeriod?> GetPayPeriodForDateAsync(DateOnly date, CancellationToken cancellationToken = default)
    {
        return await db.Set<PayPeriod>()
            .Where(p => p.StartDate <= date && p.EndDate >= date)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<string?> ValidateTimeEntryDateAsync(DateOnly date, CancellationToken cancellationToken = default)
    {
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null || !config.EnforcementEnabled)
            return null;

        var period = await GetPayPeriodForDateAsync(date, cancellationToken);

        if (period != null && period.IsLocked)
        {
            return $"Time entries cannot be modified for locked pay period ({period.Name})";
        }

        return null;
    }

    public async Task<Result<PagedResult<PayPeriodDto>>> ListPayPeriodsAsync(
        PayPeriodStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = db.Set<PayPeriod>().AsNoTracking().AsQueryable();

        if (status.HasValue)
            query = query.Where(p => p.Status == status.Value);

        query = query.OrderByDescending(p => p.StartDate);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<PayPeriodDto>(
            items.Select(PayPeriodMapper.ToDto).ToList(),
            totalCount,
            page,
            pageSize));
    }

    public async Task<Result<PayPeriodDto>> GetPayPeriodAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var period = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        return Result.Success(PayPeriodMapper.ToDto(period));
    }

    public async Task<Result<PayPeriodSummaryDto>> GetPayPeriodSummaryAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var period = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodSummaryDto>("Pay period not found", "NOT_FOUND");

        var entries = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.Date >= period.StartDate && te.Date <= period.EndDate && !te.IsDeleted)
            .ToListAsync(cancellationToken);

        var byStatus = entries
            .GroupBy(te => te.Status)
            .Select(g => new PayPeriodStatusBreakdownDto(
                g.Key,
                g.Count(),
                g.Sum(x => x.TotalHours)))
            .OrderBy(x => (int)x.Status)
            .ToList();

        var summary = new PayPeriodSummaryDto
        {
            PayPeriodId = period.Id,
            PayPeriodName = period.Name,
            StartDate = period.StartDate,
            EndDate = period.EndDate,
            TotalHours = entries.Sum(te => te.TotalHours),
            EmployeeCount = entries.Select(te => te.EmployeeId).Distinct().Count(),
            EntryCount = entries.Count,
            ByStatus = byStatus,
        };

        return Result.Success(summary);
    }

    public async Task<Result<PayPeriodDto>> CreatePayPeriodAsync(
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken = default)
    {
        if (endDate < startDate)
            return Result.Failure<PayPeriodDto>("End date must be on or after start date", "VALIDATION_ERROR");

        var hasOverlap = await HasOverlapAsync(startDate, endDate, null, cancellationToken);
        if (hasOverlap)
            return Result.Failure<PayPeriodDto>("Pay period overlaps an existing period", "OVERLAP");

        var period = new PayPeriod
        {
            TenantId = tenantContext.TenantId,
            StartDate = startDate,
            EndDate = endDate,
            Status = PayPeriodStatus.Open,
            Name = GeneratePeriodName(startDate, endDate),
        };

        db.Set<PayPeriod>().Add(period);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }

    public async Task<Result<PayPeriodDto>> UpdatePayPeriodAsync(
        Guid payPeriodId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken = default)
    {
        if (endDate < startDate)
            return Result.Failure<PayPeriodDto>("End date must be on or after start date", "VALIDATION_ERROR");

        var period = await db.Set<PayPeriod>()
            .FirstOrDefaultAsync(p => p.Id == payPeriodId, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status != PayPeriodStatus.Open)
            return Result.Failure<PayPeriodDto>("Only open pay periods can be updated", "INVALID_STATUS");

        var hasOverlap = await HasOverlapAsync(startDate, endDate, payPeriodId, cancellationToken);
        if (hasOverlap)
            return Result.Failure<PayPeriodDto>("Pay period overlaps an existing period", "OVERLAP");

        period.StartDate = startDate;
        period.EndDate = endDate;
        period.Name = GeneratePeriodName(startDate, endDate);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }

    public async Task<Result<PayPeriodDto>> LockPayPeriodAsync(
        Guid payPeriodId,
        Guid lockedById,
        CancellationToken cancellationToken = default)
    {
        var period = await db.Set<PayPeriod>()
            .FirstOrDefaultAsync(p => p.Id == payPeriodId, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status == PayPeriodStatus.Locked)
            return Result.Failure<PayPeriodDto>("Pay period is already locked", "INVALID_STATUS");

        if (period.Status == PayPeriodStatus.Closed)
            return Result.Failure<PayPeriodDto>("Closed pay periods cannot be locked", "INVALID_STATUS");

        period.Status = PayPeriodStatus.Locked;
        period.LockedAt = DateTime.UtcNow;
        period.LockedById = lockedById;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }

    public async Task<Result<PayPeriodDto>> UnlockPayPeriodAsync(
        Guid payPeriodId,
        Guid unlockedById,
        CancellationToken cancellationToken = default)
    {
        var period = await db.Set<PayPeriod>()
            .FirstOrDefaultAsync(p => p.Id == payPeriodId, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status == PayPeriodStatus.Open)
            return Result.Failure<PayPeriodDto>("Pay period is already open", "INVALID_STATUS");

        if (period.Status == PayPeriodStatus.Closed)
            return Result.Failure<PayPeriodDto>("Closed pay periods cannot be unlocked", "INVALID_STATUS");

        period.Status = PayPeriodStatus.Open;
        period.UpdatedBy = unlockedById.ToString();

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }

    public async Task<Result<PayPeriodDto>> ClosePayPeriodAsync(
        Guid payPeriodId,
        Guid closedById,
        CancellationToken cancellationToken = default)
    {
        var period = await db.Set<PayPeriod>()
            .FirstOrDefaultAsync(p => p.Id == payPeriodId, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status == PayPeriodStatus.Closed)
            return Result.Failure<PayPeriodDto>("Pay period is already closed", "INVALID_STATUS");

        if (period.Status != PayPeriodStatus.Locked)
            return Result.Failure<PayPeriodDto>("Pay period must be locked before closing", "INVALID_STATUS");

        period.Status = PayPeriodStatus.Closed;
        period.PayrollExportMarkedAt = DateTime.UtcNow;
        period.UpdatedBy = closedById.ToString();

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }

    public async Task<Result<PayPeriodConfigurationDto>> GetConfigurationAsync(CancellationToken cancellationToken = default)
    {
        var config = await db.Set<PayPeriodConfiguration>()
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            return Result.Success(new PayPeriodConfigurationDto
            {
                Id = Guid.Empty,
                Type = PayPeriodType.Weekly,
                WeekStartDay = DayOfWeek.Sunday,
                SemiMonthlyFirstDay = 1,
                SemiMonthlySecondDay = 16,
                AutoLockEnabled = false,
                AutoLockDaysAfterEnd = 3,
                PeriodsToGenerateAhead = 4,
                BiWeeklyReferenceDate = null,
                EnforcementEnabled = true
            });
        }

        return Result.Success(PayPeriodMapper.ToDto(config));
    }

    public async Task<Result<PayPeriodConfigurationDto>> UpdateConfigurationAsync(
        PayPeriodType type,
        DayOfWeek weekStartDay,
        int semiMonthlyFirstDay,
        int semiMonthlySecondDay,
        bool autoLockEnabled,
        int autoLockDaysAfterEnd,
        int periodsToGenerateAhead,
        DateOnly? biWeeklyReferenceDate,
        bool enforcementEnabled,
        CancellationToken cancellationToken = default)
    {
        if (semiMonthlyFirstDay < 1 || semiMonthlyFirstDay > 28)
            return Result.Failure<PayPeriodConfigurationDto>("Semi-monthly first day must be between 1 and 28", "VALIDATION_ERROR");

        if (semiMonthlySecondDay < 2 || semiMonthlySecondDay > 31)
            return Result.Failure<PayPeriodConfigurationDto>("Semi-monthly second day must be between 2 and 31", "VALIDATION_ERROR");

        if (semiMonthlySecondDay <= semiMonthlyFirstDay)
            return Result.Failure<PayPeriodConfigurationDto>("Semi-monthly second day must be greater than first day", "VALIDATION_ERROR");

        if (autoLockDaysAfterEnd < 0 || autoLockDaysAfterEnd > 30)
            return Result.Failure<PayPeriodConfigurationDto>("Auto-lock days must be between 0 and 30", "VALIDATION_ERROR");

        if (periodsToGenerateAhead < 1 || periodsToGenerateAhead > 24)
            return Result.Failure<PayPeriodConfigurationDto>("Periods to generate ahead must be between 1 and 24", "VALIDATION_ERROR");

        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            config = new PayPeriodConfiguration
            {
                TenantId = tenantContext.TenantId,
            };
            db.Set<PayPeriodConfiguration>().Add(config);
        }

        config.Type = type;
        config.WeekStartDay = weekStartDay;
        config.SemiMonthlyFirstDay = semiMonthlyFirstDay;
        config.SemiMonthlySecondDay = semiMonthlySecondDay;
        config.AutoLockEnabled = autoLockEnabled;
        config.AutoLockDaysAfterEnd = autoLockDaysAfterEnd;
        config.PeriodsToGenerateAhead = periodsToGenerateAhead;
        config.BiWeeklyReferenceDate = biWeeklyReferenceDate;
        config.EnforcementEnabled = enforcementEnabled;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(config));
    }

    public async Task<Result<GeneratePayPeriodsResult>> GeneratePayPeriodsAsync(
        DateOnly? fromDate = null,
        int? periodsToGenerate = null,
        CancellationToken cancellationToken = default)
    {
        var config = await db.Set<PayPeriodConfiguration>()
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            return Result.Failure<GeneratePayPeriodsResult>(
                "Pay period configuration not found. Please configure pay periods first.",
                "CONFIG_NOT_FOUND");
        }

        var effectiveFromDate = fromDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var effectivePeriodsToGenerate = periodsToGenerate ?? config.PeriodsToGenerateAhead;

        if (effectivePeriodsToGenerate < 1 || effectivePeriodsToGenerate > 100)
        {
            return Result.Failure<GeneratePayPeriodsResult>(
                "Periods to generate must be between 1 and 100.",
                "VALIDATION_ERROR");
        }

        var periodBoundaries = GenerateFuturePeriods(config, effectiveFromDate, effectivePeriodsToGenerate - 1);

        var existingStarts = await db.Set<PayPeriod>()
            .Where(p => periodBoundaries.Select(pb => pb.StartDate).Contains(p.StartDate))
            .Select(p => p.StartDate)
            .ToListAsync(cancellationToken);

        var periodsToCreate = periodBoundaries
            .Where(pb => !existingStarts.Contains(pb.StartDate))
            .ToList();

        var createdPeriods = new List<PayPeriod>();

        foreach (var (startDate, endDate) in periodsToCreate)
        {
            var period = new PayPeriod
            {
                TenantId = tenantContext.TenantId,
                StartDate = startDate,
                EndDate = endDate,
                Status = PayPeriodStatus.Open,
                Name = GeneratePeriodName(startDate, endDate)
            };

            db.Set<PayPeriod>().Add(period);
            createdPeriods.Add(period);
        }

        if (createdPeriods.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        return Result.Success(new GeneratePayPeriodsResult(
            PeriodsCreated: createdPeriods.Count,
            PeriodsSkipped: periodBoundaries.Count - createdPeriods.Count,
            CreatedPeriods: createdPeriods.Select(PayPeriodMapper.ToDto).ToList()));
    }

    private async Task<bool> HasOverlapAsync(
        DateOnly startDate,
        DateOnly endDate,
        Guid? excludingId,
        CancellationToken cancellationToken)
    {
        var query = db.Set<PayPeriod>()
            .Where(p => p.StartDate <= endDate && p.EndDate >= startDate);

        if (excludingId.HasValue)
            query = query.Where(p => p.Id != excludingId.Value);

        return await query.AnyAsync(cancellationToken);
    }

    private static string GeneratePeriodName(DateOnly startDate, DateOnly endDate)
    {
        if (startDate.Year == endDate.Year && startDate.Month == endDate.Month)
            return $"{startDate:MMM d}-{endDate:d, yyyy}";

        if (startDate.Year == endDate.Year)
            return $"{startDate:MMM d}-{endDate:MMM d, yyyy}";

        return $"{startDate:MMM d, yyyy}-{endDate:MMM d, yyyy}";
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateWeeklyPeriod(DateOnly date, DayOfWeek weekStartDay)
    {
        var daysSinceWeekStart = ((int)date.DayOfWeek - (int)weekStartDay + 7) % 7;
        var startDate = date.AddDays(-daysSinceWeekStart);
        var endDate = startDate.AddDays(6);
        return (startDate, endDate);
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateBiWeeklyPeriod(
        DateOnly date,
        DayOfWeek weekStartDay,
        DateOnly? referenceDate)
    {
        var reference = referenceDate ?? new DateOnly(2024, 1, 1);
        var (referenceStart, _) = CalculateWeeklyPeriod(reference, weekStartDay);

        var daysDiff = date.DayNumber - referenceStart.DayNumber;
        var biWeekNumber = Math.Floor(daysDiff / 14.0);
        var startDate = referenceStart.AddDays((int)biWeekNumber * 14);
        var endDate = startDate.AddDays(13);

        return (startDate, endDate);
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateSemiMonthlyPeriod(
        DateOnly date,
        int firstDay,
        int secondDay)
    {
        var year = date.Year;
        var month = date.Month;
        var day = date.Day;

        if (day < secondDay)
        {
            var startDate = new DateOnly(year, month, firstDay);
            var endDate = new DateOnly(year, month, secondDay - 1);
            return (startDate, endDate);
        }

        var daysInMonth = DateTime.DaysInMonth(year, month);
        var secondStartDate = new DateOnly(year, month, secondDay);
        var secondEndDate = new DateOnly(year, month, daysInMonth);
        return (secondStartDate, secondEndDate);
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateMonthlyPeriod(DateOnly date)
    {
        var startDate = new DateOnly(date.Year, date.Month, 1);
        var endDate = new DateOnly(date.Year, date.Month, DateTime.DaysInMonth(date.Year, date.Month));
        return (startDate, endDate);
    }
}
