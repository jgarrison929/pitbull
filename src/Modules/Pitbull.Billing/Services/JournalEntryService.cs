using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.JournalEntries;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class JournalEntryService(PitbullDbContext db, ILogger<JournalEntryService> logger) : IJournalEntryService
{
    public async Task<Result<ListJournalEntriesResult>> GetJournalEntriesAsync(ListJournalEntriesQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<JournalEntry> dbQuery = db.Set<JournalEntry>().AsNoTracking().Include(j => j.Lines);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(j => j.Status == query.Status.Value);

        if (query.StartDate.HasValue)
            dbQuery = dbQuery.Where(j => j.EntryDate >= query.StartDate.Value);

        if (query.EndDate.HasValue)
            dbQuery = dbQuery.Where(j => j.EntryDate <= query.EndDate.Value);

        if (!string.IsNullOrWhiteSpace(query.SourceModule))
            dbQuery = dbQuery.Where(j => j.SourceModule == query.SourceModule);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string term = query.Search.Trim().ToLower();
            dbQuery = dbQuery.Where(j =>
                j.EntryNumber.ToLower().Contains(term) ||
                j.Description.ToLower().Contains(term));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<JournalEntry> items = await dbQuery
            .OrderByDescending(j => j.EntryDate)
            .ThenByDescending(j => j.EntryNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListJournalEntriesResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<JournalEntryDto>> GetJournalEntryAsync(Guid id, CancellationToken cancellationToken = default)
    {
        JournalEntry? entry = await db.Set<JournalEntry>()
            .AsNoTracking()
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

        if (entry is null)
            return Result.Failure<JournalEntryDto>("Journal entry not found", "NOT_FOUND");

        return Result.Success(MapToDto(entry));
    }

    public async Task<Result<JournalEntryDto>> CreateJournalEntryAsync(CreateJournalEntryCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Description))
            return Result.Failure<JournalEntryDto>("Description is required", "VALIDATION_ERROR");

        if (command.Lines is null || command.Lines.Count < 2)
            return Result.Failure<JournalEntryDto>("At least two lines are required", "VALIDATION_ERROR");

        decimal totalDebits = command.Lines.Sum(l => l.DebitAmount);
        decimal totalCredits = command.Lines.Sum(l => l.CreditAmount);

        if (totalDebits != totalCredits)
            return Result.Failure<JournalEntryDto>(
                $"Entry is unbalanced: debits ({totalDebits:N2}) must equal credits ({totalCredits:N2})",
                "UNBALANCED");

        if (totalDebits == 0)
            return Result.Failure<JournalEntryDto>("Entry must have non-zero amounts", "VALIDATION_ERROR");

        // Validate accounting period allows entry creation
        var period = await db.Set<AccountingPeriod>()
            .FirstOrDefaultAsync(p =>
                p.StartDate <= command.EntryDate && p.EndDate >= command.EntryDate,
                cancellationToken);

        if (period is not null && period.Status == PeriodStatus.HardClosed)
            return Result.Failure<JournalEntryDto>(
                $"Accounting period {period.PeriodName} is closed. Cannot create entries in a closed period.",
                "PERIOD_CLOSED");

        // Validate all GL accounts exist and are active
        var accountIds = command.Lines.Select(l => l.GlAccountId).Distinct().ToList();
        var activeAccounts = await db.Set<ChartOfAccount>().AsNoTracking()
            .Where(a => accountIds.Contains(a.Id))
            .Select(a => new { a.Id, a.IsActive, a.AccountNumber })
            .ToListAsync(cancellationToken);

        foreach (var acctId in accountIds)
        {
            var acct = activeAccounts.FirstOrDefault(a => a.Id == acctId);
            if (acct is null)
                return Result.Failure<JournalEntryDto>($"GL account {acctId} not found", "INVALID_ACCOUNT");
            if (!acct.IsActive)
                return Result.Failure<JournalEntryDto>($"GL account {acct.AccountNumber} is inactive", "INACTIVE_ACCOUNT");
        }

        // Generate entry number using Max to avoid race with Count
        string entryNumber = await GenerateEntryNumberAsync(command.EntryDate.Year, cancellationToken);

        JournalEntry entry = new()
        {
            EntryNumber = entryNumber,
            EntryDate = command.EntryDate,
            Description = command.Description.Trim(),
            Status = JournalEntryStatus.Draft,
            SourceModule = command.SourceModule,
            SourceDocumentId = command.SourceDocumentId,
            SourceDocumentRef = command.SourceDocumentRef,
            IsAutoGenerated = command.IsAutoGenerated,
            TotalDebits = totalDebits,
            TotalCredits = totalCredits
        };

        int lineNum = 1;
        foreach (var line in command.Lines)
        {
            entry.Lines.Add(new JournalEntryLine
            {
                LineNumber = lineNum++,
                GlAccountId = line.GlAccountId,
                DebitAmount = line.DebitAmount,
                CreditAmount = line.CreditAmount,
                Description = line.Description,
                ProjectId = line.ProjectId,
                CostCodeId = line.CostCodeId
            });
        }

        db.Set<JournalEntry>().Add(entry);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(entry));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create journal entry");
            return Result.Failure<JournalEntryDto>("Failed to create journal entry", "DATABASE_ERROR");
        }
    }

    public async Task<Result<JournalEntryDto>> UpdateJournalEntryAsync(UpdateJournalEntryCommand command, CancellationToken cancellationToken = default)
    {
        JournalEntry? entry = await db.Set<JournalEntry>()
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == command.JournalEntryId, cancellationToken);

        if (entry is null)
            return Result.Failure<JournalEntryDto>("Journal entry not found", "NOT_FOUND");

        if (entry.Status != JournalEntryStatus.Draft)
            return Result.Failure<JournalEntryDto>("Only draft entries can be edited", "INVALID_STATUS");

        if (command.EntryDate.HasValue)
            entry.EntryDate = command.EntryDate.Value;

        if (!string.IsNullOrWhiteSpace(command.Description))
            entry.Description = command.Description.Trim();

        if (command.Lines is not null)
        {
            if (command.Lines.Count < 2)
                return Result.Failure<JournalEntryDto>("At least two lines are required", "VALIDATION_ERROR");

            decimal totalDebits = command.Lines.Sum(l => l.DebitAmount);
            decimal totalCredits = command.Lines.Sum(l => l.CreditAmount);

            if (totalDebits != totalCredits)
                return Result.Failure<JournalEntryDto>(
                    $"Entry is unbalanced: debits ({totalDebits:N2}) must equal credits ({totalCredits:N2})",
                    "UNBALANCED");

            // Replace lines
            db.Set<JournalEntryLine>().RemoveRange(entry.Lines);
            entry.Lines.Clear();

            int lineNum = 1;
            foreach (var line in command.Lines)
            {
                entry.Lines.Add(new JournalEntryLine
                {
                    LineNumber = lineNum++,
                    GlAccountId = line.GlAccountId,
                    DebitAmount = line.DebitAmount,
                    CreditAmount = line.CreditAmount,
                    Description = line.Description,
                    ProjectId = line.ProjectId,
                    CostCodeId = line.CostCodeId
                });
            }

            entry.TotalDebits = totalDebits;
            entry.TotalCredits = totalCredits;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(entry));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<JournalEntryDto>("Journal entry was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update journal entry {Id}", command.JournalEntryId);
            return Result.Failure<JournalEntryDto>("Failed to update journal entry", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteJournalEntryAsync(Guid id, CancellationToken cancellationToken = default)
    {
        JournalEntry? entry = await db.Set<JournalEntry>().FirstOrDefaultAsync(j => j.Id == id, cancellationToken);
        if (entry is null)
            return Result.Failure("Journal entry not found", "NOT_FOUND");

        if (entry.Status != JournalEntryStatus.Draft)
            return Result.Failure("Only draft entries can be deleted", "INVALID_STATUS");

        db.Set<JournalEntry>().Remove(entry);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete journal entry {Id}", id);
            return Result.Failure("Failed to delete journal entry", "DATABASE_ERROR");
        }
    }

    public async Task<Result<JournalEntryDto>> PostJournalEntryAsync(Guid id, Guid postedByUserId, CancellationToken cancellationToken = default)
    {
        JournalEntry? entry = await db.Set<JournalEntry>()
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

        if (entry is null)
            return Result.Failure<JournalEntryDto>("Journal entry not found", "NOT_FOUND");

        if (entry.Status != JournalEntryStatus.Draft)
            return Result.Failure<JournalEntryDto>("Only draft entries can be posted", "INVALID_STATUS");

        // Validate balance
        if (entry.TotalDebits != entry.TotalCredits)
            return Result.Failure<JournalEntryDto>("Cannot post unbalanced entry", "UNBALANCED");

        // Validate accounting period is open
        var period = await db.Set<AccountingPeriod>()
            .FirstOrDefaultAsync(p =>
                p.StartDate <= entry.EntryDate && p.EndDate >= entry.EntryDate,
                cancellationToken);

        if (period is not null && period.Status == PeriodStatus.HardClosed)
            return Result.Failure<JournalEntryDto>(
                $"Accounting period {period.PeriodName} is closed. Cannot post to a closed period.",
                "PERIOD_CLOSED");

        // Validate all GL accounts exist and are active
        var accountIds = entry.Lines.Select(l => l.GlAccountId).Distinct().ToList();
        var activeAccounts = await db.Set<ChartOfAccount>().AsNoTracking()
            .Where(a => accountIds.Contains(a.Id))
            .Select(a => new { a.Id, a.IsActive, a.AccountNumber })
            .ToListAsync(cancellationToken);

        foreach (var acctId in accountIds)
        {
            var acct = activeAccounts.FirstOrDefault(a => a.Id == acctId);
            if (acct is null)
                return Result.Failure<JournalEntryDto>($"GL account {acctId} not found", "INVALID_ACCOUNT");
            if (!acct.IsActive)
                return Result.Failure<JournalEntryDto>($"GL account {acct.AccountNumber} is inactive", "INACTIVE_ACCOUNT");
        }

        entry.Status = JournalEntryStatus.Posted;
        entry.PostedByUserId = postedByUserId;
        entry.PostedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(entry));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to post journal entry {Id}", id);
            return Result.Failure<JournalEntryDto>("Failed to post journal entry", "DATABASE_ERROR");
        }
    }

    public async Task<Result<JournalEntryDto>> ReverseJournalEntryAsync(Guid id, Guid reversedByUserId, CancellationToken cancellationToken = default)
    {
        JournalEntry? original = await db.Set<JournalEntry>()
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

        if (original is null)
            return Result.Failure<JournalEntryDto>("Journal entry not found", "NOT_FOUND");

        if (original.Status != JournalEntryStatus.Posted)
            return Result.Failure<JournalEntryDto>("Only posted entries can be reversed", "INVALID_STATUS");

        // Generate reversal entry number
        int year = DateOnly.FromDateTime(DateTime.UtcNow).Year;
        string entryNumber = await GenerateEntryNumberAsync(year, cancellationToken);

        JournalEntry reversal = new()
        {
            EntryNumber = entryNumber,
            EntryDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Description = $"Reversal of {original.EntryNumber}: {original.Description}",
            Status = JournalEntryStatus.Posted,
            ReversalOfId = original.Id,
            IsAutoGenerated = true,
            TotalDebits = original.TotalDebits,
            TotalCredits = original.TotalCredits,
            PostedByUserId = reversedByUserId,
            PostedAt = DateTime.UtcNow
        };

        int lineNum = 1;
        foreach (var line in original.Lines)
        {
            reversal.Lines.Add(new JournalEntryLine
            {
                LineNumber = lineNum++,
                GlAccountId = line.GlAccountId,
                DebitAmount = line.CreditAmount,   // Swap: original credit becomes debit
                CreditAmount = line.DebitAmount,    // Swap: original debit becomes credit
                Description = $"Reversal: {line.Description}",
                ProjectId = line.ProjectId,
                CostCodeId = line.CostCodeId
            });
        }

        // Update original
        original.Status = JournalEntryStatus.Reversed;
        original.ReversedById = reversal.Id;

        db.Set<JournalEntry>().Add(reversal);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(reversal));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to reverse journal entry {Id}", id);
            return Result.Failure<JournalEntryDto>("Failed to reverse journal entry", "DATABASE_ERROR");
        }
    }

    private async Task<string> GenerateEntryNumberAsync(int year, CancellationToken ct)
    {
        string prefix = $"JE-{year}-";
        // Find the highest existing entry number for this year
        var maxEntryNumber = await db.Set<JournalEntry>()
            .Where(j => j.EntryNumber.StartsWith(prefix))
            .OrderByDescending(j => j.EntryNumber)
            .Select(j => j.EntryNumber)
            .FirstOrDefaultAsync(ct);

        int nextNum = 1;
        if (maxEntryNumber is not null)
        {
            var suffix = maxEntryNumber[prefix.Length..];
            if (int.TryParse(suffix, out int lastNum))
                nextNum = lastNum + 1;
        }

        return $"{prefix}{nextNum:D6}";
    }

    private JournalEntryDto MapToDto(JournalEntry entry)
    {
        return new JournalEntryDto(
            Id: entry.Id,
            EntryNumber: entry.EntryNumber,
            EntryDate: entry.EntryDate,
            Description: entry.Description,
            Status: entry.Status,
            SourceModule: entry.SourceModule,
            SourceDocumentId: entry.SourceDocumentId,
            SourceDocumentRef: entry.SourceDocumentRef,
            IsAutoGenerated: entry.IsAutoGenerated,
            ReversalOfId: entry.ReversalOfId,
            ReversedById: entry.ReversedById,
            TotalDebits: entry.TotalDebits,
            TotalCredits: entry.TotalCredits,
            PostedByUserId: entry.PostedByUserId,
            PostedAt: entry.PostedAt,
            Lines: entry.Lines.OrderBy(l => l.LineNumber).Select(MapLineToDto).ToList(),
            CreatedAt: entry.CreatedAt,
            UpdatedAt: entry.UpdatedAt);
    }

    private static JournalEntryLineDto MapLineToDto(JournalEntryLine line)
    {
        return new JournalEntryLineDto(
            Id: line.Id,
            LineNumber: line.LineNumber,
            GlAccountId: line.GlAccountId,
            AccountNumber: null,
            AccountName: null,
            DebitAmount: line.DebitAmount,
            CreditAmount: line.CreditAmount,
            Description: line.Description,
            ProjectId: line.ProjectId,
            CostCodeId: line.CostCodeId);
    }
}
