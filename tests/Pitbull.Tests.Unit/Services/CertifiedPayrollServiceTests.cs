using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Payroll.Features.CertifiedPayroll;
using Pitbull.Payroll.Services;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Services;

public sealed class CertifiedPayrollServiceTests
{
    [Fact]
    public async Task Generate_MissingPayrollRun_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var command = new GenerateCertifiedPayrollCommand(
            PayrollRunId: Guid.NewGuid(),
            ProjectId: Guid.NewGuid(),
            WeekEnding: DateOnly.FromDateTime(DateTime.UtcNow));

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PAYROLL_RUN_NOT_FOUND");
    }

    [Fact]
    public async Task Generate_MissingPayPeriod_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var run = new PayrollRun
        {
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = Guid.NewGuid(), // non-existent pay period
            Status = PayrollRunStatus.Approved,
            TotalGross = 5000m,
            TotalNet = 4000m,
            EmployeeCount = 1
        };
        db.Set<PayrollRun>().Add(run);
        await db.SaveChangesAsync();

        var command = new GenerateCertifiedPayrollCommand(
            PayrollRunId: run.Id,
            ProjectId: Guid.NewGuid(),
            WeekEnding: DateOnly.FromDateTime(DateTime.UtcNow));

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PAY_PERIOD_NOT_FOUND");
    }

    [Fact]
    public async Task Generate_DuplicateReport_ReturnsDuplicateError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, payPeriod, projectId) = await SetupPayrollData(db);

        var weekEnding = DateOnly.FromDateTime(DateTime.UtcNow);

        // Create existing report
        db.Set<CertifiedPayrollReport>().Add(new CertifiedPayrollReport
        {
            PayrollRunId = run.Id,
            ProjectId = projectId,
            WeekEnding = weekEnding,
            WHDFormNumber = "WH-347",
            Status = CertifiedPayrollStatus.Submitted
        });
        await db.SaveChangesAsync();

        var command = new GenerateCertifiedPayrollCommand(
            PayrollRunId: run.Id,
            ProjectId: projectId,
            WeekEnding: weekEnding);

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("REPORT_IMMUTABLE");
    }

    [Fact]
    public async Task Generate_NoApprovedEntries_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, payPeriod, projectId) = await SetupPayrollData(db);

        var command = new GenerateCertifiedPayrollCommand(
            PayrollRunId: run.Id,
            ProjectId: projectId,
            WeekEnding: DateOnly.FromDateTime(DateTime.UtcNow));

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NO_PROJECT_TIME_ENTRIES");
    }

    [Fact]
    public async Task Generate_WithApprovedEntries_CreatesReportWithCorrectLines()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, payPeriod, projectId) = await SetupPayrollData(db);

        // Add an employee and matching payroll run line
        var employee = new Employee
        {
            FirstName = "John",
            LastName = "Electrician",
            EmployeeNumber = "EMP-CP-001",
            Email = "john.elec@test.com",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 45m
        };
        db.Set<Employee>().Add(employee);

        var costCode = new CostCode
        {
            Code = "16-100",
            Description = "Electrical Rough-In",
            IsActive = true,
            CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        db.Set<PayrollRunLine>().Add(new PayrollRunLine
        {
            PayrollRunId = run.Id,
            EmployeeId = employee.Id,
            RegularHours = 40m,
            OvertimeHours = 4m,
            DoubletimeHours = 0m,
            RegularPay = 1800m,
            OvertimePay = 270m,
            DoubletimePay = 0m,
            GrossPay = 2070m
        });

        // Add approved time entry within the pay period
        var timeEntry = new TimeEntry
        {
            Date = payPeriod.StartDate,
            EmployeeId = employee.Id,
            ProjectId = projectId,
            CostCodeId = costCode.Id,
            RegularHours = 40m,
            OvertimeHours = 4m,
            DoubletimeHours = 0m,
            Status = TimeEntryStatus.Approved
        };
        db.Set<TimeEntry>().Add(timeEntry);
        await db.SaveChangesAsync();

        var command = new GenerateCertifiedPayrollCommand(
            PayrollRunId: run.Id,
            ProjectId: projectId,
            WeekEnding: DateOnly.FromDateTime(DateTime.UtcNow));

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Report.WHDFormNumber.Should().Be("WH-347");
        result.Value.Report.Status.Should().Be(CertifiedPayrollStatus.Draft);
        result.Value.Lines.Should().HaveCount(1);
        result.Value.Lines[0].EmployeeId.Should().Be(employee.Id);
        result.Value.Lines[0].RegularHours.Should().Be(40m);
        result.Value.Lines[0].OvertimeHours.Should().Be(4m);
        result.Value.TotalGross.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Generate_MultipleEmployees_CreatesLinesForEach()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, payPeriod, projectId) = await SetupPayrollData(db);

        var costCode = new CostCode
        {
            Code = "03-300",
            Description = "Concrete",
            IsActive = true,
            CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        var emp1 = new Employee
        {
            FirstName = "Alice", LastName = "Mason",
            EmployeeNumber = "EMP-CP-002", Email = "alice@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly, BaseHourlyRate = 40m
        };
        var emp2 = new Employee
        {
            FirstName = "Bob", LastName = "Carpenter",
            EmployeeNumber = "EMP-CP-003", Email = "bob@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly, BaseHourlyRate = 38m
        };
        db.Set<Employee>().AddRange(emp1, emp2);

        db.Set<PayrollRunLine>().Add(new PayrollRunLine
        {
            PayrollRunId = run.Id, EmployeeId = emp1.Id,
            RegularHours = 40m, OvertimeHours = 0m, DoubletimeHours = 0m,
            RegularPay = 1600m, OvertimePay = 0m, DoubletimePay = 0m, GrossPay = 1600m
        });
        db.Set<PayrollRunLine>().Add(new PayrollRunLine
        {
            PayrollRunId = run.Id, EmployeeId = emp2.Id,
            RegularHours = 32m, OvertimeHours = 8m, DoubletimeHours = 0m,
            RegularPay = 1216m, OvertimePay = 456m, DoubletimePay = 0m, GrossPay = 1672m
        });

        db.Set<TimeEntry>().AddRange(
            new TimeEntry
            {
                Date = payPeriod.StartDate, EmployeeId = emp1.Id, ProjectId = projectId,
                CostCodeId = costCode.Id, RegularHours = 40m, Status = TimeEntryStatus.Approved
            },
            new TimeEntry
            {
                Date = payPeriod.StartDate, EmployeeId = emp2.Id, ProjectId = projectId,
                CostCodeId = costCode.Id, RegularHours = 32m, OvertimeHours = 8m,
                Status = TimeEntryStatus.Approved
            });
        await db.SaveChangesAsync();

        var command = new GenerateCertifiedPayrollCommand(
            PayrollRunId: run.Id, ProjectId: projectId,
            WeekEnding: DateOnly.FromDateTime(DateTime.UtcNow));

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Lines.Should().HaveCount(2);
        result.Value.TotalGross.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Generate_NoPayrollLinesMatchEntries_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, payPeriod, projectId) = await SetupPayrollData(db);

        var costCode = new CostCode
        {
            Code = "03-400", Description = "Rebar", IsActive = true, CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        // Time entry for employee NOT in payroll run lines
        var unlinkedEmployee = new Employee
        {
            FirstName = "Charlie", LastName = "Ghost",
            EmployeeNumber = "EMP-CP-004", Email = "charlie@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly, BaseHourlyRate = 35m
        };
        db.Set<Employee>().Add(unlinkedEmployee);

        db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = payPeriod.StartDate, EmployeeId = unlinkedEmployee.Id,
            ProjectId = projectId, CostCodeId = costCode.Id,
            RegularHours = 8m, Status = TimeEntryStatus.Approved
        });
        await db.SaveChangesAsync();

        var command = new GenerateCertifiedPayrollCommand(
            PayrollRunId: run.Id, ProjectId: projectId,
            WeekEnding: DateOnly.FromDateTime(DateTime.UtcNow));

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NO_PAYROLL_LINES");
    }

    [Fact]
    public async Task List_FiltersAndPaginates()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Seed some reports
        var runId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        for (int i = 0; i < 3; i++)
        {
            db.Set<CertifiedPayrollReport>().Add(new CertifiedPayrollReport
            {
                PayrollRunId = runId,
                ProjectId = projectId,
                WeekEnding = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7 * i)),
                WHDFormNumber = "WH-347",
                Status = CertifiedPayrollStatus.Draft
            });
        }
        await db.SaveChangesAsync();

        var query = new ListCertifiedPayrollReportsQuery(PayrollRunId: runId, Page: 1, PageSize: 2);
        var result = await service.ListAsync(query);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(3);
        result.Value.TotalPages.Should().Be(2);
    }


    [Fact]
    public async Task Generate_ProjectNotCertified_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, payPeriod, projectId) = await SetupPayrollData(db);

        var project = await db.Set<Project>().FirstAsync(p => p.Id == projectId);
        project.CertifiedPayroll = false;
        await db.SaveChangesAsync();

        var command = new GenerateCertifiedPayrollCommand(
            PayrollRunId: run.Id,
            ProjectId: projectId,
            WeekEnding: DateOnly.FromDateTime(DateTime.UtcNow));

        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PROJECT_NOT_CERTIFIED");
    }

    [Fact]
    public async Task Generate_PersistsLines_AndGetReturnsStored()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, payPeriod, projectId) = await SetupPayrollData(db);

        var classification = new WorkClassification
        {
            Code = "ELEC",
            Name = "Electrician",
            IsActive = true
        };
        db.Set<WorkClassification>().Add(classification);

        var employee = new Employee
        {
            FirstName = "John",
            LastName = "Electrician",
            EmployeeNumber = "EMP-CP-010",
            Email = "john.persist@test.com",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 45m
        };
        db.Set<Employee>().Add(employee);

        var costCode = new CostCode
        {
            Code = "16-200",
            Description = "Electrical",
            IsActive = true,
            CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        db.Set<PayrollRunLine>().Add(new PayrollRunLine
        {
            PayrollRunId = run.Id,
            EmployeeId = employee.Id,
            WorkClassificationId = classification.Id,
            RegularHours = 40m,
            OvertimeHours = 0m,
            DoubletimeHours = 0m,
            RegularPay = 1800m,
            OvertimePay = 0m,
            DoubletimePay = 0m,
            GrossPay = 1800m
        });

        db.Set<FringeBenefitAllocation>().Add(new FringeBenefitAllocation
        {
            EmployeeId = employee.Id,
            ProjectId = projectId,
            AllocationMethod = FringeAllocationMethod.Split,
            RequiredFringeRate = 10m,
            CashFringeAmount = 200m,
            BenefitFringeAmount = 200m
        });

        db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = payPeriod.StartDate,
            EmployeeId = employee.Id,
            ProjectId = projectId,
            CostCodeId = costCode.Id,
            WorkClassificationId = classification.Id,
            RegularHours = 40m,
            Status = TimeEntryStatus.Approved
        });
        await db.SaveChangesAsync();

        var weekEnding = DateOnly.FromDateTime(DateTime.UtcNow);
        var generate = await service.GenerateAsync(new GenerateCertifiedPayrollCommand(run.Id, projectId, weekEnding));
        generate.IsSuccess.Should().BeTrue();
        generate.Value!.Lines.Should().HaveCount(1);
        generate.Value.Lines[0].WorkClassificationCode.Should().Be("ELEC");
        generate.Value.Lines[0].CashFringe.Should().BeGreaterThan(0);

        var storedCount = await db.Set<CertifiedPayrollLine>().CountAsync(x => x.ReportId == generate.Value.Report.Id);
        storedCount.Should().Be(1);

        var detail = await service.GetAsync(generate.Value.Report.Id);
        detail.IsSuccess.Should().BeTrue();
        detail.Value!.Lines.Should().HaveCount(1);
        detail.Value.Lines[0].WorkClassificationName.Should().Be("Electrician");
    }

    [Fact]
    public async Task Submit_RequiresStatementFields()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var (run, _, projectId) = await SetupPayrollData(db);

        var report = new CertifiedPayrollReport
        {
            PayrollRunId = run.Id,
            ProjectId = projectId,
            WeekEnding = DateOnly.FromDateTime(DateTime.UtcNow),
            WHDFormNumber = "WH-347",
            Status = CertifiedPayrollStatus.Draft,
            Lines =
            [
                new CertifiedPayrollLine
                {
                    EmployeeId = Guid.NewGuid(),
                    ProjectId = projectId,
                    RegularHours = 8m,
                    GrossPay = 400m,
                    NetPay = 400m
                }
            ]
        };
        db.Set<CertifiedPayrollReport>().Add(report);
        await db.SaveChangesAsync();

        var result = await service.SubmitAsync(new SubmitCertifiedPayrollCommand(report.Id, "user-1"));
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("STATEMENT_INCOMPLETE");
    }

    #region Helpers

    private static CertifiedPayrollService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new CertifiedPayrollService(db, NullLogger<CertifiedPayrollService>.Instance);
    }

    private static async Task<(PayrollRun run, PayPeriod payPeriod, Guid projectId)> SetupPayrollData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var projectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectId);
        var project = await db.Set<Project>().FirstAsync(p => p.Id == projectId);
        project.CertifiedPayroll = true;
        await db.SaveChangesAsync();

        var payPeriod = new PayPeriod
        {
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-14)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = PayPeriodStatus.Open,
            Name = "Test Pay Period"
        };
        db.Set<PayPeriod>().Add(payPeriod);

        var run = new PayrollRun
        {
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 5000m,
            TotalNet = 4000m,
            EmployeeCount = 2
        };
        db.Set<PayrollRun>().Add(run);
        await db.SaveChangesAsync();

        return (run, payPeriod, projectId);
    }

    #endregion
}
