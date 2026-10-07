using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Payroll.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Payroll.Services;

/// <summary>
/// Prefer posted PaySlipLine amounts; otherwise IWageRateResolver. Never invents 35% burden for posted cost.
/// </summary>
public sealed class PayrollLaborCostRateSource(PitbullDbContext db, IWageRateResolver wageRateResolver) : ILaborCostRateSource
{
    public async Task<LaborRateQuote?> QuoteAsync(TimeEntry timeEntry, Employee employee, CancellationToken cancellationToken = default)
    {
        List<PaySlipLine> posted = await db.Set<PaySlipLine>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.TimeEntryId == timeEntry.Id)
            .Join(
                db.Set<PaySlip>().Where(s => !s.IsDeleted),
                line => line.PaySlipId,
                slip => slip.Id,
                (line, slip) => new { line, slip })
            .Join(
                db.Set<PayrollRun>().Where(r => !r.IsDeleted && r.Status == PayrollRunStatus.Posted),
                x => x.slip.PayrollRunId,
                run => run.Id,
                (x, run) => x.line)
            .ToListAsync(cancellationToken);

        if (posted.Count > 0)
        {
            decimal baseWage = posted
                .Where(l => l.Kind == PayComponentKind.Earning)
                .Sum(l => l.Amount);
            decimal burden = posted
                .Where(l => l.Kind == PayComponentKind.EmployerContribution)
                .Sum(l => l.Amount);

            return new LaborRateQuote(
                RegularRate: employee.BaseHourlyRate,
                OvertimeMultiplier: LaborCostCalculator.OvertimeMultiplier,
                DoubletimeMultiplier: LaborCostCalculator.DoubletimeMultiplier,
                EmployerHourlyBurden: 0m,
                IsPosted: true,
                IsProxy: false,
                PostedBaseWage: baseWage,
                PostedBurden: burden);
        }

        Result<WageRateResult> resolved = await wageRateResolver.ResolveAsync(
            new WageRateRequest(
                EmployeeId: timeEntry.EmployeeId,
                ProjectId: timeEntry.ProjectId,
                WorkDate: timeEntry.Date,
                WorkClassificationId: timeEntry.WorkClassificationId,
                ShiftCode: timeEntry.ShiftCode,
                ZoneCode: null),
            cancellationToken);

        if (!resolved.IsSuccess || resolved.Value is null)
            return null;

        WageRateResult rate = resolved.Value;
        bool proxy = rate.RateSource == RateSource.FallbackBaseRate && rate.EmployerHourlyBurden <= 0m;

        return new LaborRateQuote(
            RegularRate: rate.RegularRate,
            OvertimeMultiplier: rate.OvertimeMultiplier,
            DoubletimeMultiplier: rate.DoubletimeMultiplier,
            EmployerHourlyBurden: rate.EmployerHourlyBurden,
            IsPosted: false,
            IsProxy: proxy);
    }
}
