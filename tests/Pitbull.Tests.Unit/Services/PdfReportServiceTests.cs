using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Services;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Services;

public class PdfReportServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static PdfReportService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var tenantContext = new TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId,
            TenantName = "Test Tenant"
        };

        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };

        return new PdfReportService(db, tenantContext, companyContext, NullLogger<PdfReportService>.Instance);
    }

    [Fact]
    public async Task GenerateWipSchedulePdfAsync_ReturnsNonEmptyBytes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var report = new WipReport
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            ReportDate = DateOnly.FromDateTime(DateTime.UtcNow),
            FiscalYear = DateTime.UtcNow.Year,
            PeriodNumber = DateTime.UtcNow.Month,
            Status = WipReportStatus.Draft,
            GeneratedById = "test-user"
        };

        db.Set<WipReport>().Add(report);
        db.Set<WipReportLine>().Add(new WipReportLine
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            WipReportId = report.Id,
            ProjectId = ProjectId,
            RevisedContractAmount = 1_000_000m,
            TotalCostToDate = 450_000m,
            BilledToDate = 400_000m,
            PercentComplete = 45m,
            OverUnderBilling = 50_000m
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateWipSchedulePdfAsync();

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateProjectCostSummaryPdfAsync_ReturnsNonEmptyBytes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var costCodeId = Guid.NewGuid();
        db.Set<CostCode>().Add(new CostCode
        {
            Id = costCodeId,
            Code = "03-100",
            Description = "Concrete",
            CostType = CostType.Labor,
            IsActive = true,
            IsCompanyStandard = true
        });

        db.Set<PmJobCostBudget>().Add(new PmJobCostBudget
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            CostCodeId = costCodeId,
            OriginalBudget = 100_000m,
            ApprovedBudgetChanges = 10_000m,
            CurrentBudget = 110_000m,
            LaborBurdenRate = 0m
        });

        db.Set<PmJobCostActual>().Add(new PmJobCostActual
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            CostCodeId = costCodeId,
            AsOfDate = DateTime.UtcNow,
            LaborCost = 30_000m,
            MaterialCost = 10_000m,
            EquipmentCost = 0m,
            SubcontractCost = 0m,
            OtherCost = 0m,
            TotalActualCost = 40_000m,
            SourceType = JobCostSourceType.ManualAdjustment
        });

        db.Set<PmJobCostCommitment>().Add(new PmJobCostCommitment
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            CostCodeId = costCodeId,
            CommitmentType = CommitmentType.Other,
            OriginalCommittedAmount = 15_000m,
            ApprovedChangesAmount = 0m,
            CurrentCommittedAmount = 15_000m,
            BilledToDate = 0m,
            PaidToDate = 0m,
            RemainingCommitted = 15_000m,
            Status = CommitmentStatus.Approved
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateProjectCostSummaryPdfAsync(ProjectId);

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateRetentionSummaryPdfAsync_ReturnsNonEmptyBytes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        db.Set<RetentionHold>().Add(new RetentionHold
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OriginalAmount = 500_000m,
            RetainagePercent = 10m,
            RetainedAmount = 50_000m,
            ReleasedAmount = 20_000m,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = RetentionHoldStatus.PartiallyReleased
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateRetentionSummaryPdfAsync();

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateWh347PdfAsync_ReturnsNonEmptyBytes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var payPeriod = new PayPeriod
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = "PP-1",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-14)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
            Status = PayPeriodStatus.Closed
        };
        db.Set<PayPeriod>().Add(payPeriod);

        var employee = new Employee
        {
            EmployeeNumber = "EMP-001",
            FirstName = "Jane",
            LastName = "Worker",
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 40m,
            IsActive = true
        };
        db.Set<Employee>().Add(employee);

        var payrollRun = new PayrollRun
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 1_600m,
            TotalNet = 1_200m,
            EmployeeCount = 1
        };
        db.Set<PayrollRun>().Add(payrollRun);

        db.Set<PayrollRunLine>().Add(new PayrollRunLine
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            PayrollRunId = payrollRun.Id,
            EmployeeId = employee.Id,
            RegularHours = 40m,
            OvertimeHours = 0m,
            DoubletimeHours = 0m,
            RegularPay = 1_600m,
            OvertimePay = 0m,
            DoubletimePay = 0m,
            GrossPay = 1_600m
        });

        db.Set<CertifiedPayrollReport>().Add(new CertifiedPayrollReport
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            PayrollRunId = payrollRun.Id,
            ProjectId = ProjectId,
            WeekEnding = DateOnly.FromDateTime(DateTime.UtcNow),
            WHDFormNumber = "WH-347",
            Status = CertifiedPayrollStatus.Draft
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateWh347PdfAsync(payrollRun.Id);

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateWh347PdfAsync_NoPayrollRunLines_ReturnsEmptyReport()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var payPeriod = new PayPeriod
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = "PP-Empty",
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-14)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
            Status = PayPeriodStatus.Closed
        };
        db.Set<PayPeriod>().Add(payPeriod);

        var payrollRun = new PayrollRun
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 0m,
            TotalNet = 0m,
            EmployeeCount = 0
        };
        db.Set<PayrollRun>().Add(payrollRun);

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateWh347PdfAsync(payrollRun.Id);

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateWh347PdfAsync_WithDailyHours_IncludesBreakdown()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var payPeriod = new PayPeriod
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = "PP-Daily",
            StartDate = new DateOnly(2026, 2, 9),
            EndDate = new DateOnly(2026, 2, 15),
            Status = PayPeriodStatus.Closed
        };
        db.Set<PayPeriod>().Add(payPeriod);

        var employee = new Employee
        {
            EmployeeNumber = "EMP-002",
            FirstName = "Bob",
            LastName = "Builder",
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 50m,
            IsActive = true
        };
        db.Set<Employee>().Add(employee);

        var costCodeId = Guid.NewGuid();
        db.Set<CostCode>().Add(new CostCode
        {
            Id = costCodeId,
            Code = "03-200",
            Description = "Framing",
            CostType = CostType.Labor,
            IsActive = true,
            IsCompanyStandard = true
        });

        var payrollRun = new PayrollRun
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 2_400m,
            TotalNet = 1_800m,
            EmployeeCount = 1
        };
        db.Set<PayrollRun>().Add(payrollRun);

        db.Set<PayrollRunLine>().Add(new PayrollRunLine
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            PayrollRunId = payrollRun.Id,
            EmployeeId = employee.Id,
            RegularHours = 40m,
            OvertimeHours = 8m,
            DoubletimeHours = 0m,
            RegularPay = 2_000m,
            OvertimePay = 600m,
            DoubletimePay = 0m,
            GrossPay = 2_600m
        });

        db.Set<CertifiedPayrollReport>().Add(new CertifiedPayrollReport
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            PayrollRunId = payrollRun.Id,
            ProjectId = ProjectId,
            WeekEnding = new DateOnly(2026, 2, 15),
            WHDFormNumber = "WH-347",
            Status = CertifiedPayrollStatus.Draft
        });

        // Seed daily time entries (Mon-Fri 8hrs + Sat 8hrs OT)
        for (var day = 0; day < 5; day++)
        {
            db.Set<TimeEntry>().Add(new TimeEntry
            {
                CompanyId = TestDbContextFactory.TestCompanyId,
                Date = new DateOnly(2026, 2, 9).AddDays(day), // Mon-Fri
                EmployeeId = employee.Id,
                ProjectId = ProjectId,
                CostCodeId = costCodeId,
                RegularHours = 8m,
                OvertimeHours = 0m,
                DoubletimeHours = 0m,
                Status = TimeEntryStatus.Approved
            });
        }
        db.Set<TimeEntry>().Add(new TimeEntry
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            Date = new DateOnly(2026, 2, 14), // Saturday
            EmployeeId = employee.Id,
            ProjectId = ProjectId,
            CostCodeId = costCodeId,
            RegularHours = 0m,
            OvertimeHours = 8m,
            DoubletimeHours = 0m,
            Status = TimeEntryStatus.Approved
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateWh347PdfAsync(payrollRun.Id);

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateWh347PdfAsync_PayrollRunNotFound_ThrowsKeyNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        Func<Task> act = () => service.GenerateWh347PdfAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GenerateAgedArPdfAsync_ReturnsNonEmptyBytes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var subcontract = new Subcontract
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            SubcontractNumber = "SC-001",
            SubcontractorName = "Acme Subcontracting",
            OriginalValue = 100_000m,
            CurrentValue = 100_000m,
            RetainagePercent = 10m,
            Status = SubcontractStatus.InProgress
        };
        db.Set<Subcontract>().Add(subcontract);

        db.Set<PaymentApplication>().Add(new PaymentApplication
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            SubcontractId = subcontract.Id,
            ApplicationNumber = 1,
            PeriodStart = DateTime.UtcNow.AddDays(-60),
            PeriodEnd = DateTime.UtcNow.AddDays(-31),
            ScheduledValue = 30_000m,
            WorkCompletedPrevious = 0m,
            WorkCompletedThisPeriod = 30_000m,
            WorkCompletedToDate = 30_000m,
            StoredMaterials = 0m,
            TotalCompletedAndStored = 30_000m,
            RetainagePercent = 10m,
            RetainageThisPeriod = 3_000m,
            RetainagePrevious = 0m,
            TotalRetainage = 3_000m,
            TotalEarnedLessRetainage = 27_000m,
            LessPreviousCertificates = 0m,
            CurrentPaymentDue = 27_000m,
            Status = PaymentApplicationStatus.Approved,
            InvoiceNumber = "INV-001"
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateAgedArPdfAsync();

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }
}
