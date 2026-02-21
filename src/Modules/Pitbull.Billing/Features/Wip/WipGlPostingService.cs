using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.Wip;

public class WipGlPostingService(
    PitbullDbContext db,
    ILogger<WipGlPostingService> logger) : IWipGlPostingService
{
    public async Task<Result<WipGlPostResult>> PostToGlAsync(
        Guid wipReportId, string postedByUserId, CancellationToken ct = default)
    {
        var report = await db.Set<WipReport>()
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.Id == wipReportId && !r.IsDeleted, ct);

        if (report is null)
            return Result.Failure<WipGlPostResult>("WIP report not found", "NOT_FOUND");

        if (report.Status != WipReportStatus.Final)
            return Result.Failure<WipGlPostResult>(
                "Only finalized WIP reports can be posted to GL", "INVALID_STATUS");

        if (report.GlJournalEntryId.HasValue)
            return Result.Failure<WipGlPostResult>(
                "This WIP report has already been posted to GL", "ALREADY_POSTED");

        if (report.Lines.Count == 0)
            return Result.Failure<WipGlPostResult>(
                "WIP report has no lines to post", "VALIDATION_ERROR");

        // Look up required WIP GL accounts by type (once, not per line)
        var accountLookup = await ResolveWipAccountsAsync(report.CompanyId, ct);
        if (!accountLookup.IsSuccess)
            return Result.Failure<WipGlPostResult>(accountLookup.Error!, accountLookup.ErrorCode);

        var (costInExcessAccount, revenueAccount, billingsInExcessAccount) = accountLookup.Value!;

        // Validate account types match expected roles
        if (costInExcessAccount.AccountType != AccountType.Asset)
            return Result.Failure<WipGlPostResult>(
                $"Account '{costInExcessAccount.AccountNumber} {costInExcessAccount.AccountName}' must be an Asset type for Costs in Excess of Billings, but is {costInExcessAccount.AccountType}",
                "ACCOUNT_TYPE_MISMATCH");

        if (revenueAccount.AccountType != AccountType.Revenue)
            return Result.Failure<WipGlPostResult>(
                $"Account '{revenueAccount.AccountNumber} {revenueAccount.AccountName}' must be a Revenue type for Earned Revenue, but is {revenueAccount.AccountType}",
                "ACCOUNT_TYPE_MISMATCH");

        if (billingsInExcessAccount.AccountType != AccountType.Liability)
            return Result.Failure<WipGlPostResult>(
                $"Account '{billingsInExcessAccount.AccountNumber} {billingsInExcessAccount.AccountName}' must be a Liability type for Billings in Excess of Costs, but is {billingsInExcessAccount.AccountType}",
                "ACCOUNT_TYPE_MISMATCH");

        // Build journal entry lines for over/under billing adjustments
        var journalLines = new List<JournalEntryLine>();
        int lineNum = 1;

        foreach (var wipLine in report.Lines.Where(l => l.OverUnderBilling != 0))
        {
            if (wipLine.OverUnderBilling > 0)
            {
                // Underbilled: earned > billed
                // Debit: Costs in Excess of Billings (asset)
                // Credit: Earned Revenue
                journalLines.Add(new JournalEntryLine
                {
                    LineNumber = lineNum++,
                    GlAccountId = costInExcessAccount.Id,
                    DebitAmount = wipLine.OverUnderBilling,
                    CreditAmount = 0,
                    Description = $"Underbilling adjustment - {wipLine.ProjectId}",
                    ProjectId = wipLine.ProjectId,
                });
                journalLines.Add(new JournalEntryLine
                {
                    LineNumber = lineNum++,
                    GlAccountId = revenueAccount.Id,
                    DebitAmount = 0,
                    CreditAmount = wipLine.OverUnderBilling,
                    Description = $"Earned revenue - {wipLine.ProjectId}",
                    ProjectId = wipLine.ProjectId,
                });
            }
            else
            {
                // Overbilled: billed > earned
                // Debit: Revenue (reduce recognized revenue)
                // Credit: Billings in Excess of Costs (liability)
                decimal absAmount = Math.Abs(wipLine.OverUnderBilling);

                journalLines.Add(new JournalEntryLine
                {
                    LineNumber = lineNum++,
                    GlAccountId = revenueAccount.Id,
                    DebitAmount = absAmount,
                    CreditAmount = 0,
                    Description = $"Overbilling adjustment - {wipLine.ProjectId}",
                    ProjectId = wipLine.ProjectId,
                });
                journalLines.Add(new JournalEntryLine
                {
                    LineNumber = lineNum++,
                    GlAccountId = billingsInExcessAccount.Id,
                    DebitAmount = 0,
                    CreditAmount = absAmount,
                    Description = $"Billings in excess - {wipLine.ProjectId}",
                    ProjectId = wipLine.ProjectId,
                });
            }
        }

        if (journalLines.Count == 0)
            return Result.Failure<WipGlPostResult>(
                "No over/under billing adjustments to post (all lines are flat)", "NO_ADJUSTMENTS");

        decimal totalDebits = journalLines.Sum(l => l.DebitAmount);
        decimal totalCredits = journalLines.Sum(l => l.CreditAmount);

        // Generate entry number using max to avoid race condition
        int year = report.ReportDate.Year;
        int lastNumber = await db.Set<JournalEntry>()
            .Where(j => j.EntryNumber.StartsWith($"JE-{year}-"))
            .MaxAsync(j => (int?)j.Id.GetHashCode(), ct) ?? 0;
        // Use max entry number suffix for this year
        string maxEntry = await db.Set<JournalEntry>()
            .Where(j => j.EntryNumber.StartsWith($"JE-{year}-"))
            .OrderByDescending(j => j.EntryNumber)
            .Select(j => j.EntryNumber)
            .FirstOrDefaultAsync(ct) ?? $"JE-{year}-000000";
        int currentMax = int.TryParse(maxEntry.AsSpan(maxEntry.LastIndexOf('-') + 1), out var n) ? n : 0;
        string entryNumber = $"JE-{year}-{(currentMax + 1):D6}";

        var journalEntry = new JournalEntry
        {
            EntryNumber = entryNumber,
            EntryDate = report.ReportDate,
            Description = $"WIP Schedule GL posting - {report.FiscalYear} P{report.PeriodNumber}",
            Status = JournalEntryStatus.Posted,
            SourceModule = "WipSchedule",
            SourceDocumentId = report.Id,
            SourceDocumentRef = $"WIP-{report.FiscalYear}-P{report.PeriodNumber}",
            IsAutoGenerated = true,
            TotalDebits = totalDebits,
            TotalCredits = totalCredits,
            PostedByUserId = Guid.TryParse(postedByUserId, out var uid) ? uid : null,
            PostedAt = DateTime.UtcNow,
            Lines = journalLines,
        };

        db.Set<JournalEntry>().Add(journalEntry);

        // Mark WIP report as posted
        report.GlJournalEntryId = journalEntry.Id;
        report.PostedToGlAt = DateTime.UtcNow;
        report.PostedToGlBy = postedByUserId;

        try
        {
            await db.SaveChangesAsync(ct);
            return Result.Success(new WipGlPostResult(
                WipReportId: report.Id,
                JournalEntryId: journalEntry.Id,
                JournalEntryNumber: journalEntry.EntryNumber,
                TotalDebits: totalDebits,
                TotalCredits: totalCredits,
                LineCount: journalLines.Count));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to post WIP report {WipReportId} to GL", wipReportId);
            return Result.Failure<WipGlPostResult>("Failed to post WIP report to GL", "DATABASE_ERROR");
        }
    }

    private async Task<Result<(ChartOfAccount CostInExcess, ChartOfAccount Revenue, ChartOfAccount BillingsInExcess)>>
        ResolveWipAccountsAsync(Guid companyId, CancellationToken ct)
    {
        // Look up WIP accounts by conventional account numbers
        // These are standard GC chart of accounts numbers, but we validate by type
        var costInExcess = await FindAccountByNumberAsync(companyId, "1400", ct);
        var revenue = await FindAccountByNumberAsync(companyId, "4000", ct);
        var billingsInExcess = await FindAccountByNumberAsync(companyId, "2400", ct);

        if (costInExcess is null)
            return Result.Failure<(ChartOfAccount, ChartOfAccount, ChartOfAccount)>(
                "GL account '1400' (Costs in Excess of Billings) not found. " +
                "Please add an Asset account numbered 1400 in the Chart of Accounts.",
                "ACCOUNTS_NOT_FOUND");

        if (revenue is null)
            return Result.Failure<(ChartOfAccount, ChartOfAccount, ChartOfAccount)>(
                "GL account '4000' (Earned Revenue) not found. " +
                "Please add a Revenue account numbered 4000 in the Chart of Accounts.",
                "ACCOUNTS_NOT_FOUND");

        if (billingsInExcess is null)
            return Result.Failure<(ChartOfAccount, ChartOfAccount, ChartOfAccount)>(
                "GL account '2400' (Billings in Excess of Costs) not found. " +
                "Please add a Liability account numbered 2400 in the Chart of Accounts.",
                "ACCOUNTS_NOT_FOUND");

        return Result.Success((costInExcess, revenue, billingsInExcess));
    }

    private async Task<ChartOfAccount?> FindAccountByNumberAsync(
        Guid companyId, string accountNumber, CancellationToken ct)
    {
        return await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .FirstOrDefaultAsync(a =>
                a.CompanyId == companyId &&
                a.AccountNumber == accountNumber &&
                a.IsActive &&
                !a.IsDeleted, ct);
    }
}
