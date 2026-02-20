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
                var costInExcessAccount = await FindAccountByNumberAsync(
                    report.CompanyId, "1400", ct);
                var revenueAccount = await FindAccountByNumberAsync(
                    report.CompanyId, "4000", ct);

                if (costInExcessAccount is null || revenueAccount is null)
                    return Result.Failure<WipGlPostResult>(
                        "Required GL accounts not found (1400 Costs in Excess, 4000 Revenue). " +
                        "Please set up the chart of accounts before posting.",
                        "ACCOUNTS_NOT_FOUND");

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
                var revenueAccount = await FindAccountByNumberAsync(
                    report.CompanyId, "4000", ct);
                var billingsInExcessAccount = await FindAccountByNumberAsync(
                    report.CompanyId, "2400", ct);

                if (revenueAccount is null || billingsInExcessAccount is null)
                    return Result.Failure<WipGlPostResult>(
                        "Required GL accounts not found (4000 Revenue, 2400 Billings in Excess). " +
                        "Please set up the chart of accounts before posting.",
                        "ACCOUNTS_NOT_FOUND");

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

        // Generate entry number
        int count = await db.Set<JournalEntry>().CountAsync(ct);
        string entryNumber = $"JE-{report.ReportDate.Year}-{(count + 1):D6}";

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
