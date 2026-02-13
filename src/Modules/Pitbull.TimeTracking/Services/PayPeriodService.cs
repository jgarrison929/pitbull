using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Implementation of pay period calculations and management.
/// Replaces MediatR-based handlers with direct service methods.
/// </summary>
public class PayPeriodService(PitbullDbContext db, ITenantContext tenantContext) : IPayPeriodService
{
    // ============ Calculation Methods ============

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
        
        // Get the period containing fromDate
        var (currentStart, currentEnd) = CalculatePeriodBoundaries(fromDate, config);
        periods.Add((currentStart, currentEnd));

        // Generate future periods
        for (int i = 0; i < periodsAhead; i++)
        {
            var nextDate = currentEnd.AddDays(1);
            var (nextStart, nextEnd) = CalculatePeriodBoundaries(nextDate, config);
            periods.Add((nextStart, nextEnd));
            currentEnd = nextEnd;
        }

        return periods;
    }

    // ============ Query Methods ============

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
        // Check if enforcement is enabled for this tenant
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        // If no config or enforcement disabled, allow the entry
        if (config == null || !config.EnforcementEnabled)
            return null;

        // Check if date falls in a locked period
        var period = await GetPayPeriodForDateAsync(date, cancellationToken);
        
        if (period != null && period.IsLocked)
        {
            return $"Time entries cannot be modified for locked pay period ({period.StartDate:MMM d} - {period.EndDate:MMM d, yyyy})";
        }

        return null;
    }

    public async Task<Result<PagedResult<PayPeriodDto>>> ListPayPeriodsAsync(
        PayPeriodStatus? status,
        DateOnly? startDateFrom,
        DateOnly? startDateTo,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = db.Set<PayPeriod>()
            .Include(p => p.LockedBy)
            .Include(p => p.ProcessedBy)
            .AsQueryable();

        // Apply filters
        if (status.HasValue)
            query = query.Where(p => p.Status == status.Value);

        if (startDateFrom.HasValue)
            query = query.Where(p => p.StartDate >= startDateFrom.Value);

        if (startDateTo.HasValue)
            query = query.Where(p => p.StartDate <= startDateTo.Value);

        // Order by start date descending (most recent first)
        query = query.OrderByDescending(p => p.StartDate);

        // Get total count
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply pagination
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(PayPeriodMapper.ToDto).ToList();

        return Result.Success(new PagedResult<PayPeriodDto>(
            dtos,
            totalCount,
            page,
            pageSize));
    }

    public async Task<Result<PayPeriodDto>> GetCurrentPayPeriodAsync(
        DateOnly? date = null,
        CancellationToken cancellationToken = default)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // Try to find an existing pay period for this date
        var period = await db.Set<PayPeriod>()
            .Include(p => p.LockedBy)
            .Include(p => p.ProcessedBy)
            .Where(p => p.StartDate <= targetDate && p.EndDate >= targetDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (period != null)
        {
            return Result.Success(PayPeriodMapper.ToDto(period));
        }

        // If no period exists, calculate what it would be based on config
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            // Return a default weekly period if no config exists
            var (start, end) = CalculateDefaultWeeklyPeriod(targetDate);
            return Result.Success(new PayPeriodDto
            {
                Id = Guid.Empty, // Indicates not yet created
                StartDate = start,
                EndDate = end,
                Status = PayPeriodStatus.Open,
                CreatedAt = DateTime.UtcNow
            });
        }

        // Calculate period boundaries based on configuration
        var (startDate, endDate) = CalculatePeriodBoundaries(targetDate, config);

        return Result.Success(new PayPeriodDto
        {
            Id = Guid.Empty, // Indicates not yet created
            StartDate = startDate,
            EndDate = endDate,
            Status = PayPeriodStatus.Open,
            CreatedAt = DateTime.UtcNow
        });
    }

    public async Task<Result<PayPeriodConfigurationDto>> GetConfigurationAsync(
        CancellationToken cancellationToken = default)
    {
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            // Return default configuration if none exists
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

    // ============ Command Methods ============

    public async Task<Result<PayPeriodDto>> LockPayPeriodAsync(
        Guid payPeriodId,
        Guid lockedById,
        string? notes = null,
        CancellationToken cancellationToken = default)
    {
        var period = await db.Set<PayPeriod>()
            .Include(p => p.LockedBy)
            .FirstOrDefaultAsync(p => p.Id == payPeriodId, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status == PayPeriodStatus.Locked)
            return Result.Failure<PayPeriodDto>("Pay period is already locked", "ALREADY_LOCKED");

        if (period.Status == PayPeriodStatus.Processed)
            return Result.Failure<PayPeriodDto>("Pay period has been processed and cannot be locked again", "ALREADY_PROCESSED");

        // Verify the locker exists
        var locker = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == lockedById && e.IsActive, cancellationToken);

        if (locker == null)
            return Result.Failure<PayPeriodDto>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        // Lock the period
        period.Status = PayPeriodStatus.Locked;
        period.LockedAt = DateTime.UtcNow;
        period.LockedById = lockedById;
        period.Notes = notes;
        period.LockedBy = locker;

        // Create audit log
        var auditLog = AuditLog.Create(
            tenantId: period.TenantId,
            userId: lockedById,
            userEmail: locker.Email,
            userName: $"{locker.FirstName} {locker.LastName}",
            action: AuditAction.StatusChange,
            resourceType: "PayPeriod",
            resourceId: period.Id.ToString(),
            description: $"Pay period {period.StartDate:MMM d} - {period.EndDate:MMM d, yyyy} locked by {locker.FirstName} {locker.LastName}"
        );
        db.Set<AuditLog>().Add(auditLog);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
    }

    public async Task<Result<PayPeriodDto>> UnlockPayPeriodAsync(
        Guid payPeriodId,
        Guid unlockedById,
        string reason,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            return Result.Failure<PayPeriodDto>("Reason is required to unlock a pay period", "REASON_REQUIRED");

        var period = await db.Set<PayPeriod>()
            .Include(p => p.LockedBy)
            .FirstOrDefaultAsync(p => p.Id == payPeriodId, cancellationToken);

        if (period == null)
            return Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND");

        if (period.Status == PayPeriodStatus.Open)
            return Result.Failure<PayPeriodDto>("Pay period is already open", "ALREADY_OPEN");

        // Verify the unlocker exists
        var unlocker = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == unlockedById && e.IsActive, cancellationToken);

        if (unlocker == null)
            return Result.Failure<PayPeriodDto>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        var previousStatus = period.Status;

        // Unlock the period
        period.Status = PayPeriodStatus.Open;
        period.Notes = $"Unlocked by {unlocker.FirstName} {unlocker.LastName}: {reason}";

        // Create audit log (important for compliance)
        var auditLog = AuditLog.Create(
            tenantId: period.TenantId,
            userId: unlockedById,
            userEmail: unlocker.Email,
            userName: $"{unlocker.FirstName} {unlocker.LastName}",
            action: AuditAction.StatusChange,
            resourceType: "PayPeriod",
            resourceId: period.Id.ToString(),
            description: $"Pay period {period.StartDate:MMM d} - {period.EndDate:MMM d, yyyy} unlocked from {previousStatus} status. Reason: {reason}"
        );
        db.Set<AuditLog>().Add(auditLog);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(PayPeriodMapper.ToDto(period));
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
        // Validation
        if (semiMonthlyFirstDay < 1 || semiMonthlyFirstDay > 28)
            return Result.Failure<PayPeriodConfigurationDto>("Semi-monthly first day must be between 1 and 28", "VALIDATION_ERROR");

        if (semiMonthlySecondDay < 2 || semiMonthlySecondDay > 31)
            return Result.Failure<PayPeriodConfigurationDto>("Semi-monthly second day must be between 2 and 31", "VALIDATION_ERROR");

        if (semiMonthlySecondDay <= semiMonthlyFirstDay)
            return Result.Failure<PayPeriodConfigurationDto>("Semi-monthly second day must be greater than first day", "VALIDATION_ERROR");

        if (autoLockDaysAfterEnd < 0 || autoLockDaysAfterEnd > 30)
            return Result.Failure<PayPeriodConfigurationDto>("Auto-lock days must be between 0 and 30", "VALIDATION_ERROR");

        if (periodsToGenerateAhead < 1 || periodsToGenerateAhead > 12)
            return Result.Failure<PayPeriodConfigurationDto>("Periods to generate ahead must be between 1 and 12", "VALIDATION_ERROR");

        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            // Create new configuration
            config = new PayPeriodConfiguration
            {
                TenantId = tenantContext.TenantId
            };
            db.Set<PayPeriodConfiguration>().Add(config);
        }

        // Update configuration
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
        // Get configuration
        var config = await db.Set<PayPeriodConfiguration>()
            .FirstOrDefaultAsync(cancellationToken);

        if (config == null)
        {
            return Result.Failure<GeneratePayPeriodsResult>(
                "Pay period configuration not found. Please configure pay periods first.",
                "CONFIG_NOT_FOUND");
        }

        var effectiveFromDate = fromDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var effectivePeriodsToGenerate = periodsToGenerate ?? config.PeriodsToGenerateAhead;

        // Generate period boundaries
        var periodsToCreate = GenerateFuturePeriods(config, effectiveFromDate, effectivePeriodsToGenerate);

        // Get existing periods to avoid duplicates
        var existingPeriodStarts = await db.Set<PayPeriod>()
            .Select(p => p.StartDate)
            .ToListAsync(cancellationToken);

        var existingStartDates = existingPeriodStarts.ToHashSet();

        var createdPeriods = new List<PayPeriod>();
        var skippedCount = 0;

        foreach (var (startDate, endDate) in periodsToCreate)
        {
            if (existingStartDates.Contains(startDate))
            {
                skippedCount++;
                continue;
            }

            var period = new PayPeriod
            {
                TenantId = tenantContext.TenantId,
                StartDate = startDate,
                EndDate = endDate,
                Status = PayPeriodStatus.Open
            };

            db.Set<PayPeriod>().Add(period);
            createdPeriods.Add(period);
            existingStartDates.Add(startDate);
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(new GeneratePayPeriodsResult(
            createdPeriods.Count,
            skippedCount,
            createdPeriods.Select(PayPeriodMapper.ToDto).ToList()
        ));
    }

    // ============ Private Helper Methods ============

    private static (DateOnly Start, DateOnly End) CalculateDefaultWeeklyPeriod(DateOnly date)
    {
        // Default to Sunday-Saturday week
        var daysToSubtract = ((int)date.DayOfWeek - (int)DayOfWeek.Sunday + 7) % 7;
        var start = date.AddDays(-daysToSubtract);
        var end = start.AddDays(6);
        return (start, end);
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateWeeklyPeriod(DateOnly date, DayOfWeek weekStartDay)
    {
        // Find the start of the week
        var daysToSubtract = ((int)date.DayOfWeek - (int)weekStartDay + 7) % 7;
        var startDate = date.AddDays(-daysToSubtract);
        var endDate = startDate.AddDays(6);
        
        return (startDate, endDate);
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateBiWeeklyPeriod(
        DateOnly date, 
        DayOfWeek weekStartDay, 
        DateOnly? referenceDate)
    {
        // Use reference date or default to a known Sunday (Jan 1, 2024 was a Monday, so use Dec 31, 2023)
        var reference = referenceDate ?? new DateOnly(2023, 12, 31);
        
        // Adjust reference to start on the correct weekStartDay
        var refDaysToSubtract = ((int)reference.DayOfWeek - (int)weekStartDay + 7) % 7;
        reference = reference.AddDays(-refDaysToSubtract);
        
        // Calculate days since reference
        var daysSinceReference = date.DayNumber - reference.DayNumber;
        
        // Find which bi-weekly period we're in
        var periodNumber = daysSinceReference / 14;
        if (daysSinceReference < 0)
            periodNumber--; // Adjust for dates before reference
            
        var startDate = reference.AddDays(periodNumber * 14);
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
        
        // Ensure days are valid (handle month-end scenarios)
        var daysInMonth = DateTime.DaysInMonth(year, month);
        var actualSecondDay = Math.Min(secondDay, daysInMonth);
        var firstEndDay = actualSecondDay - 1;
        
        if (day < actualSecondDay)
        {
            // First half of month
            var startDate = new DateOnly(year, month, firstDay);
            var endDate = new DateOnly(year, month, firstEndDay);
            return (startDate, endDate);
        }
        else
        {
            // Second half of month
            var startDate = new DateOnly(year, month, actualSecondDay);
            var endDate = new DateOnly(year, month, daysInMonth);
            return (startDate, endDate);
        }
    }

    private static (DateOnly StartDate, DateOnly EndDate) CalculateMonthlyPeriod(DateOnly date)
    {
        var startDate = new DateOnly(date.Year, date.Month, 1);
        var daysInMonth = DateTime.DaysInMonth(date.Year, date.Month);
        var endDate = new DateOnly(date.Year, date.Month, daysInMonth);
        
        return (startDate, endDate);
    }
}
