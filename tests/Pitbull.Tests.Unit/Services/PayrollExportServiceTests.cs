using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.PayrollExports;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Services;

public sealed class PayrollExportServiceTests
{
    [Fact]
    public async Task Generate_NonexistentRun_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var command = new GeneratePayrollExportCommand(
            PayrollRunId: Guid.NewGuid(),
            Format: PayrollExportFormat.Csv,
            StartDate: null,
            EndDate: null);

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Generate_UnapprovedRun_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var run = await SeedPayrollRun(db, PayrollRunStatus.Draft);

        var command = new GeneratePayrollExportCommand(
            PayrollRunId: run.Id,
            Format: PayrollExportFormat.Csv,
            StartDate: null,
            EndDate: null);

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Generate_ApprovedRunWithEntries_CreatesExportAndMarksExported()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, payPeriod, employee, costCode) = await SetupFullPayrollData(db);

        var command = new GeneratePayrollExportCommand(
            PayrollRunId: run.Id,
            Format: PayrollExportFormat.Csv,
            StartDate: null,
            EndDate: null);

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PayrollRunId.Should().Be(run.Id);
        result.Value.Format.Should().Be(PayrollExportFormat.Csv);
        result.Value.FormatName.Should().Be("Csv");
        result.Value.LineCount.Should().BeGreaterThan(0);
        result.Value.TotalGross.Should().BeGreaterThan(0);
        result.Value.FileName.Should().Contain("payroll-");

        // Verify run status updated to Exported
        var updatedRun = db.Set<PayrollRun>().First(r => r.Id == run.Id);
        updatedRun.Status.Should().Be(PayrollRunStatus.Exported);
    }

    [Fact]
    public async Task Generate_NoTimeEntries_StillCreatesExportWithFallbackLines()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var payPeriod = new PayPeriod
        {
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-14)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = PayPeriodStatus.Open,
            Name = "No Entries Period"
        };
        db.Set<PayPeriod>().Add(payPeriod);

        var employee = new Employee
        {
            FirstName = "Jane", LastName = "Welder",
            EmployeeNumber = "EMP-PE-002", Email = "jane@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly, BaseHourlyRate = 42m
        };
        db.Set<Employee>().Add(employee);

        var run = new PayrollRun
        {
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 2000m, TotalNet = 1600m, EmployeeCount = 1
        };
        run.Lines.Add(new PayrollRunLine
        {
            PayrollRunId = run.Id, EmployeeId = employee.Id,
            RegularHours = 40m, OvertimeHours = 0m, DoubletimeHours = 0m,
            RegularPay = 1680m, OvertimePay = 0m, DoubletimePay = 0m, GrossPay = 1680m
        });
        db.Set<PayrollRun>().Add(run);
        await db.SaveChangesAsync();

        var command = new GeneratePayrollExportCommand(
            PayrollRunId: run.Id,
            Format: PayrollExportFormat.Csv,
            StartDate: null,
            EndDate: null);

        var result = await service.GenerateAsync(command);

        // Should succeed with fallback entries from PayrollRunLine data
        result.IsSuccess.Should().BeTrue();
        result.Value!.LineCount.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Download_ExistingExport_ReturnsCsvContent()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var export = new PayrollExport
        {
            PayrollRunId = Guid.NewGuid(),
            Format = PayrollExportFormat.Csv,
            ExportedAt = DateTime.UtcNow,
            FilePath = "exports/payroll/test.csv",
            FileName = "test-export.csv"
        };
        export.Lines.Add(new PayrollExportLine
        {
            EmployeeId = Guid.NewGuid(),
            EmployeeName = "John Doe",
            MaskedSsn = "***-**-1234",
            StraightTimeHours = 40m,
            OvertimeHours = 4m,
            DoubletimeHours = 0m,
            HourlyRate = 35m,
            GrossPay = 1610m,
            Deductions = 322m,
            NetPay = 1288m,
            ProjectId = Guid.NewGuid(),
            CostCodeId = Guid.NewGuid()
        });
        db.Set<PayrollExport>().Add(export);
        await db.SaveChangesAsync();

        var result = await service.DownloadAsync(export.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.FileName.Should().Be("test-export.csv");
        result.Value.ContentType.Should().Be("text/csv");
        result.Value.Content.Should().Contain("Employee ID");
        result.Value.Content.Should().Contain("John Doe");
        result.Value.Content.Should().Contain("***-**-1234");
    }

    [Fact]
    public async Task Download_NonexistentExport_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.DownloadAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Download_CsvContent_HasCorrectHeaders()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var export = new PayrollExport
        {
            PayrollRunId = Guid.NewGuid(),
            Format = PayrollExportFormat.Csv,
            ExportedAt = DateTime.UtcNow,
            FilePath = "exports/payroll/headers.csv",
            FileName = "headers.csv"
        };
        export.Lines.Add(new PayrollExportLine
        {
            EmployeeId = Guid.NewGuid(), EmployeeName = "Test",
            MaskedSsn = "***-**-0000",
            StraightTimeHours = 8m, OvertimeHours = 0m, DoubletimeHours = 0m,
            HourlyRate = 25m, GrossPay = 200m, Deductions = 40m, NetPay = 160m,
            ProjectId = Guid.NewGuid(), CostCodeId = Guid.NewGuid()
        });
        db.Set<PayrollExport>().Add(export);
        await db.SaveChangesAsync();

        var result = await service.DownloadAsync(export.Id);

        var csv = result.Value!.Content;
        var headerLine = csv.Split('\n')[0].Trim();
        headerLine.Should().Contain("Employee ID");
        headerLine.Should().Contain("Name");
        headerLine.Should().Contain("SSN");
        headerLine.Should().Contain("Hours ST");
        headerLine.Should().Contain("Hours OT");
        headerLine.Should().Contain("Rate");
        headerLine.Should().Contain("Gross");
        headerLine.Should().Contain("Net");
    }

    [Fact]
    public async Task Download_CsvContent_MasksSsn()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var export = new PayrollExport
        {
            PayrollRunId = Guid.NewGuid(),
            Format = PayrollExportFormat.Csv,
            ExportedAt = DateTime.UtcNow,
            FilePath = "exports/payroll/ssn.csv",
            FileName = "ssn-test.csv"
        };
        export.Lines.Add(new PayrollExportLine
        {
            EmployeeId = Guid.NewGuid(), EmployeeName = "Sensitive Employee",
            MaskedSsn = "***-**-5678",
            StraightTimeHours = 40m, OvertimeHours = 0m, DoubletimeHours = 0m,
            HourlyRate = 30m, GrossPay = 1200m, Deductions = 240m, NetPay = 960m,
            ProjectId = Guid.NewGuid(), CostCodeId = Guid.NewGuid()
        });
        db.Set<PayrollExport>().Add(export);
        await db.SaveChangesAsync();

        var result = await service.DownloadAsync(export.Id);

        result.Value!.Content.Should().Contain("***-**-5678");
        result.Value.Content.Should().NotContain("123-45-5678");
    }

    [Fact]
    public async Task List_FiltersAndPaginates()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var runId = Guid.NewGuid();

        for (int i = 0; i < 3; i++)
        {
            db.Set<PayrollExport>().Add(new PayrollExport
            {
                PayrollRunId = runId,
                Format = PayrollExportFormat.Csv,
                ExportedAt = DateTime.UtcNow.AddDays(-i),
                FilePath = $"exports/payroll/{i}.csv",
                FileName = $"export-{i}.csv"
            });
        }
        await db.SaveChangesAsync();

        var query = new ListPayrollExportsQuery(PayrollRunId: runId, Page: 1, PageSize: 2);
        var result = await service.ListAsync(query);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(3);
        result.Value.TotalPages.Should().Be(2);
    }

    #region Helpers

    private static PayrollExportService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new PayrollExportService(db, NullLogger<PayrollExportService>.Instance);
    }

    private static async Task<PayrollRun> SeedPayrollRun(
        Pitbull.Core.Data.PitbullDbContext db, PayrollRunStatus status)
    {
        var payPeriod = new PayPeriod
        {
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-14)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = PayPeriodStatus.Open,
            Name = "Test Period"
        };
        db.Set<PayPeriod>().Add(payPeriod);

        var run = new PayrollRun
        {
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = payPeriod.Id,
            Status = status,
            TotalGross = 5000m,
            TotalNet = 4000m,
            EmployeeCount = 2
        };
        db.Set<PayrollRun>().Add(run);
        await db.SaveChangesAsync();
        return run;
    }

    private static async Task<(PayrollRun run, PayPeriod payPeriod, Employee employee, CostCode costCode)>
        SetupFullPayrollData(Pitbull.Core.Data.PitbullDbContext db)
    {
        var payPeriod = new PayPeriod
        {
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-14)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = PayPeriodStatus.Open,
            Name = "Export Test Period"
        };
        db.Set<PayPeriod>().Add(payPeriod);

        var employee = new Employee
        {
            FirstName = "Mike", LastName = "Ironworker",
            EmployeeNumber = "EMP-PE-001", Email = "mike@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly, BaseHourlyRate = 50m
        };
        db.Set<Employee>().Add(employee);

        var costCode = new CostCode
        {
            Code = "05-100", Description = "Structural Steel",
            IsActive = true, CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        var projectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectId);

        var run = new PayrollRun
        {
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 3000m, TotalNet = 2400m, EmployeeCount = 1
        };
        run.Lines.Add(new PayrollRunLine
        {
            PayrollRunId = run.Id, EmployeeId = employee.Id,
            RegularHours = 40m, OvertimeHours = 8m, DoubletimeHours = 0m,
            RegularPay = 2000m, OvertimePay = 600m, DoubletimePay = 0m, GrossPay = 2600m
        });
        db.Set<PayrollRun>().Add(run);

        // Add approved time entries in pay period
        db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = payPeriod.StartDate,
            EmployeeId = employee.Id,
            ProjectId = projectId,
            CostCodeId = costCode.Id,
            RegularHours = 40m,
            OvertimeHours = 8m,
            Status = TimeEntryStatus.Approved
        });
        await db.SaveChangesAsync();

        return (run, payPeriod, employee, costCode);
    }

    #endregion
}
