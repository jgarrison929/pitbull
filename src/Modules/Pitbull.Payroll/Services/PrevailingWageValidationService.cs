using Microsoft.EntityFrameworkCore;
using Pitbull.Payroll.Features.PrevailingWageValidation;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Payroll.Services;

public class PrevailingWageValidationService(PitbullDbContext db) : IPrevailingWageValidationService
{
    public async Task<Result<PrevailingWageValidationResult>> ValidatePayrollRunAsync(ValidatePayrollRunPrevailingWageQuery query, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == query.PayrollRunId && !x.IsDeleted, cancellationToken);

        if (run is null)
            return Result.Failure<PrevailingWageValidationResult>("Payroll run not found", "NOT_FOUND");

        PayPeriod? payPeriod = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == run.PayPeriodId && !x.IsDeleted, cancellationToken);

        if (payPeriod is null)
            return Result.Failure<PrevailingWageValidationResult>("Pay period not found", "PAY_PERIOD_NOT_FOUND");

        Dictionary<Guid, PayrollRunLine> lineByEmployee = run.Lines
            .Where(x => !x.IsDeleted)
            .GroupBy(x => x.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        List<TimeEntry> approvedEntries = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Where(x => x.Status == TimeEntryStatus.Approved)
            .Where(x => x.Date >= payPeriod.StartDate && x.Date <= payPeriod.EndDate)
            .Where(x => lineByEmployee.Keys.Contains(x.EmployeeId))
            .ToListAsync(cancellationToken);

        HashSet<Guid> projectIds = approvedEntries.Select(e => e.ProjectId).ToHashSet();

        Dictionary<Guid, WageDetermination> activeDeterminationByProject = await db.Set<WageDetermination>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Where(x => projectIds.Contains(x.ProjectId))
            .Where(x => x.Status == WageDeterminationStatus.Active)
            .Where(x => x.EffectiveDate <= payPeriod.EndDate)
            .Where(x => x.ExpirationDate == null || x.ExpirationDate >= payPeriod.StartDate)
            .GroupBy(x => x.ProjectId)
            .Select(g => g.OrderByDescending(x => x.EffectiveDate).First())
            .ToDictionaryAsync(x => x.ProjectId, cancellationToken);

        List<WageDeterminationRate> rates = await db.Set<WageDeterminationRate>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Where(x => activeDeterminationByProject.Values.Select(d => d.Id).Contains(x.WageDeterminationId))
            .ToListAsync(cancellationToken);

        Dictionary<(Guid DeterminationId, Guid ClassificationId), decimal> rateByDeterminationAndClassification = rates
            .GroupBy(r => (r.WageDeterminationId, r.WorkClassificationId))
            .ToDictionary(g => g.Key, g => g.First().TotalRate);

        List<FringeBenefitAllocation> fringeAllocations = await db.Set<FringeBenefitAllocation>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Where(x => lineByEmployee.Keys.Contains(x.EmployeeId))
            .Where(x => projectIds.Contains(x.ProjectId))
            .ToListAsync(cancellationToken);

        List<PrevailingWageViolationDto> violations = [];

        foreach (TimeEntry entry in approvedEntries)
        {
            if (!lineByEmployee.TryGetValue(entry.EmployeeId, out PayrollRunLine? runLine))
                continue;

            if (!activeDeterminationByProject.TryGetValue(entry.ProjectId, out WageDetermination? determination))
                continue;

            Guid? classificationId = runLine.WorkClassificationId ?? entry.WorkClassificationId;
            if (classificationId is null || classificationId == Guid.Empty)
            {
                violations.Add(new PrevailingWageViolationDto(
                    EmployeeId: entry.EmployeeId,
                    PayrollRunLineId: runLine.Id,
                    ProjectId: entry.ProjectId,
                    CostCodeId: entry.CostCodeId,
                    WorkClassificationId: Guid.Empty,
                    EmployeeRate: 0m,
                    RequiredRate: 0m,
                    Variance: 0m,
                    Message: "Work classification is required for prevailing-wage validation."));
                continue;
            }

            if (!rateByDeterminationAndClassification.TryGetValue((determination.Id, classificationId.Value), out decimal requiredRate)
                || requiredRate <= 0m)
            {
                continue;
            }

            decimal employeeRate = ResolvePaidTotalRate(runLine, fringeAllocations, entry);

            if (requiredRate > employeeRate)
            {
                violations.Add(new PrevailingWageViolationDto(
                    EmployeeId: entry.EmployeeId,
                    PayrollRunLineId: runLine.Id,
                    ProjectId: entry.ProjectId,
                    CostCodeId: entry.CostCodeId,
                    WorkClassificationId: classificationId.Value,
                    EmployeeRate: employeeRate,
                    RequiredRate: requiredRate,
                    Variance: decimal.Round(requiredRate - employeeRate, 2, MidpointRounding.AwayFromZero),
                    Message: $"Employee total rate {employeeRate:0.00} is below prevailing wage minimum {requiredRate:0.00} (base + fringe)."));
            }
        }

        return Result.Success(new PrevailingWageValidationResult(
            IsCompliant: violations.Count == 0,
            Violations: violations));
    }

    /// <summary>
    /// Paid total rate from the run line (not Employee.BaseHourlyRate) plus cash/benefit fringe per hour.
    /// Consistent with WageDeterminationRate.TotalRate = base + fringe.
    /// </summary>
    private static decimal ResolvePaidTotalRate(
        PayrollRunLine runLine,
        List<FringeBenefitAllocation> fringeAllocations,
        TimeEntry entry)
    {
        decimal hours = runLine.RegularHours + runLine.OvertimeHours + runLine.DoubletimeHours;
        decimal baseRate = 0m;

        if (runLine.RegularHours > 0 && runLine.RegularPay > 0)
            baseRate = runLine.RegularPay / runLine.RegularHours;
        else if (hours > 0 && runLine.GrossPay > 0)
            baseRate = runLine.GrossPay / hours;

        FringeBenefitAllocation? fringe = fringeAllocations
            .Where(f => f.EmployeeId == runLine.EmployeeId && f.ProjectId == entry.ProjectId)
            .OrderByDescending(f => f.PayrollRunLineId == runLine.Id)
            .ThenByDescending(f => f.CreatedAt)
            .FirstOrDefault();

        decimal fringePerHour = 0m;
        if (fringe is not null)
        {
            if (fringe.RequiredFringeRate > 0)
                fringePerHour = fringe.RequiredFringeRate;
            else if (hours > 0)
                fringePerHour = (fringe.CashFringeAmount + fringe.BenefitFringeAmount) / hours;
        }

        return decimal.Round(baseRate + fringePerHour, 4, MidpointRounding.AwayFromZero);
    }
}
