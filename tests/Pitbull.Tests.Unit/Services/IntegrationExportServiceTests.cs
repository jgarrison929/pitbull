using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Services;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Tests.Unit.Services;

public class IntegrationExportServiceTests
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;
    private static readonly Guid TestCompanyId = TestDbContextFactory.TestCompanyId;

    // ─── CSV Escaping ─────────────────────────────────────────────────

    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("simple", "simple")]
    [InlineData("has,comma", "\"has,comma\"")]
    [InlineData("has\"quote", "\"has\"\"quote\"")]
    [InlineData("has\nnewline", "\"has\nnewline\"")]
    [InlineData("=SUM(A1)", "'=SUM(A1)")]
    [InlineData("+cmd", "'+cmd")]
    [InlineData("-cmd", "'-cmd")]
    [InlineData("@cmd", "'@cmd")]
    [InlineData("\tcmd", "'\tcmd")]
    [InlineData("\rcmd", "\"'\rcmd\"")]
    public void CsvEscape_HandlesFormulaInjectionAndSpecialChars(string? input, string expected)
    {
        IntegrationExportService.CsvEscape(input).Should().Be(expected);
    }

    // ─── GetSupportedFormats ──────────────────────────────────────────

    [Fact]
    public void GetSupportedFormats_ReturnsNonEmptyList()
    {
        var service = CreateService();
        var formats = service.GetSupportedFormats();
        formats.Should().NotBeEmpty();
        formats.Should().Contain(f => f.Format == ExportFormat.QuickBooksDesktop);
        formats.Should().Contain(f => f.Format == ExportFormat.QuickBooksOnline);
        formats.Should().Contain(f => f.Format == ExportFormat.AdpPayroll);
        formats.Should().Contain(f => f.Format == ExportFormat.GenericCsv);
    }

    // ─── Unsupported format/entity combos ─────────────────────────────

    [Fact]
    public async Task ExportAsync_UnsupportedCombo_ThrowsArgumentException()
    {
        var service = CreateService();

        var act = () => service.ExportAsync(
            ExportEntityType.PayrollRuns,
            ExportFormat.QuickBooksDesktop,
            new ExportOptions(),
            CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*not supported*");
    }

    // ─── Generic CSV — Chart of Accounts ──────────────────────────────

    [Fact]
    public async Task ExportChartOfAccounts_GenericCsv_EmptyData_ReturnsHeadersOnly()
    {
        var service = CreateService();

        var result = await service.ExportAsync(
            ExportEntityType.ChartOfAccounts,
            ExportFormat.GenericCsv,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(0);
        result.ContentType.Should().Be("text/csv");
        result.FileName.Should().EndWith(".csv");

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().StartWith("AccountNumber,AccountName");
    }

    [Fact]
    public async Task ExportChartOfAccounts_GenericCsv_WithData_ReturnsCorrectRows()
    {
        using var db = TestDbContextFactory.Create();
        SeedChartOfAccounts(db);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.ChartOfAccounts,
            ExportFormat.GenericCsv,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("1000");
        content.Should().Contain("Cash");
        content.Should().Contain("2000");
        content.Should().Contain("Accounts Payable");
    }

    // ─── Generic CSV — Employees ──────────────────────────────────────

    [Fact]
    public async Task ExportEmployees_GenericCsv_WithData_ReturnsCorrectRows()
    {
        using var db = TestDbContextFactory.Create();
        SeedEmployees(db);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.Employees,
            ExportFormat.GenericCsv,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("EMP-001");
        content.Should().Contain("John");
        content.Should().Contain("EMP-002");
        content.Should().Contain("Jane");
    }

    // ─── Generic CSV — Vendors ────────────────────────────────────────

    [Fact]
    public async Task ExportVendors_GenericCsv_WithData_ReturnsCorrectRows()
    {
        using var db = TestDbContextFactory.Create();
        SeedVendors(db);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.Vendors,
            ExportFormat.GenericCsv,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("ACME");
        content.Should().Contain("BuildCorp");
    }

    // ─── Generic CSV — Customers ──────────────────────────────────────

    [Fact]
    public async Task ExportCustomers_GenericCsv_WithData_ReturnsCorrectRows()
    {
        using var db = TestDbContextFactory.Create();
        SeedCustomers(db);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.Customers,
            ExportFormat.GenericCsv,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(1);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("CUST-001");
        content.Should().Contain("Big Owner LLC");
    }

    // ─── Generic CSV — Time Entries with Date Filter ──────────────────

    [Fact]
    public async Task ExportTimeEntries_GenericCsv_DateFilter_FiltersCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var (projectId, costCodeId, employeeId) = SeedTimeEntryDependencies(db);
        SeedTimeEntries(db, projectId, costCodeId, employeeId);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.TimeEntries,
            ExportFormat.GenericCsv,
            new ExportOptions
            {
                DateFrom = new DateOnly(2026, 1, 15),
                DateTo = new DateOnly(2026, 1, 15)
            },
            CancellationToken.None);

        result.RowCount.Should().Be(1);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("2026-01-15");
        content.Should().NotContain("2026-01-10");
    }

    // ─── QuickBooks Desktop IIF — Chart of Accounts ───────────────────

    [Fact]
    public async Task ExportChartOfAccounts_IIF_WithData_ReturnsTabDelimited()
    {
        using var db = TestDbContextFactory.Create();
        SeedChartOfAccounts(db);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.ChartOfAccounts,
            ExportFormat.QuickBooksDesktop,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);
        result.ContentType.Should().Be("application/x-iif");
        result.FileName.Should().EndWith(".iif");

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("!ACCNT\tNAME\tACCNTTYPE\tDESC\tACCNUM");
        content.Should().Contain("ACCNT\tCash");
        content.Should().Contain("ACCNT\tAccounts Payable");
    }

    [Fact]
    public async Task ExportChartOfAccounts_IIF_EmptyData_ReturnsHeadersOnly()
    {
        var service = CreateService();

        var result = await service.ExportAsync(
            ExportEntityType.ChartOfAccounts,
            ExportFormat.QuickBooksDesktop,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(0);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("!ACCNT");
        // Should contain only the header line
        content.Trim().Split('\n').Should().HaveCount(1);
    }

    // ─── QuickBooks Desktop IIF — Vendors ─────────────────────────────

    [Fact]
    public async Task ExportVendors_IIF_WithData_ReturnsCorrectFormat()
    {
        using var db = TestDbContextFactory.Create();
        SeedVendors(db);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.Vendors,
            ExportFormat.QuickBooksDesktop,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("!VEND\tNAME");
        content.Should().Contain("VEND\tACME Supplies");
    }

    // ─── QuickBooks Online CSV — Chart of Accounts ────────────────────

    [Fact]
    public async Task ExportChartOfAccounts_QBO_WithData_ReturnsCorrectColumns()
    {
        using var db = TestDbContextFactory.Create();
        SeedChartOfAccounts(db);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.ChartOfAccounts,
            ExportFormat.QuickBooksOnline,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("Account Name,Account Type,Detail Type,Description,Account Number");
    }

    // ─── ADP Payroll CSV — Employees ──────────────────────────────────

    [Fact]
    public async Task ExportEmployees_ADP_WithData_ReturnsAdpColumns()
    {
        using var db = TestDbContextFactory.Create();
        SeedEmployees(db);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.Employees,
            ExportFormat.AdpPayroll,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("CO_CODE,BATCH_ID,FILE_NUMBER,EMPLOYEE_NAME,REG_HOURS,OT_HOURS,RATE");
        content.Should().Contain("EMP-001");
        content.Should().Contain("EMP-002");
    }

    // ─── ADP Payroll CSV — Time Entries ───────────────────────────────

    [Fact]
    public async Task ExportTimeEntries_ADP_WithData_ReturnsAdpFormat()
    {
        using var db = TestDbContextFactory.Create();
        var (projectId, costCodeId, employeeId) = SeedTimeEntryDependencies(db);
        SeedTimeEntries(db, projectId, costCodeId, employeeId);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.TimeEntries,
            ExportFormat.AdpPayroll,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("CO_CODE");
        content.Should().Contain("8.00");
    }

    // ─── QuickBooks Desktop IIF — Time Entries ────────────────────────

    [Fact]
    public async Task ExportTimeEntries_IIF_WithData_ReturnsTimeActFormat()
    {
        using var db = TestDbContextFactory.Create();
        var (projectId, costCodeId, employeeId) = SeedTimeEntryDependencies(db);
        SeedTimeEntries(db, projectId, costCodeId, employeeId);

        var service = CreateService(db);

        var result = await service.ExportAsync(
            ExportEntityType.TimeEntries,
            ExportFormat.QuickBooksDesktop,
            new ExportOptions(),
            CancellationToken.None);

        result.RowCount.Should().Be(2);

        var content = Encoding.UTF8.GetString(result.Content);
        content.Should().Contain("!TIMEACT\tDATE\tJOB\tEMP\tITEM\tDURATION\tNOTE");
        content.Should().Contain("TIMEACT\t");
    }

    // ─── Seed Helpers ─────────────────────────────────────────────────

    private static void SeedChartOfAccounts(Core.Data.PitbullDbContext db)
    {
        db.Set<ChartOfAccount>().AddRange(
            new ChartOfAccount
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                AccountNumber = "1000",
                AccountName = "Cash",
                AccountType = AccountType.Asset,
                NormalBalance = NormalBalance.Debit,
                IsActive = true
            },
            new ChartOfAccount
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                AccountNumber = "2000",
                AccountName = "Accounts Payable",
                AccountType = AccountType.Liability,
                NormalBalance = NormalBalance.Credit,
                IsActive = true
            });
        db.SaveChanges();
    }

    private static void SeedEmployees(Core.Data.PitbullDbContext db)
    {
        db.Set<Employee>().AddRange(
            new Employee
            {
                TenantId = TestTenantId,
                EmployeeNumber = "EMP-001",
                FirstName = "John",
                LastName = "Smith",
                Email = "john@test.com",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 35.00m,
                IsActive = true,
                HireDate = new DateOnly(2025, 1, 1)
            },
            new Employee
            {
                TenantId = TestTenantId,
                EmployeeNumber = "EMP-002",
                FirstName = "Jane",
                LastName = "Doe",
                Email = "jane@test.com",
                Classification = EmployeeClassification.Salaried,
                BaseHourlyRate = 45.00m,
                IsActive = true,
                HireDate = new DateOnly(2025, 6, 1)
            });
        db.SaveChanges();
    }

    private static void SeedVendors(Core.Data.PitbullDbContext db)
    {
        db.Set<Vendor>().AddRange(
            new Vendor
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                Code = "V-001",
                Name = "ACME Supplies",
                ContactName = "Bob Acme",
                ContactEmail = "bob@acme.com",
                Phone = "555-0100",
                Address = "123 Main St",
                City = "Austin",
                State = "TX",
                Zip = "78701",
                IsActive = true
            },
            new Vendor
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                Code = "V-002",
                Name = "BuildCorp Materials",
                ContactEmail = "info@buildcorp.com",
                IsActive = true
            });
        db.SaveChanges();
    }

    private static void SeedCustomers(Core.Data.PitbullDbContext db)
    {
        db.Set<Customer>().Add(new Customer
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Code = "CUST-001",
            Name = "Big Owner LLC",
            ContactName = "Owner Person",
            ContactEmail = "owner@big.com",
            IsActive = true
        });
        db.SaveChanges();
    }

    private static (Guid projectId, Guid costCodeId, Guid employeeId) SeedTimeEntryDependencies(Core.Data.PitbullDbContext db)
    {
        var projectId = Guid.NewGuid();
        var costCodeId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();

        db.Set<Project>().Add(new Project
        {
            Id = projectId,
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Number = "PRJ-001",
            Name = "Downtown Tower",
            Status = ProjectStatus.Active
        });

        db.Set<CostCode>().Add(new CostCode
        {
            Id = costCodeId,
            TenantId = TestTenantId,
            Code = "01-100",
            Description = "General Conditions",
            Division = "General",
            CostType = CostType.Labor,
            IsActive = true
        });

        db.Set<Employee>().Add(new Employee
        {
            Id = employeeId,
            TenantId = TestTenantId,
            EmployeeNumber = "EMP-010",
            FirstName = "Mike",
            LastName = "Builder",
            Email = "mike@test.com",
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 40.00m,
            IsActive = true
        });

        db.SaveChanges();
        return (projectId, costCodeId, employeeId);
    }

    private static void SeedTimeEntries(Core.Data.PitbullDbContext db, Guid projectId, Guid costCodeId, Guid employeeId)
    {
        db.Set<TimeEntry>().AddRange(
            new TimeEntry
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                Date = new DateOnly(2026, 1, 10),
                EmployeeId = employeeId,
                ProjectId = projectId,
                CostCodeId = costCodeId,
                RegularHours = 8.00m,
                OvertimeHours = 0,
                DoubletimeHours = 0,
                Status = TimeEntryStatus.Approved,
                Description = "Foundation work"
            },
            new TimeEntry
            {
                TenantId = TestTenantId,
                CompanyId = TestCompanyId,
                Date = new DateOnly(2026, 1, 15),
                EmployeeId = employeeId,
                ProjectId = projectId,
                CostCodeId = costCodeId,
                RegularHours = 8.00m,
                OvertimeHours = 2.00m,
                DoubletimeHours = 0,
                Status = TimeEntryStatus.Approved,
                Description = "Framing"
            });
        db.SaveChanges();
    }

    // ─── Service Factory ──────────────────────────────────────────────

    private static IntegrationExportService CreateService(Core.Data.PitbullDbContext? db = null)
    {
        db ??= TestDbContextFactory.Create();
        var companyContext = new CompanyContext
        {
            CompanyId = TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        var logger = NullLogger<IntegrationExportService>.Instance;
        return new IntegrationExportService(db, companyContext, logger);
    }
}
