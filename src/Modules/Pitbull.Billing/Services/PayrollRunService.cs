using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.PayrollRuns;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Billing.Services;

public class PayrollRunService(PitbullDbContext db, ILogger<PayrollRunService> logger) : IPayrollRunService
{
    public async Task<Result<ListPayrollRunsResult>> GetPayrollRunsAsync(ListPayrollRunsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<PayrollRun> dbQuery = db.Set<PayrollRun>()
            .AsNoTracking()
            .Include(x => x.Lines);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(x => x.Status == query.Status.Value);

        if (query.PayPeriodId.HasValue)
            dbQuery = dbQuery.Where(x => x.PayPeriodId == query.PayPeriodId.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<PayrollRun> items = await dbQuery
            .OrderByDescending(x => x.RunDate)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListPayrollRunsResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<PayrollRunDto>> GetPayrollRunAsync(Guid id, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollRunDto>("Payroll run not found", "NOT_FOUND");

        return Result.Success(MapToDto(run));
    }

    public async Task<Result<PayrollRunDto>> CreatePayrollRunAsync(CreatePayrollRunCommand command, CancellationToken cancellationToken = default)
    {
        if (command.PayPeriodId == Guid.Empty)
            return Result.Failure<PayrollRunDto>("Pay period is required", "VALIDATION_ERROR");

        bool duplicateExists = await db.Set<PayrollRun>()
            .AnyAsync(x => x.PayPeriodId == command.PayPeriodId, cancellationToken);

        if (duplicateExists)
            return Result.Failure<PayrollRunDto>("A payroll run already exists for this pay period", "DUPLICATE_PAYROLL_RUN");

        PayrollRun run = new()
        {
            RunDate = command.RunDate,
            PayPeriodId = command.PayPeriodId,
            Status = PayrollRunStatus.Draft,
            TotalGross = 0m,
            TotalNet = 0m,
            EmployeeCount = 0
        };

        db.Set<PayrollRun>().Add(run);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(run));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create payroll run for pay period {PayPeriodId}", command.PayPeriodId);
            return Result.Failure<PayrollRunDto>("Failed to create payroll run", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PayrollRunDto>> UpdatePayrollRunAsync(UpdatePayrollRunCommand command, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == command.PayrollRunId, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollRunDto>("Payroll run not found", "NOT_FOUND");

        if (run.Status != PayrollRunStatus.Draft)
            return Result.Failure<PayrollRunDto>("Only draft payroll runs can be updated", "INVALID_STATUS");

        if (command.RunDate.HasValue)
            run.RunDate = command.RunDate.Value;

        if (command.Status.HasValue)
        {
            if (!IsValidPayrollStatusTransition(run.Status, command.Status.Value))
                return Result.Failure<PayrollRunDto>(
                    $"Cannot transition payroll run from {run.Status} to {command.Status.Value}",
                    "INVALID_STATUS_TRANSITION");
            run.Status = command.Status.Value;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(run));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<PayrollRunDto>("Payroll run was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update payroll run {PayrollRunId}", command.PayrollRunId);
            return Result.Failure<PayrollRunDto>("Failed to update payroll run", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PayrollRunDto>> GeneratePayrollRunAsync(GeneratePayrollRunCommand command, CancellationToken cancellationToken = default)
    {
        PayPeriod? payPeriod = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == command.PayPeriodId, cancellationToken);

        if (payPeriod is null)
            return Result.Failure<PayrollRunDto>("Pay period not found", "PAY_PERIOD_NOT_FOUND");

        if (payPeriod.Status == PayPeriodStatus.Open)
            return Result.Failure<PayrollRunDto>("Pay period must be locked or closed before generating a payroll run", "PAY_PERIOD_NOT_LOCKED");

        bool duplicateExists = await db.Set<PayrollRun>()
            .AnyAsync(x => x.PayPeriodId == command.PayPeriodId, cancellationToken);

        if (duplicateExists)
            return Result.Failure<PayrollRunDto>("A payroll run already exists for this pay period", "DUPLICATE_PAYROLL_RUN");

        List<TimeEntry> approvedEntries = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(x => x.Status == TimeEntryStatus.Approved)
            .Where(x => x.Date >= payPeriod.StartDate && x.Date <= payPeriod.EndDate)
            .ToListAsync(cancellationToken);

        if (approvedEntries.Count == 0)
            return Result.Failure<PayrollRunDto>("No approved time entries found for this pay period", "NO_TIME_ENTRIES");

        List<Guid> employeeIds = approvedEntries.Select(x => x.EmployeeId).Distinct().ToList();
        Dictionary<Guid, decimal> rateByEmployee = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.BaseHourlyRate, cancellationToken);

        PayrollRun run = new()
        {
            RunDate = command.RunDate,
            PayPeriodId = command.PayPeriodId,
            Status = PayrollRunStatus.Processing
        };

        OvertimeSettings overtimeSettings = await LoadOvertimeSettingsAsync(payPeriod, approvedEntries, cancellationToken);

        foreach (IGrouping<Guid, TimeEntry> group in approvedEntries.GroupBy(x => x.EmployeeId))
        {
            (decimal regularHours, decimal overtimeHours, decimal doubletimeHours) =
                OvertimeHoursCalculator.ClassifyEmployeeHours(group.ToList(), overtimeSettings);
            decimal baseRate = rateByEmployee.GetValueOrDefault(group.Key, 0m);

            decimal regularPay = decimal.Round(regularHours * baseRate, 2, MidpointRounding.AwayFromZero);
            decimal overtimePay = decimal.Round(overtimeHours * baseRate * 1.5m, 2, MidpointRounding.AwayFromZero);
            decimal doubletimePay = decimal.Round(doubletimeHours * baseRate * 2.0m, 2, MidpointRounding.AwayFromZero);
            decimal grossPay = regularPay + overtimePay + doubletimePay;

            run.Lines.Add(new PayrollRunLine
            {
                EmployeeId = group.Key,
                RegularHours = regularHours,
                OvertimeHours = overtimeHours,
                DoubletimeHours = doubletimeHours,
                RegularPay = regularPay,
                OvertimePay = overtimePay,
                DoubletimePay = doubletimePay,
                GrossPay = grossPay
            });
        }

        run.TotalGross = run.Lines.Sum(x => x.GrossPay);
        run.TotalNet = run.TotalGross;
        run.EmployeeCount = run.Lines.Count;

        db.Set<PayrollRun>().Add(run);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(run));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate payroll run for pay period {PayPeriodId}", command.PayPeriodId);
            return Result.Failure<PayrollRunDto>("Failed to generate payroll run", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PayrollRunDto>> ApprovePayrollRunAsync(Guid id, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollRunDto>("Payroll run not found", "NOT_FOUND");

        if (run.Status is not (PayrollRunStatus.Processing or PayrollRunStatus.Submitted or PayrollRunStatus.UnderReview))
            return Result.Failure<PayrollRunDto>("Only generated payroll runs can be approved", "INVALID_STATUS");

        run.Status = PayrollRunStatus.Approved;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(run));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to approve payroll run {PayrollRunId}", id);
            return Result.Failure<PayrollRunDto>("Failed to approve payroll run", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PayrollRunDto>> ExportPayrollRunAsync(Guid id, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollRunDto>("Payroll run not found", "NOT_FOUND");

        if (run.Status != PayrollRunStatus.Approved)
            return Result.Failure<PayrollRunDto>("Only approved payroll runs can be exported", "INVALID_STATUS");

        run.Status = PayrollRunStatus.Exported;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(run));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to export payroll run {PayrollRunId}", id);
            return Result.Failure<PayrollRunDto>("Failed to export payroll run", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeletePayrollRunAsync(Guid id, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (run is null)
            return Result.Failure("Payroll run not found", "NOT_FOUND");

        if (run.Status is PayrollRunStatus.Approved or PayrollRunStatus.Exported)
            return Result.Failure("Approved or exported payroll runs cannot be deleted", "INVALID_STATUS");

        db.Set<PayrollRun>().Remove(run);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete payroll run {PayrollRunId}", id);
            return Result.Failure("Failed to delete payroll run", "DATABASE_ERROR");
        }
    }

    private static PayrollRunDto MapToDto(PayrollRun run)
    {
        return new PayrollRunDto(
            Id: run.Id,
            RunDate: run.RunDate,
            PayPeriodId: run.PayPeriodId,
            Status: run.Status,
            StatusName: run.Status.ToString(),
            TotalGross: run.TotalGross,
            TotalNet: run.TotalNet,
            EmployeeCount: run.EmployeeCount,
            Lines: run.Lines.Select(x => new PayrollRunLineDto(
                Id: x.Id,
                EmployeeId: x.EmployeeId,
                RegularHours: x.RegularHours,
                OvertimeHours: x.OvertimeHours,
                DoubletimeHours: x.DoubletimeHours,
                RegularPay: x.RegularPay,
                OvertimePay: x.OvertimePay,
                DoubletimePay: x.DoubletimePay,
                GrossPay: x.GrossPay)).ToList(),
            CreatedAt: run.CreatedAt,
            UpdatedAt: run.UpdatedAt);
    }

    private async Task<OvertimeSettings> LoadOvertimeSettingsAsync(
        PayPeriod payPeriod,
        List<TimeEntry> approvedEntries,
        CancellationToken cancellationToken)
    {
        Guid companyId = payPeriod.CompanyId;
        if (companyId == Guid.Empty && approvedEntries.Count > 0)
            companyId = approvedEntries[0].CompanyId;

        if (companyId == Guid.Empty)
            return new OvertimeSettings();

        Company? company = await db.Set<Company>()
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        return company?.OvertimeSettings ?? new OvertimeSettings();
    }

    private static bool IsValidPayrollStatusTransition(PayrollRunStatus from, PayrollRunStatus to)
    {
        if (from == to) return true;
        return (from, to) switch
        {
            (PayrollRunStatus.Draft, PayrollRunStatus.Processing) => true,
            (PayrollRunStatus.Processing, PayrollRunStatus.Submitted) => true,
            (PayrollRunStatus.Submitted, PayrollRunStatus.UnderReview) => true,
            (PayrollRunStatus.UnderReview, PayrollRunStatus.Approved) => true,
            (PayrollRunStatus.Approved, PayrollRunStatus.Exported) => true,
            _ => false
        };
    }
}
