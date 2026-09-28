using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features.PayrollRuns;

namespace Pitbull.Payroll.Services;

public class PayrollGlPostingService(
    PitbullDbContext db,
    ILogger<PayrollGlPostingService> logger) : IPayrollGlPostingService
{
    public const string DirectLaborAccount = "5000";
    public const string LaborBurdenAccount = "5100";
    public const string AccruedPayrollAccount = "2100";
    public const string PayrollTaxesPayableAccount = "2150";

    public async Task<Result<PayrollGlPostResult>> PostToGlAsync(
        Guid payrollRunId,
        Guid? postedByUserId,
        CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .Include(x => x.PaySlips)
            .ThenInclude(s => s.Lines)
            .FirstOrDefaultAsync(x => x.Id == payrollRunId && !x.IsDeleted, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollGlPostResult>("Payroll run not found", "NOT_FOUND");

        if (run.Status is not (PayrollRunStatus.Approved or PayrollRunStatus.Exported or PayrollRunStatus.Posted))
            return Result.Failure<PayrollGlPostResult>("Only approved payroll runs can be posted to GL", "INVALID_STATUS");

        if (run.GlJournalEntryId.HasValue)
        {
            JournalEntry? existing = await db.Set<JournalEntry>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == run.GlJournalEntryId.Value && !x.IsDeleted, cancellationToken);

            if (existing is not null)
            {
                return Result.Success(new PayrollGlPostResult(
                    PayrollRunId: run.Id,
                    JournalEntryId: existing.Id,
                    JournalEntryNumber: existing.EntryNumber,
                    TotalDebits: existing.TotalDebits,
                    TotalCredits: existing.TotalCredits,
                    LineCount: 0,
                    AlreadyPosted: true));
            }
        }

        List<PaySlipLine> slipLines = run.PaySlips.SelectMany(s => s.Lines).Where(l => !l.IsDeleted).ToList();
        if (slipLines.Count == 0)
            return Result.Failure<PayrollGlPostResult>("Payroll run has no pay slip lines to post", "NO_PAY_SLIP_LINES");

        var accounts = await ResolvePayrollAccountsAsync(run.CompanyId, cancellationToken);
        if (!accounts.IsSuccess)
            return Result.Failure<PayrollGlPostResult>(accounts.Error!, accounts.ErrorCode);

        (ChartOfAccount labor, ChartOfAccount burden, ChartOfAccount accrued, ChartOfAccount taxesPayable) = accounts.Value!;

        var journalLines = new List<JournalEntryLine>();
        int lineNum = 1;

        foreach (var group in slipLines.GroupBy(l => (l.ProjectId, l.CostCodeId)))
        {
            decimal wages = group.Where(IsLaborEarning).Sum(l => l.Amount);
            decimal employer = group.Where(IsEmployerCost).Sum(l => l.Amount);
            decimal withholdings = group.Where(IsWithholding).Sum(l => l.Amount);
            decimal net = decimal.Round(wages - withholdings, 2, MidpointRounding.AwayFromZero);
            if (net < 0m)
                net = 0m;

            // Balance: wages + employer = net + (withholdings + employer)
            decimal taxesCredit = decimal.Round(withholdings + employer, 2, MidpointRounding.AwayFromZero);

            if (wages != 0m)
            {
                journalLines.Add(Debit(lineNum++, labor.Id, wages, "Direct labor", group.Key.ProjectId, group.Key.CostCodeId));
            }

            if (employer != 0m)
            {
                journalLines.Add(Debit(lineNum++, burden.Id, employer, "Labor burden & benefits", group.Key.ProjectId, group.Key.CostCodeId));
            }

            if (net != 0m)
            {
                journalLines.Add(Credit(lineNum++, accrued.Id, net, "Accrued payroll", group.Key.ProjectId, group.Key.CostCodeId));
            }

            if (taxesCredit != 0m)
            {
                journalLines.Add(Credit(lineNum++, taxesPayable.Id, taxesCredit, "Payroll taxes payable", group.Key.ProjectId, group.Key.CostCodeId));
            }
        }

        if (journalLines.Count == 0)
            return Result.Failure<PayrollGlPostResult>("No payroll amounts to post", "NO_ADJUSTMENTS");

        decimal totalDebits = journalLines.Sum(l => l.DebitAmount);
        decimal totalCredits = journalLines.Sum(l => l.CreditAmount);
        if (totalDebits != totalCredits)
        {
            return Result.Failure<PayrollGlPostResult>(
                $"Payroll journal is out of balance (dr {totalDebits} cr {totalCredits})",
                "OUT_OF_BALANCE");
        }

        string entryNumber = await GenerateEntryNumberAsync(run.RunDate.Year, cancellationToken);

        var journalEntry = new JournalEntry
        {
            EntryNumber = entryNumber,
            EntryDate = run.RunDate,
            Description = $"Payroll run {run.RunDate:yyyy-MM-dd}",
            Status = JournalEntryStatus.Posted,
            SourceModule = "Payroll",
            SourceDocumentId = run.Id,
            SourceDocumentRef = $"PR-{run.RunDate:yyyyMMdd}",
            IsAutoGenerated = true,
            TotalDebits = totalDebits,
            TotalCredits = totalCredits,
            PostedByUserId = postedByUserId,
            PostedAt = DateTime.UtcNow,
            Lines = journalLines,
        };

        db.Set<JournalEntry>().Add(journalEntry);
        run.GlJournalEntryId = journalEntry.Id;
        run.Status = PayrollRunStatus.Posted;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(new PayrollGlPostResult(
                PayrollRunId: run.Id,
                JournalEntryId: journalEntry.Id,
                JournalEntryNumber: journalEntry.EntryNumber,
                TotalDebits: totalDebits,
                TotalCredits: totalCredits,
                LineCount: journalLines.Count,
                AlreadyPosted: false));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<PayrollGlPostResult>(
                "This payroll run has already been posted to GL",
                "ALREADY_POSTED");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to post payroll run {PayrollRunId} to GL", payrollRunId);
            return Result.Failure<PayrollGlPostResult>("Failed to post payroll run to GL", "DATABASE_ERROR");
        }
    }

    private static bool IsLaborEarning(PaySlipLine line)
        => line.Kind == PayComponentKind.Earning;

    private static bool IsEmployerCost(PaySlipLine line)
        => line.Kind == PayComponentKind.EmployerContribution;

    private static bool IsWithholding(PaySlipLine line)
        => line.Kind == PayComponentKind.Deduction;

    private static JournalEntryLine Debit(int lineNumber, Guid accountId, decimal amount, string description, Guid projectId, Guid costCodeId)
        => new()
        {
            LineNumber = lineNumber,
            GlAccountId = accountId,
            DebitAmount = amount,
            CreditAmount = 0,
            Description = description,
            ProjectId = projectId,
            CostCodeId = costCodeId,
        };

    private static JournalEntryLine Credit(int lineNumber, Guid accountId, decimal amount, string description, Guid projectId, Guid costCodeId)
        => new()
        {
            LineNumber = lineNumber,
            GlAccountId = accountId,
            DebitAmount = 0,
            CreditAmount = amount,
            Description = description,
            ProjectId = projectId,
            CostCodeId = costCodeId,
        };

    private async Task<Result<(ChartOfAccount Labor, ChartOfAccount Burden, ChartOfAccount Accrued, ChartOfAccount Taxes)>>
        ResolvePayrollAccountsAsync(Guid companyId, CancellationToken cancellationToken)
    {
        ChartOfAccount? labor = await FindAccountByNumberAsync(companyId, DirectLaborAccount, cancellationToken);
        ChartOfAccount? burden = await FindAccountByNumberAsync(companyId, LaborBurdenAccount, cancellationToken);
        ChartOfAccount? accrued = await FindAccountByNumberAsync(companyId, AccruedPayrollAccount, cancellationToken);
        ChartOfAccount? taxes = await FindAccountByNumberAsync(companyId, PayrollTaxesPayableAccount, cancellationToken);

        if (labor is null)
            return Result.Failure<(ChartOfAccount, ChartOfAccount, ChartOfAccount, ChartOfAccount)>(
                "GL account '5000' (Direct Labor) not found.", "ACCOUNTS_NOT_FOUND");
        if (burden is null)
            return Result.Failure<(ChartOfAccount, ChartOfAccount, ChartOfAccount, ChartOfAccount)>(
                "GL account '5100' (Labor Burden & Benefits) not found.", "ACCOUNTS_NOT_FOUND");
        if (accrued is null)
            return Result.Failure<(ChartOfAccount, ChartOfAccount, ChartOfAccount, ChartOfAccount)>(
                "GL account '2100' (Accrued Payroll) not found.", "ACCOUNTS_NOT_FOUND");
        if (taxes is null)
            return Result.Failure<(ChartOfAccount, ChartOfAccount, ChartOfAccount, ChartOfAccount)>(
                "GL account '2150' (Payroll Taxes Payable) not found.", "ACCOUNTS_NOT_FOUND");

        return Result.Success((labor, burden, accrued, taxes));
    }

    private async Task<string> GenerateEntryNumberAsync(int year, CancellationToken cancellationToken)
    {
        string prefix = $"JE-{year}-";
        var maxEntryNumber = await db.Set<JournalEntry>()
            .Where(j => j.EntryNumber.StartsWith(prefix))
            .OrderByDescending(j => j.EntryNumber)
            .Select(j => j.EntryNumber)
            .FirstOrDefaultAsync(cancellationToken);

        int nextNum = 1;
        if (maxEntryNumber is not null)
        {
            var suffix = maxEntryNumber[prefix.Length..];
            if (int.TryParse(suffix, out int lastNum))
                nextNum = lastNum + 1;
        }

        return $"{prefix}{nextNum:D6}";
    }

    private async Task<ChartOfAccount?> FindAccountByNumberAsync(
        Guid companyId, string accountNumber, CancellationToken cancellationToken)
    {
        return await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .FirstOrDefaultAsync(a =>
                a.CompanyId == companyId &&
                a.AccountNumber == accountNumber &&
                a.IsActive &&
                !a.IsDeleted, cancellationToken);
    }
}
