using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Payroll.Features.PayrollRuns;
using Pitbull.Payroll.Features.PrevailingWageValidation;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Payroll.Services;

public class PayrollRunService(PitbullDbContext db, ILogger<PayrollRunService> logger, IWageRateResolver wageRateResolver, IPrevailingWageValidationService prevailingWageValidationService, IPayrollTaxEngine taxEngine) : IPayrollRunService
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

        PayrollRun run = new()
        {
            RunDate = command.RunDate,
            PayPeriodId = command.PayPeriodId,
            Status = PayrollRunStatus.Processing
        };

        OvertimeSettings overtimeSettings = await LoadOvertimeSettingsAsync(payPeriod, approvedEntries, cancellationToken);

        foreach (IGrouping<Guid, TimeEntry> group in approvedEntries.GroupBy(x => x.EmployeeId))
        {
            List<TimeEntry> entries = group.ToList();
            (decimal regularHours, decimal overtimeHours, decimal doubletimeHours) =
                OvertimeHoursCalculator.ClassifyEmployeeHours(entries, overtimeSettings);

            Result<WageRateResult> resolved = await ResolveEmployeeRateAsync(entries, cancellationToken);
            if (!resolved.IsSuccess)
                return Result.Failure<PayrollRunDto>(resolved.Error ?? "Failed to resolve wage rate", resolved.ErrorCode);

            WageRateResult rate = resolved.Value!;

            PaySlip slip = new()
            {
                EmployeeId = group.Key,
                RegularHours = regularHours,
                OvertimeHours = overtimeHours,
                DoubletimeHours = doubletimeHours,
                RateSource = rate.RateSource
            };

            Result? slipError = await AddJobCostedLinesAsync(
                slip, entries, regularHours, overtimeHours, doubletimeHours, cancellationToken);
            if (slipError is not null)
                return Result.Failure<PayrollRunDto>(slipError.Error ?? "Failed to price pay slip lines", slipError.ErrorCode);

            slip.Gross = slip.Lines.Where(l => l.Kind == Pitbull.Payroll.Domain.PayComponentKind.Earning).Sum(l => l.Amount);
            slip.EmployerCost = slip.Lines.Where(l => l.Kind == Pitbull.Payroll.Domain.PayComponentKind.EmployerContribution).Sum(l => l.Amount);
            slip.Net = slip.Gross;
            run.PaySlips.Add(slip);

            decimal regularPay = slip.Lines.Where(l => l.ComponentCode == "ST").Sum(l => l.Amount);
            decimal overtimePay = slip.Lines.Where(l => l.ComponentCode == "OT").Sum(l => l.Amount);
            decimal doubletimePay = slip.Lines.Where(l => l.ComponentCode == "DT").Sum(l => l.Amount);

            run.Lines.Add(new PayrollRunLine
            {
                EmployeeId = group.Key,
                RegularHours = regularHours,
                OvertimeHours = overtimeHours,
                DoubletimeHours = doubletimeHours,
                RegularPay = regularPay,
                OvertimePay = overtimePay,
                DoubletimePay = doubletimePay,
                GrossPay = slip.Gross,
                WorkClassificationId = rate.WorkClassificationId,
                RateSource = rate.RateSource
            });
        }

        run.TotalGross = run.Lines.Sum(x => x.GrossPay);
        run.EmployeeCount = run.Lines.Count;

        Result taxPack = await ApplyTaxPackAsync(run, approvedEntries, cancellationToken);
        if (!taxPack.IsSuccess)
            return Result.Failure<PayrollRunDto>(taxPack.Error ?? "Tax calculation failed", taxPack.ErrorCode);

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

        Result? certifiedGate = await EnsureCertifiedJobsPassPrevailingWageAsync(run, cancellationToken);
        if (certifiedGate is not null)
            return Result.Failure<PayrollRunDto>(certifiedGate.Error ?? "Prevailing wage validation failed", certifiedGate.ErrorCode ?? "PREVAILING_WAGE_VIOLATION");

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

    private async Task<Result?> EnsureCertifiedJobsPassPrevailingWageAsync(PayrollRun run, CancellationToken cancellationToken)
    {
        PayPeriod? payPeriod = await db.Set<PayPeriod>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == run.PayPeriodId, cancellationToken);

        if (payPeriod is null)
            return null;

        List<Guid> employeeIds = run.Lines.Select(x => x.EmployeeId).Distinct().ToList();
        if (employeeIds.Count == 0)
            return null;

        List<Guid> projectIds = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Where(x => x.Status == TimeEntryStatus.Approved)
            .Where(x => x.Date >= payPeriod.StartDate && x.Date <= payPeriod.EndDate)
            .Where(x => employeeIds.Contains(x.EmployeeId))
            .Select(x => x.ProjectId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (projectIds.Count == 0)
            return null;

        List<Guid> certifiedProjectIds = await db.Set<Project>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && projectIds.Contains(x.Id) && x.CertifiedPayroll)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (certifiedProjectIds.Count == 0)
            return null;

        // Certified jobs require a covering WageDetermination unless related run lines
        // were priced from a union package (RateSource.UnionPackage).
        HashSet<Guid> certifiedEmployeeIds = (await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Where(x => x.Status == TimeEntryStatus.Approved)
            .Where(x => x.Date >= payPeriod.StartDate && x.Date <= payPeriod.EndDate)
            .Where(x => certifiedProjectIds.Contains(x.ProjectId))
            .Select(x => x.EmployeeId)
            .Distinct()
            .ToListAsync(cancellationToken)).ToHashSet();

        bool allUnionPriced = run.Lines
            .Where(l => certifiedEmployeeIds.Contains(l.EmployeeId))
            .All(l => l.RateSource == RateSource.UnionPackage);

        if (!allUnionPriced)
        {
            List<Guid> covered = await db.Set<WageDetermination>()
                .AsNoTracking()
                .Where(x => !x.IsDeleted)
                .Where(x => certifiedProjectIds.Contains(x.ProjectId))
                .Where(x => x.Status == WageDeterminationStatus.Active)
                .Where(x => x.EffectiveDate <= payPeriod.EndDate)
                .Where(x => x.ExpirationDate == null || x.ExpirationDate >= payPeriod.StartDate)
                .Select(x => x.ProjectId)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (certifiedProjectIds.Any(id => !covered.Contains(id)))
            {
                return Result.Failure(
                    "Certified-payroll projects require an active wage determination covering the pay period",
                    "WAGE_DETERMINATION_REQUIRED");
            }
        }

        Result<PrevailingWageValidationResult> validation = await prevailingWageValidationService.ValidatePayrollRunAsync(
            new ValidatePayrollRunPrevailingWageQuery(run.Id),
            cancellationToken);

        if (!validation.IsSuccess)
            return Result.Failure(validation.Error ?? "Prevailing wage validation failed", validation.ErrorCode ?? "PREVAILING_WAGE_ERROR");

        if (validation.Value is { IsCompliant: false })
        {
            int count = validation.Value.Violations.Count;
            return Result.Failure(
                $"Payroll run has {count} prevailing-wage violation(s) on certified job(s)",
                "PREVAILING_WAGE_VIOLATION");
        }

        return null;
    }

    public async Task<Result<PayrollRunDto>> ExportPayrollRunAsync(Guid id, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollRunDto>("Payroll run not found", "NOT_FOUND");

        if (run.Status is not (PayrollRunStatus.Approved or PayrollRunStatus.Posted))
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

        if (run.Status is PayrollRunStatus.Approved or PayrollRunStatus.Exported or PayrollRunStatus.Posted)
            return Result.Failure("Approved, exported, or posted payroll runs cannot be deleted", "INVALID_STATUS");

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
                GrossPay: x.GrossPay,
                WorkClassificationId: x.WorkClassificationId,
                RateSource: x.RateSource)).ToList(),
            CreatedAt: run.CreatedAt,
            UpdatedAt: run.UpdatedAt,
            NetIsProxy: run.TaxTableVersionId is null,
            TaxTableVersionId: run.TaxTableVersionId);
    }


    private async Task<Result> ApplyTaxPackAsync(
        PayrollRun run,
        List<TimeEntry> entries,
        CancellationToken cancellationToken)
    {
        // Overlay pack decides tax. This method must not branch on USA / jurisdiction math.
        if (!taxEngine.IsConfigured)
        {
            run.TotalNet = run.TotalGross;
            return Result.Success();
        }

        List<Guid> projectIds = entries.Select(x => x.ProjectId).Distinct().ToList();
        List<Project> projects = await db.Set<Project>()
            .AsNoTracking()
            .Where(x => projectIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (entries.Exists(entry =>
            {
                Project? project = projects.FirstOrDefault(x => x.Id == entry.ProjectId);
                return project is null || string.IsNullOrWhiteSpace(project.State);
            }))
        {
            return Result.Failure("Work-state (Project.State) is required before tax can be calculated", "WORK_STATE_REQUIRED");
        }

        List<Guid> employeeIds = run.Lines.Select(x => x.EmployeeId).Distinct().ToList();
        List<EmployeeTaxCompliance> taxRecords = await db.Set<EmployeeTaxCompliance>()
            .AsNoTracking()
            .Where(x => employeeIds.Contains(x.EmployeeId))
            .ToListAsync(cancellationToken);

        List<EmployeeWageSlice> wages = [];
        foreach (PayrollRunLine line in run.Lines)
        {
            List<TimeEntry> employeeEntries = entries.Where(x => x.EmployeeId == line.EmployeeId).ToList();
            string? workState = employeeEntries
                .Select(x => projects.FirstOrDefault(p => p.Id == x.ProjectId)?.State)
                .FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));

            wages.Add(new EmployeeWageSlice(
                line.EmployeeId,
                line.GrossPay,
                workState,
                employeeEntries.FirstOrDefault()?.ProjectId));
        }

        List<EmployeeTaxProfile> profiles = employeeIds.Select(id =>
        {
            EmployeeTaxCompliance? tax = taxRecords.FirstOrDefault(x => x.EmployeeId == id);
            return new EmployeeTaxProfile(
                id,
                tax?.W4FilingStatus ?? W4FilingStatus.Single,
                tax?.W4AdditionalWithholding ?? 0m,
                tax?.W4Exempt ?? false,
                tax?.ResidenceState,
                tax?.ResidenceLocality);
        }).ToList();

        Result<PayrollTaxCalculationResult> calc = await taxEngine.CalculateAsync(
            new PayrollTaxCalculationRequest(run.Id, run.RunDate, wages, profiles, run.TaxTableVersionId),
            cancellationToken);

        if (!calc.IsSuccess)
            return Result.Failure(calc.Error ?? "Tax calculation failed", calc.ErrorCode);

        PayrollTaxCalculationResult tax = calc.Value!;
        run.TaxTableVersionId = tax.TaxTableVersionId;
        if (tax.NetByEmployee.Count > 0)
            run.TotalNet = tax.NetByEmployee.Values.Sum();
        else
            run.TotalNet = run.TotalGross - tax.Components.Sum(x => x.Amount);

        ApplyTaxComponentsToSlips(run, tax);
        return Result.Success();
    }

    private static void ApplyTaxComponentsToSlips(PayrollRun run, PayrollTaxCalculationResult tax)
    {
        foreach (PaySlip slip in run.PaySlips)
        {
            List<PayrollTaxComponent> employeeComponents = tax.Components
                .Where(c => c.EmployeeId == slip.EmployeeId)
                .ToList();

            decimal taxes = employeeComponents
                .Where(c => IsEmployeeTaxCode(c.ComponentCode))
                .Sum(c => c.Amount);
            decimal employerTaxes = employeeComponents
                .Where(c => IsEmployerTaxCode(c.ComponentCode))
                .Sum(c => c.Amount);

            PaySlipLine? firstEarning = slip.Lines.FirstOrDefault(l => l.Kind == Pitbull.Payroll.Domain.PayComponentKind.Earning);
            Guid projectId = firstEarning?.ProjectId ?? Guid.Empty;
            Guid costCodeId = firstEarning?.CostCodeId ?? Guid.Empty;
            Guid? classId = firstEarning?.WorkClassificationId;
            Guid? timeEntryId = firstEarning?.TimeEntryId;

            foreach (PayrollTaxComponent component in employeeComponents)
            {
                bool employer = IsEmployerTaxCode(component.ComponentCode);
                slip.Lines.Add(new PaySlipLine
                {
                    TimeEntryId = timeEntryId,
                    ProjectId = projectId,
                    CostCodeId = costCodeId,
                    WorkClassificationId = classId,
                    ComponentCode = component.ComponentCode,
                    Kind = employer
                        ? Pitbull.Payroll.Domain.PayComponentKind.EmployerContribution
                        : Pitbull.Payroll.Domain.PayComponentKind.Deduction,
                    Hours = 0m,
                    Rate = 0m,
                    Amount = component.Amount
                });
            }

            slip.TotalTaxes = taxes;
            slip.EmployerCost += employerTaxes;
            if (tax.NetByEmployee.TryGetValue(slip.EmployeeId, out decimal net))
                slip.Net = net;
            else
                slip.Net = slip.Gross - taxes;
        }
    }

    private static bool IsEmployerTaxCode(string code)
        => code.EndsWith("_ER", StringComparison.OrdinalIgnoreCase)
           || string.Equals(code, "FUTA", StringComparison.OrdinalIgnoreCase)
           || string.Equals(code, "SUTA", StringComparison.OrdinalIgnoreCase);

    private static bool IsEmployeeTaxCode(string code)
        => !IsEmployerTaxCode(code);

    private async Task<Result<WageRateResult>> ResolveEmployeeRateAsync(
        List<TimeEntry> entries,
        CancellationToken cancellationToken)
    {
        Result<WageRateResult>? unionHit = null;
        Result<WageRateResult>? fallback = null;

        foreach (TimeEntry entry in entries.OrderBy(x => x.Date))
        {
            Result<WageRateResult> resolved = await wageRateResolver.ResolveAsync(
                new WageRateRequest(
                    EmployeeId: entry.EmployeeId,
                    ProjectId: entry.ProjectId,
                    WorkDate: entry.Date,
                    WorkClassificationId: entry.WorkClassificationId,
                    ShiftCode: entry.ShiftCode,
                    ZoneCode: null),
                cancellationToken);

            if (!resolved.IsSuccess)
                return resolved;

            if (resolved.Value!.RateSource == RateSource.UnionPackage)
            {
                unionHit = resolved;
                break;
            }

            fallback ??= resolved;
        }

        return unionHit ?? fallback ?? Result.Failure<WageRateResult>("Unable to resolve a wage rate", "RATE_NOT_FOUND");
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

        return CompanyOvertimePolicy.Resolve(company);
    }


    private async Task<Result?> AddJobCostedLinesAsync(
        PaySlip slip,
        List<TimeEntry> entries,
        decimal regularHours,
        decimal overtimeHours,
        decimal doubletimeHours,
        CancellationToken cancellationToken)
    {
        List<(TimeEntry Entry, decimal Regular, decimal Overtime, decimal Doubletime)> allocated =
            AllocateClassifiedHours(entries, regularHours, overtimeHours, doubletimeHours);

        foreach ((TimeEntry entry, decimal stHours, decimal otHours, decimal dtHours) in allocated)
        {
            Result<WageRateResult> resolved = await wageRateResolver.ResolveAsync(
                new WageRateRequest(
                    EmployeeId: entry.EmployeeId,
                    ProjectId: entry.ProjectId,
                    WorkDate: entry.Date,
                    WorkClassificationId: entry.WorkClassificationId,
                    ShiftCode: entry.ShiftCode,
                    ZoneCode: null),
                cancellationToken);

            if (!resolved.IsSuccess)
                return Result.Failure(resolved.Error ?? "Failed to resolve wage rate", resolved.ErrorCode);

            WageRateResult rate = resolved.Value!;
            if (stHours > 0m)
            {
                decimal amount = decimal.Round(stHours * rate.RegularRate, 2, MidpointRounding.AwayFromZero);
                slip.Lines.Add(CreateSlipLine(entry, rate, "ST", Pitbull.Payroll.Domain.PayComponentKind.Earning, stHours, rate.RegularRate, amount));
            }

            if (otHours > 0m)
            {
                decimal otRate = rate.RegularRate * rate.OvertimeMultiplier;
                decimal amount = decimal.Round(otHours * otRate, 2, MidpointRounding.AwayFromZero);
                slip.Lines.Add(CreateSlipLine(entry, rate, "OT", Pitbull.Payroll.Domain.PayComponentKind.Earning, otHours, otRate, amount));
            }

            if (dtHours > 0m)
            {
                decimal dtRate = rate.RegularRate * rate.DoubletimeMultiplier;
                decimal amount = decimal.Round(dtHours * dtRate, 2, MidpointRounding.AwayFromZero);
                slip.Lines.Add(CreateSlipLine(entry, rate, "DT", Pitbull.Payroll.Domain.PayComponentKind.Earning, dtHours, dtRate, amount));
            }

            decimal hours = stHours + otHours + dtHours;
            if (hours > 0m && rate.EmployerComponents is { Count: > 0 })
            {
                foreach (EmployerComponentRate er in rate.EmployerComponents)
                {
                    decimal amount = decimal.Round(hours * er.HourlyRate, 2, MidpointRounding.AwayFromZero);
                    if (amount == 0m)
                        continue;
                    slip.Lines.Add(CreateSlipLine(
                        entry,
                        rate,
                        er.ComponentCode,
                        Pitbull.Payroll.Domain.PayComponentKind.EmployerContribution,
                        hours,
                        er.HourlyRate,
                        amount,
                        er.PayComponentId));
                }
            }
        }

        return null;
    }

    private static PaySlipLine CreateSlipLine(
        TimeEntry entry,
        WageRateResult rate,
        string componentCode,
        Pitbull.Payroll.Domain.PayComponentKind kind,
        decimal hours,
        decimal lineRate,
        decimal amount,
        Guid? payComponentId = null)
    {
        return new PaySlipLine
        {
            TimeEntryId = entry.Id,
            ProjectId = entry.ProjectId,
            CostCodeId = entry.CostCodeId,
            WorkClassificationId = rate.WorkClassificationId ?? entry.WorkClassificationId,
            PayComponentId = payComponentId,
            ComponentCode = componentCode,
            Kind = kind,
            Hours = hours,
            Rate = lineRate,
            Amount = amount,
            WagePackageId = rate.WagePackageId
        };
    }

    private static List<(TimeEntry Entry, decimal Regular, decimal Overtime, decimal Doubletime)> AllocateClassifiedHours(
        List<TimeEntry> entries,
        decimal regularHours,
        decimal overtimeHours,
        decimal doubletimeHours)
    {
        decimal totalHours = entries.Sum(e => e.TotalHours);
        if (entries.Count == 0)
            return [];

        if (totalHours <= 0m)
            return entries.Select(e => (e, 0m, 0m, 0m)).ToList();

        var result = new List<(TimeEntry, decimal, decimal, decimal)>(entries.Count);
        decimal allocatedSt = 0m, allocatedOt = 0m, allocatedDt = 0m;

        for (int i = 0; i < entries.Count; i++)
        {
            TimeEntry entry = entries[i];
            decimal ratio = entry.TotalHours / totalHours;
            decimal st = decimal.Round(regularHours * ratio, 2, MidpointRounding.AwayFromZero);
            decimal ot = decimal.Round(overtimeHours * ratio, 2, MidpointRounding.AwayFromZero);
            decimal dt = decimal.Round(doubletimeHours * ratio, 2, MidpointRounding.AwayFromZero);
            allocatedSt += st;
            allocatedOt += ot;
            allocatedDt += dt;
            result.Add((entry, st, ot, dt));
        }

        int last = result.Count - 1;
        (TimeEntry lastEntry, decimal lastSt, decimal lastOt, decimal lastDt) = result[last];
        result[last] = (
            lastEntry,
            lastSt + (regularHours - allocatedSt),
            lastOt + (overtimeHours - allocatedOt),
            lastDt + (doubletimeHours - allocatedDt));

        return result;
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
            (PayrollRunStatus.Approved, PayrollRunStatus.Posted) => true,
            (PayrollRunStatus.Exported, PayrollRunStatus.Posted) => true,
            (PayrollRunStatus.Posted, PayrollRunStatus.Exported) => true,
            _ => false
        };
    }
}
