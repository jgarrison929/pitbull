using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Services;

public enum ExportFormat
{
    QuickBooksDesktop,
    QuickBooksOnline,
    AdpPayroll,
    GenericCsv
}

public enum ExportEntityType
{
    ChartOfAccounts,
    JournalEntries,
    Employees,
    TimeEntries,
    PayrollRuns,
    Vendors,
    Customers
}

public record ExportOptions
{
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public Guid? ProjectId { get; init; }
    public string? Status { get; init; }
}

public record ExportResult(
    string FileName,
    string ContentType,
    byte[] Content,
    int RowCount);

public interface IIntegrationExportService
{
    Task<ExportResult> ExportAsync(ExportEntityType entityType, ExportFormat format, ExportOptions options, CancellationToken ct);
    IReadOnlyList<ExportFormatInfo> GetSupportedFormats();
}

public record ExportFormatInfo(ExportFormat Format, ExportEntityType EntityType, string Description);

public class IntegrationExportService(
    PitbullDbContext db,
    ICompanyContext company,
    ILogger<IntegrationExportService> logger) : IIntegrationExportService
{
    private static readonly IReadOnlyList<ExportFormatInfo> SupportedFormats =
    [
        new(ExportFormat.QuickBooksDesktop, ExportEntityType.ChartOfAccounts, "QuickBooks Desktop IIF — Chart of Accounts"),
        new(ExportFormat.QuickBooksDesktop, ExportEntityType.JournalEntries, "QuickBooks Desktop IIF — Journal Entries"),
        new(ExportFormat.QuickBooksDesktop, ExportEntityType.Vendors, "QuickBooks Desktop IIF — Vendors"),
        new(ExportFormat.QuickBooksDesktop, ExportEntityType.Customers, "QuickBooks Desktop IIF — Customers"),
        new(ExportFormat.QuickBooksDesktop, ExportEntityType.TimeEntries, "QuickBooks Desktop IIF — Time Activities"),
        new(ExportFormat.QuickBooksOnline, ExportEntityType.ChartOfAccounts, "QuickBooks Online CSV — Chart of Accounts"),
        new(ExportFormat.QuickBooksOnline, ExportEntityType.JournalEntries, "QuickBooks Online CSV — Journal Entries"),
        new(ExportFormat.QuickBooksOnline, ExportEntityType.Vendors, "QuickBooks Online CSV — Vendors"),
        new(ExportFormat.QuickBooksOnline, ExportEntityType.Customers, "QuickBooks Online CSV — Customers"),
        new(ExportFormat.QuickBooksOnline, ExportEntityType.Employees, "QuickBooks Online CSV — Employees"),
        new(ExportFormat.AdpPayroll, ExportEntityType.Employees, "ADP Payroll CSV — Employees"),
        new(ExportFormat.AdpPayroll, ExportEntityType.PayrollRuns, "ADP Payroll CSV — Payroll Runs"),
        new(ExportFormat.AdpPayroll, ExportEntityType.TimeEntries, "ADP Payroll CSV — Time Entries"),
        new(ExportFormat.GenericCsv, ExportEntityType.ChartOfAccounts, "Generic CSV — Chart of Accounts"),
        new(ExportFormat.GenericCsv, ExportEntityType.JournalEntries, "Generic CSV — Journal Entries"),
        new(ExportFormat.GenericCsv, ExportEntityType.Employees, "Generic CSV — Employees"),
        new(ExportFormat.GenericCsv, ExportEntityType.TimeEntries, "Generic CSV — Time Entries"),
        new(ExportFormat.GenericCsv, ExportEntityType.PayrollRuns, "Generic CSV — Payroll Runs"),
        new(ExportFormat.GenericCsv, ExportEntityType.Vendors, "Generic CSV — Vendors"),
        new(ExportFormat.GenericCsv, ExportEntityType.Customers, "Generic CSV — Customers"),
    ];

    public IReadOnlyList<ExportFormatInfo> GetSupportedFormats() => SupportedFormats;

    public async Task<ExportResult> ExportAsync(
        ExportEntityType entityType,
        ExportFormat format,
        ExportOptions options,
        CancellationToken ct)
    {
        var isSupported = SupportedFormats.Any(f => f.Format == format && f.EntityType == entityType);
        if (!isSupported)
            throw new ArgumentException($"Export format '{format}' is not supported for entity type '{entityType}'");

        logger.LogInformation("Exporting {EntityType} in {Format} format", entityType, format);

        return (format, entityType) switch
        {
            // QuickBooks Desktop IIF
            (ExportFormat.QuickBooksDesktop, ExportEntityType.ChartOfAccounts) => await ExportChartOfAccountsIifAsync(options, ct),
            (ExportFormat.QuickBooksDesktop, ExportEntityType.JournalEntries) => await ExportJournalEntriesIifAsync(options, ct),
            (ExportFormat.QuickBooksDesktop, ExportEntityType.Vendors) => await ExportVendorsIifAsync(options, ct),
            (ExportFormat.QuickBooksDesktop, ExportEntityType.Customers) => await ExportCustomersIifAsync(options, ct),
            (ExportFormat.QuickBooksDesktop, ExportEntityType.TimeEntries) => await ExportTimeEntriesIifAsync(options, ct),

            // QuickBooks Online CSV
            (ExportFormat.QuickBooksOnline, ExportEntityType.ChartOfAccounts) => await ExportChartOfAccountsQboCsvAsync(options, ct),
            (ExportFormat.QuickBooksOnline, ExportEntityType.JournalEntries) => await ExportJournalEntriesQboCsvAsync(options, ct),
            (ExportFormat.QuickBooksOnline, ExportEntityType.Vendors) => await ExportVendorsQboCsvAsync(options, ct),
            (ExportFormat.QuickBooksOnline, ExportEntityType.Customers) => await ExportCustomersQboCsvAsync(options, ct),
            (ExportFormat.QuickBooksOnline, ExportEntityType.Employees) => await ExportEmployeesQboCsvAsync(options, ct),

            // ADP Payroll CSV
            (ExportFormat.AdpPayroll, ExportEntityType.Employees) => await ExportEmployeesAdpCsvAsync(options, ct),
            (ExportFormat.AdpPayroll, ExportEntityType.PayrollRuns) => await ExportPayrollRunsAdpCsvAsync(options, ct),
            (ExportFormat.AdpPayroll, ExportEntityType.TimeEntries) => await ExportTimeEntriesAdpCsvAsync(options, ct),

            // Generic CSV
            (ExportFormat.GenericCsv, ExportEntityType.ChartOfAccounts) => await ExportChartOfAccountsGenericCsvAsync(options, ct),
            (ExportFormat.GenericCsv, ExportEntityType.JournalEntries) => await ExportJournalEntriesGenericCsvAsync(options, ct),
            (ExportFormat.GenericCsv, ExportEntityType.Employees) => await ExportEmployeesGenericCsvAsync(options, ct),
            (ExportFormat.GenericCsv, ExportEntityType.TimeEntries) => await ExportTimeEntriesGenericCsvAsync(options, ct),
            (ExportFormat.GenericCsv, ExportEntityType.PayrollRuns) => await ExportPayrollRunsGenericCsvAsync(options, ct),
            (ExportFormat.GenericCsv, ExportEntityType.Vendors) => await ExportVendorsGenericCsvAsync(options, ct),
            (ExportFormat.GenericCsv, ExportEntityType.Customers) => await ExportCustomersGenericCsvAsync(options, ct),

            _ => throw new ArgumentException($"Export format '{format}' is not supported for entity type '{entityType}'")
        };
    }

    // ─── QuickBooks Desktop IIF ───────────────────────────────────────

    private async Task<ExportResult> ExportChartOfAccountsIifAsync(ExportOptions options, CancellationToken ct)
    {
        var accounts = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.AccountNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("!ACCNT\tNAME\tACCNTTYPE\tDESC\tACCNUM");

        foreach (var a in accounts)
        {
            sb.Append("ACCNT\t");
            sb.Append(IifEscape(a.AccountName));
            sb.Append('\t');
            sb.Append(MapAccountTypeToQb(a.AccountType));
            sb.Append('\t');
            sb.Append(IifEscape(a.Description));
            sb.Append('\t');
            sb.AppendLine(IifEscape(a.AccountNumber));
        }

        return BuildIifResult("chart-of-accounts", sb, accounts.Count);
    }

    private async Task<ExportResult> ExportJournalEntriesIifAsync(ExportOptions options, CancellationToken ct)
    {
        var query = db.Set<JournalEntry>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => !x.IsDeleted);

        if (options.DateFrom.HasValue)
            query = query.Where(x => x.EntryDate >= options.DateFrom.Value);
        if (options.DateTo.HasValue)
            query = query.Where(x => x.EntryDate <= options.DateTo.Value);
        if (!string.IsNullOrWhiteSpace(options.Status) && Enum.TryParse<JournalEntryStatus>(options.Status, true, out var status))
            query = query.Where(x => x.Status == status);

        var entries = await query.OrderBy(x => x.EntryDate).ToListAsync(ct);

        // Pre-load GL account names for the lines
        var accountIds = entries.SelectMany(e => e.Lines).Select(l => l.GlAccountId).Distinct().ToList();
        var accountMap = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(a => accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.AccountName, ct);

        var sb = new StringBuilder();
        sb.AppendLine("!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tMEMO");
        sb.AppendLine("!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tMEMO");
        sb.AppendLine("!ENDTRNS");

        foreach (var je in entries)
        {
            var sortedLines = je.Lines.OrderBy(l => l.LineNumber).ToList();
            if (sortedLines.Count == 0) continue;

            var firstLine = sortedLines[0];
            var accountName = accountMap.GetValueOrDefault(firstLine.GlAccountId, "Unknown");
            var amount = firstLine.DebitAmount > 0 ? firstLine.DebitAmount : -firstLine.CreditAmount;

            sb.Append("TRNS\t");
            sb.Append(IifEscape(je.EntryNumber));
            sb.Append("\tGENERAL JOURNAL\t");
            sb.Append(je.EntryDate.ToString("MM/dd/yyyy"));
            sb.Append('\t');
            sb.Append(IifEscape(accountName));
            sb.Append('\t');
            sb.Append(amount.ToString("F2", CultureInfo.InvariantCulture));
            sb.Append('\t');
            sb.AppendLine(IifEscape(je.Description));

            foreach (var line in sortedLines.Skip(1))
            {
                accountName = accountMap.GetValueOrDefault(line.GlAccountId, "Unknown");
                amount = line.DebitAmount > 0 ? line.DebitAmount : -line.CreditAmount;

                sb.Append("SPL\t");
                sb.Append(IifEscape(je.EntryNumber + "-" + line.LineNumber));
                sb.Append("\tGENERAL JOURNAL\t");
                sb.Append(je.EntryDate.ToString("MM/dd/yyyy"));
                sb.Append('\t');
                sb.Append(IifEscape(accountName));
                sb.Append('\t');
                sb.Append(amount.ToString("F2", CultureInfo.InvariantCulture));
                sb.Append('\t');
                sb.AppendLine(IifEscape(line.Description));
            }

            sb.AppendLine("ENDTRNS");
        }

        return BuildIifResult("journal-entries", sb, entries.Count);
    }

    private async Task<ExportResult> ExportVendorsIifAsync(ExportOptions options, CancellationToken ct)
    {
        var vendors = await db.Set<Vendor>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("!VEND\tNAME\tADDR1\tADDR2\tCITY\tSTATE\tZIP\tPHONE\tEMAIL");

        foreach (var v in vendors)
        {
            sb.Append("VEND\t");
            sb.Append(IifEscape(v.Name));
            sb.Append('\t');
            sb.Append(IifEscape(v.Address));
            sb.Append('\t');
            sb.Append('\t'); // ADDR2 — not tracked
            sb.Append(IifEscape(v.City));
            sb.Append('\t');
            sb.Append(IifEscape(v.State));
            sb.Append('\t');
            sb.Append(IifEscape(v.Zip));
            sb.Append('\t');
            sb.Append(IifEscape(v.Phone));
            sb.Append('\t');
            sb.AppendLine(IifEscape(v.ContactEmail));
        }

        return BuildIifResult("vendors", sb, vendors.Count);
    }

    private async Task<ExportResult> ExportCustomersIifAsync(ExportOptions options, CancellationToken ct)
    {
        var customers = await db.Set<Customer>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("!CUST\tNAME\tADDR1\tADDR2\tCITY\tSTATE\tZIP\tPHONE\tEMAIL");

        foreach (var c in customers)
        {
            sb.Append("CUST\t");
            sb.Append(IifEscape(c.Name));
            sb.Append('\t');
            sb.Append(IifEscape(c.Address));
            sb.Append('\t');
            sb.Append('\t'); // ADDR2 — not tracked
            sb.Append(IifEscape(c.City));
            sb.Append('\t');
            sb.Append(IifEscape(c.State));
            sb.Append('\t');
            sb.Append(IifEscape(c.Zip));
            sb.Append('\t');
            sb.Append(IifEscape(c.Phone));
            sb.Append('\t');
            sb.AppendLine(IifEscape(c.ContactEmail));
        }

        return BuildIifResult("customers", sb, customers.Count);
    }

    private async Task<ExportResult> ExportTimeEntriesIifAsync(ExportOptions options, CancellationToken ct)
    {
        var query = db.Set<TimeEntry>()
            .AsNoTracking()
            .Include(x => x.Employee)
            .Include(x => x.Project)
            .Include(x => x.CostCode)
            .Where(x => !x.IsDeleted);

        query = ApplyTimeEntryFilters(query, options);

        var entries = await query.OrderBy(x => x.Date).ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("!TIMEACT\tDATE\tJOB\tEMP\tITEM\tDURATION\tNOTE");

        foreach (var te in entries)
        {
            sb.Append("TIMEACT\t");
            sb.Append(te.Date.ToString("MM/dd/yyyy"));
            sb.Append('\t');
            sb.Append(IifEscape(te.Project?.Name));
            sb.Append('\t');
            sb.Append(IifEscape(te.Employee?.FullName));
            sb.Append('\t');
            sb.Append(IifEscape(te.CostCode?.Code));
            sb.Append('\t');
            sb.Append(te.TotalHours.ToString("F2", CultureInfo.InvariantCulture));
            sb.Append('\t');
            sb.AppendLine(IifEscape(te.Description));
        }

        return BuildIifResult("time-entries", sb, entries.Count);
    }

    // ─── QuickBooks Online CSV ────────────────────────────────────────

    private async Task<ExportResult> ExportChartOfAccountsQboCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var accounts = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.AccountNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Account Name,Account Type,Detail Type,Description,Account Number");

        foreach (var a in accounts)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(a.AccountName),
                CsvEscape(MapAccountTypeToQb(a.AccountType)),
                CsvEscape(MapAccountTypeToQbDetailType(a.AccountType)),
                CsvEscape(a.Description),
                CsvEscape(a.AccountNumber)));
        }

        return BuildCsvResult("chart-of-accounts-qbo", sb, accounts.Count);
    }

    private async Task<ExportResult> ExportJournalEntriesQboCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var query = db.Set<JournalEntry>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => !x.IsDeleted);

        if (options.DateFrom.HasValue)
            query = query.Where(x => x.EntryDate >= options.DateFrom.Value);
        if (options.DateTo.HasValue)
            query = query.Where(x => x.EntryDate <= options.DateTo.Value);
        if (!string.IsNullOrWhiteSpace(options.Status) && Enum.TryParse<JournalEntryStatus>(options.Status, true, out var status))
            query = query.Where(x => x.Status == status);

        var entries = await query.OrderBy(x => x.EntryDate).ToListAsync(ct);

        var accountIds = entries.SelectMany(e => e.Lines).Select(l => l.GlAccountId).Distinct().ToList();
        var accountMap = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(a => accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.AccountName, ct);

        var sb = new StringBuilder();
        sb.AppendLine("Journal No,Journal Date,Account,Debits,Credits,Description,Name");

        var rowCount = 0;
        foreach (var je in entries)
        {
            foreach (var line in je.Lines.OrderBy(l => l.LineNumber))
            {
                var accountName = accountMap.GetValueOrDefault(line.GlAccountId, "Unknown");
                sb.AppendLine(string.Join(",",
                    CsvEscape(je.EntryNumber),
                    CsvEscape(je.EntryDate.ToString("MM/dd/yyyy")),
                    CsvEscape(accountName),
                    line.DebitAmount.ToString("F2", CultureInfo.InvariantCulture),
                    line.CreditAmount.ToString("F2", CultureInfo.InvariantCulture),
                    CsvEscape(line.Description ?? je.Description),
                    CsvEscape(je.SourceDocumentRef)));
                rowCount++;
            }
        }

        return BuildCsvResult("journal-entries-qbo", sb, rowCount);
    }

    private async Task<ExportResult> ExportVendorsQboCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var vendors = await db.Set<Vendor>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Name,Company,Email,Phone,Street,City,State,ZIP,Terms");

        foreach (var v in vendors)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(v.Name),
                CsvEscape(v.Name),
                CsvEscape(v.ContactEmail),
                CsvEscape(v.Phone),
                CsvEscape(v.Address),
                CsvEscape(v.City),
                CsvEscape(v.State),
                CsvEscape(v.Zip),
                CsvEscape(v.PaymentTerms)));
        }

        return BuildCsvResult("vendors-qbo", sb, vendors.Count);
    }

    private async Task<ExportResult> ExportCustomersQboCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var customers = await db.Set<Customer>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Name,Company,Email,Phone,Street,City,State,ZIP,Terms");

        foreach (var c in customers)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(c.Name),
                CsvEscape(c.Name),
                CsvEscape(c.ContactEmail),
                CsvEscape(c.Phone),
                CsvEscape(c.Address),
                CsvEscape(c.City),
                CsvEscape(c.State),
                CsvEscape(c.Zip),
                CsvEscape(c.PaymentTerms)));
        }

        return BuildCsvResult("customers-qbo", sb, customers.Count);
    }

    private async Task<ExportResult> ExportEmployeesQboCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var employees = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.EmployeeNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Employee Name,First Name,Last Name,Email,Employee ID,Hire Date");

        foreach (var e in employees)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(e.FullName),
                CsvEscape(e.FirstName),
                CsvEscape(e.LastName),
                CsvEscape(e.Email),
                CsvEscape(e.EmployeeNumber),
                CsvEscape(e.HireDate?.ToString("MM/dd/yyyy"))));
        }

        return BuildCsvResult("employees-qbo", sb, employees.Count);
    }

    // ─── ADP Payroll CSV ──────────────────────────────────────────────

    private async Task<ExportResult> ExportEmployeesAdpCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var employees = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.EmployeeNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("CO_CODE,BATCH_ID,FILE_NUMBER,EMPLOYEE_NAME,REG_HOURS,OT_HOURS,RATE");

        foreach (var e in employees)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(company.CompanyCode),
                CsvEscape("BATCH001"),
                CsvEscape(e.EmployeeNumber),
                CsvEscape(e.FullName),
                "0.00",
                "0.00",
                e.BaseHourlyRate.ToString("F2", CultureInfo.InvariantCulture)));
        }

        return BuildCsvResult("employees-adp", sb, employees.Count);
    }

    private async Task<ExportResult> ExportPayrollRunsAdpCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var query = db.Set<PayrollRun>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => !x.IsDeleted);

        if (options.DateFrom.HasValue)
            query = query.Where(x => x.RunDate >= options.DateFrom.Value);
        if (options.DateTo.HasValue)
            query = query.Where(x => x.RunDate <= options.DateTo.Value);

        var runs = await query.OrderBy(x => x.RunDate).ToListAsync(ct);

        // Pre-load employee numbers
        var employeeIds = runs.SelectMany(r => r.Lines).Select(l => l.EmployeeId).Distinct().ToList();
        var employeeMap = await db.Set<Employee>()
            .AsNoTracking()
            .Where(e => employeeIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => new { e.EmployeeNumber, e.FullName, e.BaseHourlyRate }, ct);

        var sb = new StringBuilder();
        sb.AppendLine("CO_CODE,BATCH_ID,FILE_NUMBER,EMPLOYEE_NAME,REG_HOURS,OT_HOURS,RATE");

        var rowCount = 0;
        foreach (var run in runs)
        {
            var batchId = $"PR-{run.RunDate:yyyyMMdd}";
            foreach (var line in run.Lines)
            {
                var emp = employeeMap.GetValueOrDefault(line.EmployeeId);
                sb.AppendLine(string.Join(",",
                    CsvEscape(company.CompanyCode),
                    CsvEscape(batchId),
                    CsvEscape(emp?.EmployeeNumber ?? string.Empty),
                    CsvEscape(emp?.FullName ?? string.Empty),
                    line.RegularHours.ToString("F2", CultureInfo.InvariantCulture),
                    line.OvertimeHours.ToString("F2", CultureInfo.InvariantCulture),
                    (emp?.BaseHourlyRate ?? 0).ToString("F2", CultureInfo.InvariantCulture)));
                rowCount++;
            }
        }

        return BuildCsvResult("payroll-runs-adp", sb, rowCount);
    }

    private async Task<ExportResult> ExportTimeEntriesAdpCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var query = db.Set<TimeEntry>()
            .AsNoTracking()
            .Include(x => x.Employee)
            .Where(x => !x.IsDeleted);

        query = ApplyTimeEntryFilters(query, options);

        var entries = await query.OrderBy(x => x.Date).ThenBy(x => x.Employee!.EmployeeNumber).ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("CO_CODE,BATCH_ID,FILE_NUMBER,EMPLOYEE_NAME,REG_HOURS,OT_HOURS,RATE");

        foreach (var te in entries)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(company.CompanyCode),
                CsvEscape($"TE-{te.Date:yyyyMMdd}"),
                CsvEscape(te.Employee?.EmployeeNumber),
                CsvEscape(te.Employee?.FullName),
                te.RegularHours.ToString("F2", CultureInfo.InvariantCulture),
                te.OvertimeHours.ToString("F2", CultureInfo.InvariantCulture),
                (te.Employee?.BaseHourlyRate ?? 0).ToString("F2", CultureInfo.InvariantCulture)));
        }

        return BuildCsvResult("time-entries-adp", sb, entries.Count);
    }

    // ─── Generic CSV ──────────────────────────────────────────────────

    private async Task<ExportResult> ExportChartOfAccountsGenericCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var accounts = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.AccountNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("AccountNumber,AccountName,AccountType,Description,NormalBalance,IsActive");

        foreach (var a in accounts)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(a.AccountNumber),
                CsvEscape(a.AccountName),
                CsvEscape(a.AccountType.ToString()),
                CsvEscape(a.Description),
                CsvEscape(a.NormalBalance.ToString()),
                a.IsActive.ToString()));
        }

        return BuildCsvResult("chart-of-accounts", sb, accounts.Count);
    }

    private async Task<ExportResult> ExportJournalEntriesGenericCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var query = db.Set<JournalEntry>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => !x.IsDeleted);

        if (options.DateFrom.HasValue)
            query = query.Where(x => x.EntryDate >= options.DateFrom.Value);
        if (options.DateTo.HasValue)
            query = query.Where(x => x.EntryDate <= options.DateTo.Value);
        if (!string.IsNullOrWhiteSpace(options.Status) && Enum.TryParse<JournalEntryStatus>(options.Status, true, out var status))
            query = query.Where(x => x.Status == status);

        var entries = await query.OrderBy(x => x.EntryDate).ToListAsync(ct);

        var accountIds = entries.SelectMany(e => e.Lines).Select(l => l.GlAccountId).Distinct().ToList();
        var accountMap = await db.Set<ChartOfAccount>()
            .AsNoTracking()
            .Where(a => accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.AccountName, ct);

        var sb = new StringBuilder();
        sb.AppendLine("EntryNumber,EntryDate,Status,LineNumber,AccountName,DebitAmount,CreditAmount,Description");

        var rowCount = 0;
        foreach (var je in entries)
        {
            foreach (var line in je.Lines.OrderBy(l => l.LineNumber))
            {
                var accountName = accountMap.GetValueOrDefault(line.GlAccountId, "Unknown");
                sb.AppendLine(string.Join(",",
                    CsvEscape(je.EntryNumber),
                    CsvEscape(je.EntryDate.ToString("yyyy-MM-dd")),
                    CsvEscape(je.Status.ToString()),
                    line.LineNumber.ToString(),
                    CsvEscape(accountName),
                    line.DebitAmount.ToString("F2", CultureInfo.InvariantCulture),
                    line.CreditAmount.ToString("F2", CultureInfo.InvariantCulture),
                    CsvEscape(line.Description ?? je.Description)));
                rowCount++;
            }
        }

        return BuildCsvResult("journal-entries", sb, rowCount);
    }

    private async Task<ExportResult> ExportEmployeesGenericCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var employees = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.EmployeeNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("EmployeeNumber,FirstName,LastName,Email,Phone,Title,Classification,BaseHourlyRate,HireDate,IsActive");

        foreach (var e in employees)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(e.EmployeeNumber),
                CsvEscape(e.FirstName),
                CsvEscape(e.LastName),
                CsvEscape(e.Email),
                CsvEscape(e.Phone),
                CsvEscape(e.Title),
                CsvEscape(e.Classification.ToString()),
                e.BaseHourlyRate.ToString("F2", CultureInfo.InvariantCulture),
                CsvEscape(e.HireDate?.ToString("yyyy-MM-dd")),
                e.IsActive.ToString()));
        }

        return BuildCsvResult("employees", sb, employees.Count);
    }

    private async Task<ExportResult> ExportTimeEntriesGenericCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var query = db.Set<TimeEntry>()
            .AsNoTracking()
            .Include(x => x.Employee)
            .Include(x => x.Project)
            .Include(x => x.CostCode)
            .Where(x => !x.IsDeleted);

        query = ApplyTimeEntryFilters(query, options);

        var entries = await query.OrderBy(x => x.Date).ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Date,EmployeeNumber,EmployeeName,ProjectNumber,ProjectName,CostCode,RegularHours,OvertimeHours,DoubletimeHours,TotalHours,Status,Description");

        foreach (var te in entries)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(te.Date.ToString("yyyy-MM-dd")),
                CsvEscape(te.Employee?.EmployeeNumber),
                CsvEscape(te.Employee?.FullName),
                CsvEscape(te.Project?.Number),
                CsvEscape(te.Project?.Name),
                CsvEscape(te.CostCode?.Code),
                te.RegularHours.ToString("F2", CultureInfo.InvariantCulture),
                te.OvertimeHours.ToString("F2", CultureInfo.InvariantCulture),
                te.DoubletimeHours.ToString("F2", CultureInfo.InvariantCulture),
                te.TotalHours.ToString("F2", CultureInfo.InvariantCulture),
                CsvEscape(te.Status.ToString()),
                CsvEscape(te.Description)));
        }

        return BuildCsvResult("time-entries", sb, entries.Count);
    }

    private async Task<ExportResult> ExportPayrollRunsGenericCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var query = db.Set<PayrollRun>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => !x.IsDeleted);

        if (options.DateFrom.HasValue)
            query = query.Where(x => x.RunDate >= options.DateFrom.Value);
        if (options.DateTo.HasValue)
            query = query.Where(x => x.RunDate <= options.DateTo.Value);

        var runs = await query.OrderBy(x => x.RunDate).ToListAsync(ct);

        var employeeIds = runs.SelectMany(r => r.Lines).Select(l => l.EmployeeId).Distinct().ToList();
        var employeeMap = await db.Set<Employee>()
            .AsNoTracking()
            .Where(e => employeeIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => new { e.EmployeeNumber, e.FullName }, ct);

        var sb = new StringBuilder();
        sb.AppendLine("RunDate,Status,EmployeeNumber,EmployeeName,RegularHours,OvertimeHours,DoubletimeHours,RegularPay,OvertimePay,DoubletimePay,GrossPay");

        var rowCount = 0;
        foreach (var run in runs)
        {
            foreach (var line in run.Lines)
            {
                var emp = employeeMap.GetValueOrDefault(line.EmployeeId);
                sb.AppendLine(string.Join(",",
                    CsvEscape(run.RunDate.ToString("yyyy-MM-dd")),
                    CsvEscape(run.Status.ToString()),
                    CsvEscape(emp?.EmployeeNumber ?? string.Empty),
                    CsvEscape(emp?.FullName ?? string.Empty),
                    line.RegularHours.ToString("F2", CultureInfo.InvariantCulture),
                    line.OvertimeHours.ToString("F2", CultureInfo.InvariantCulture),
                    line.DoubletimeHours.ToString("F2", CultureInfo.InvariantCulture),
                    line.RegularPay.ToString("F2", CultureInfo.InvariantCulture),
                    line.OvertimePay.ToString("F2", CultureInfo.InvariantCulture),
                    line.DoubletimePay.ToString("F2", CultureInfo.InvariantCulture),
                    line.GrossPay.ToString("F2", CultureInfo.InvariantCulture)));
                rowCount++;
            }
        }

        return BuildCsvResult("payroll-runs", sb, rowCount);
    }

    private async Task<ExportResult> ExportVendorsGenericCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var vendors = await db.Set<Vendor>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Code,Name,ContactName,ContactEmail,Phone,Address,City,State,Zip,PaymentTerms,TaxId");

        foreach (var v in vendors)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(v.Code),
                CsvEscape(v.Name),
                CsvEscape(v.ContactName),
                CsvEscape(v.ContactEmail),
                CsvEscape(v.Phone),
                CsvEscape(v.Address),
                CsvEscape(v.City),
                CsvEscape(v.State),
                CsvEscape(v.Zip),
                CsvEscape(v.PaymentTerms),
                CsvEscape(v.TaxId)));
        }

        return BuildCsvResult("vendors", sb, vendors.Count);
    }

    private async Task<ExportResult> ExportCustomersGenericCsvAsync(ExportOptions options, CancellationToken ct)
    {
        var customers = await db.Set<Customer>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Code,Name,ContactName,ContactEmail,Phone,Address,City,State,Zip,PaymentTerms,CreditLimit");

        foreach (var c in customers)
        {
            sb.AppendLine(string.Join(",",
                CsvEscape(c.Code),
                CsvEscape(c.Name),
                CsvEscape(c.ContactName),
                CsvEscape(c.ContactEmail),
                CsvEscape(c.Phone),
                CsvEscape(c.Address),
                CsvEscape(c.City),
                CsvEscape(c.State),
                CsvEscape(c.Zip),
                CsvEscape(c.PaymentTerms),
                c.CreditLimit?.ToString("F2", CultureInfo.InvariantCulture) ?? string.Empty));
        }

        return BuildCsvResult("customers", sb, customers.Count);
    }

    // ─── Shared Helpers ───────────────────────────────────────────────

    private static IQueryable<TimeEntry> ApplyTimeEntryFilters(IQueryable<TimeEntry> query, ExportOptions options)
    {
        if (options.DateFrom.HasValue)
            query = query.Where(x => x.Date >= options.DateFrom.Value);
        if (options.DateTo.HasValue)
            query = query.Where(x => x.Date <= options.DateTo.Value);
        if (options.ProjectId.HasValue)
            query = query.Where(x => x.ProjectId == options.ProjectId.Value);
        if (!string.IsNullOrWhiteSpace(options.Status) && Enum.TryParse<TimeEntryStatus>(options.Status, true, out var teStatus))
            query = query.Where(x => x.Status == teStatus);
        return query;
    }

    private static ExportResult BuildIifResult(string entityName, StringBuilder sb, int rowCount)
    {
        var content = Encoding.UTF8.GetBytes(sb.ToString());
        return new ExportResult(
            $"{entityName}-{DateTime.UtcNow:yyyyMMdd}.iif",
            "application/x-iif",
            content,
            rowCount);
    }

    private static ExportResult BuildCsvResult(string entityName, StringBuilder sb, int rowCount)
    {
        var content = Encoding.UTF8.GetBytes(sb.ToString());
        return new ExportResult(
            $"{entityName}-{DateTime.UtcNow:yyyyMMdd}.csv",
            "text/csv",
            content,
            rowCount);
    }

    /// <summary>
    /// CSV field escaping with formula injection prevention.
    /// Matches the pattern in DataExportService.
    /// </summary>
    public static string CsvEscape(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        var escaped = value;

        // Prevent CSV formula injection: prefix formula-triggering chars with a single quote
        if (escaped.Length > 0 && escaped[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
            escaped = "'" + escaped;

        escaped = escaped.Replace("\"", "\"\"");
        if (escaped.Contains(',') || escaped.Contains('"') || escaped.Contains('\n') || escaped.Contains('\r'))
            return $"\"{escaped}\"";

        return escaped;
    }

    /// <summary>
    /// IIF values must not contain tabs (the delimiter) or newlines.
    /// </summary>
    private static string IifEscape(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        return value.Replace("\t", " ").Replace("\r", " ").Replace("\n", " ");
    }

    private static string MapAccountTypeToQb(AccountType accountType) => accountType switch
    {
        AccountType.Asset => "Bank",
        AccountType.Liability => "Other Current Liability",
        AccountType.Equity => "Equity",
        AccountType.Revenue => "Income",
        AccountType.Expense => "Expense",
        _ => "Expense"
    };

    private static string MapAccountTypeToQbDetailType(AccountType accountType) => accountType switch
    {
        AccountType.Asset => "Checking",
        AccountType.Liability => "Other Current Liabilities",
        AccountType.Equity => "Opening Balance Equity",
        AccountType.Revenue => "Sales of Product Income",
        AccountType.Expense => "Other Miscellaneous Service Cost",
        _ => "Other Miscellaneous Service Cost"
    };
}
