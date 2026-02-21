using Microsoft.EntityFrameworkCore;
using Pitbull.Billing.Features.PrevailingWageValidation;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Billing.Services;

public class PrevailingWageValidationService(PitbullDbContext db) : IPrevailingWageValidationService
{
    public async Task<Result<PrevailingWageValidationResult>> ValidatePayrollRunAsync(ValidatePayrollRunPrevailingWageQuery query, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == query.PayrollRunId, cancellationToken);

        if (run is null)
            return Result.Failure<PrevailingWageValidationResult>("Payroll run not found", "NOT_FOUND");

        PayPeriod? payPeriod = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == run.PayPeriodId, cancellationToken);

        if (payPeriod is null)
            return Result.Failure<PrevailingWageValidationResult>("Pay period not found", "PAY_PERIOD_NOT_FOUND");

        Dictionary<Guid, PayrollRunLine> lineByEmployee = run.Lines.ToDictionary(x => x.EmployeeId, x => x);

        Dictionary<Guid, decimal> employeeRates = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => lineByEmployee.Keys.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.BaseHourlyRate, cancellationToken);

        List<TimeEntry> approvedEntries = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(x => x.Status == TimeEntryStatus.Approved)
            .Where(x => x.Date >= payPeriod.StartDate && x.Date <= payPeriod.EndDate)
            .Where(x => lineByEmployee.Keys.Contains(x.EmployeeId))
            .ToListAsync(cancellationToken);

        Dictionary<Guid, WageDetermination> activeDeterminationByProject = await db.Set<WageDetermination>()
            .AsNoTracking()
            .Where(x => approvedEntries.Select(e => e.ProjectId).Contains(x.ProjectId))
            .Where(x => x.Status == WageDeterminationStatus.Active)
            .Where(x => x.EffectiveDate <= payPeriod.EndDate)
            .Where(x => x.ExpirationDate == null || x.ExpirationDate >= payPeriod.StartDate)
            .GroupBy(x => x.ProjectId)
            .Select(g => g.OrderByDescending(x => x.EffectiveDate).First())
            .ToDictionaryAsync(x => x.ProjectId, cancellationToken);

        List<WorkClassification> classifications = await db.Set<WorkClassification>()
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Code)
            .ToListAsync(cancellationToken);

        Guid defaultClassificationId = classifications.FirstOrDefault()?.Id ?? Guid.Empty;

        List<WageDeterminationRate> rates = await db.Set<WageDeterminationRate>()
            .AsNoTracking()
            .Where(x => activeDeterminationByProject.Values.Select(d => d.Id).Contains(x.WageDeterminationId))
            .ToListAsync(cancellationToken);

        // Key rates by (WageDeterminationId, WorkClassificationId) to compare per-classification
        Dictionary<(Guid DeterminationId, Guid ClassificationId), decimal> rateByDeterminationAndClassification = rates
            .ToDictionary(
                r => (r.WageDeterminationId, r.WorkClassificationId),
                r => r.TotalRate);

        List<PrevailingWageViolationDto> violations = [];

        foreach (TimeEntry entry in approvedEntries)
        {
            if (!lineByEmployee.TryGetValue(entry.EmployeeId, out PayrollRunLine? runLine))
                continue;

            if (!activeDeterminationByProject.TryGetValue(entry.ProjectId, out WageDetermination? determination))
                continue;

            // Use the default classification for rate lookup (per-employee classification
            // can be added when PayrollRunLine gains a WorkClassificationId)
            decimal requiredRate = rateByDeterminationAndClassification
                .GetValueOrDefault((determination.Id, defaultClassificationId), 0m);
            decimal employeeRate = employeeRates.GetValueOrDefault(entry.EmployeeId, 0m);

            if (requiredRate > employeeRate)
            {
                violations.Add(new PrevailingWageViolationDto(
                    EmployeeId: entry.EmployeeId,
                    PayrollRunLineId: runLine.Id,
                    ProjectId: entry.ProjectId,
                    CostCodeId: entry.CostCodeId,
                    WorkClassificationId: defaultClassificationId,
                    EmployeeRate: employeeRate,
                    RequiredRate: requiredRate,
                    Variance: decimal.Round(requiredRate - employeeRate, 2, MidpointRounding.AwayFromZero),
                    Message: $"Employee hourly rate {employeeRate:0.00} is below prevailing wage minimum {requiredRate:0.00}."));
            }
        }

        return Result.Success(new PrevailingWageValidationResult(
            IsCompliant: violations.Count == 0,
            Violations: violations));
    }
}
