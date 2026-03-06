using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Services;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Services;

public class PdfReportServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static PdfReportService CreateService(PitbullDbContext db)
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

        var contract = new OwnerContract
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            ContractNumber = "OC-001",
            ProjectName = "Test Project",
            OwnerName = "Springfield School District",
            OriginalContractSum = 500_000m,
            ContractSumToDate = 500_000m
        };
        db.Set<OwnerContract>().Add(contract);

        var sov = new OwnerScheduleOfValues
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OwnerContractId = contract.Id,
            OriginalContractAmount = 500_000m,
            RevisedContractAmount = 500_000m,
            TotalScheduledValue = 500_000m,
            Status = OwnerSOVStatus.Active
        };
        db.Set<OwnerScheduleOfValues>().Add(sov);

        db.Set<BillingApplication>().Add(new BillingApplication
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OwnerContractId = contract.Id,
            OwnerScheduleOfValuesId = sov.Id,
            ApplicationNumber = 1,
            PeriodFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-60)),
            PeriodThrough = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-45)),
            ApplicationDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-45)),
            OriginalContractSum = 500_000m,
            ContractSumToDate = 500_000m,
            TotalCompletedAndStoredToDate = 100_000m,
            TotalEarnedLessRetainage = 90_000m,
            CurrentPaymentDue = 90_000m,
            Status = BillingApplicationStatus.SubmittedToOwner
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateAgedArPdfAsync();

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateAgedArPdfAsync_NoOutstandingApplications_ReturnsEmptyReport()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var bytes = await service.GenerateAgedArPdfAsync();

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateWipSchedulePdfAsync_NoReportData_ReturnsEmptyReport()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var bytes = await service.GenerateWipSchedulePdfAsync();

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateProjectCostSummaryPdfAsync_ProjectNotFound_ThrowsKeyNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        Func<Task> act = () => service.GenerateProjectCostSummaryPdfAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GenerateSubmittalLogPdfAsync_ReturnsNonEmptyBytes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        db.Set<PmSubmittal>().Add(new PmSubmittal
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            SubmittalNumber = 1,
            Title = "Concrete Mix Design",
            SpecSectionCode = "03-300",
            SubmittalType = SubmittalType.ProductData,
            Status = SubmittalStatus.Submitted,
            RequiredByDate = DateTime.UtcNow.AddDays(14),
            SubmittedDate = DateTime.UtcNow
        });

        db.Set<PmSubmittal>().Add(new PmSubmittal
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            SubmittalNumber = 2,
            Title = "Structural Steel Shop Drawings",
            SpecSectionCode = "05-120",
            SubmittalType = SubmittalType.ShopDrawing,
            Status = SubmittalStatus.Approved,
            RequiredByDate = DateTime.UtcNow.AddDays(7),
            SubmittedDate = DateTime.UtcNow.AddDays(-10),
            ReturnedDate = DateTime.UtcNow.AddDays(-3)
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GenerateSubmittalLogPdfAsync(ProjectId);

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GenerateSubmittalLogPdfAsync_NoSubmittals_ReturnsEmptyReport()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var service = CreateService(db);
        var bytes = await service.GenerateSubmittalLogPdfAsync(ProjectId);

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GeneratePunchListPdfAsync_ReturnsNonEmptyBytes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        db.Set<PmPunchListItem>().Add(new PmPunchListItem
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            ItemNumber = 1,
            Location = "Room 201 - Conference Room",
            Category = PunchListCategory.Finishes,
            Description = "Paint touch-up needed on north wall",
            ResponsiblePartyType = PunchListResponsiblePartyType.Subcontractor,
            AssignedToName = "ABC Painting Co.",
            Status = PunchListItemStatus.Open,
            Priority = PunchListPriority.Normal,
            DueDate = DateTime.UtcNow.AddDays(7),
            CreatedByUserId = Guid.NewGuid()
        });

        db.Set<PmPunchListItem>().Add(new PmPunchListItem
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            ItemNumber = 2,
            Location = "Lobby - Main Entrance",
            Category = PunchListCategory.Architectural,
            Description = "Door closer adjustment required",
            ResponsiblePartyType = PunchListResponsiblePartyType.GeneralContractor,
            Status = PunchListItemStatus.Closed,
            Priority = PunchListPriority.High,
            CreatedByUserId = Guid.NewGuid(),
            ClosedByUserId = Guid.NewGuid(),
            ClosedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var bytes = await service.GeneratePunchListPdfAsync(ProjectId);

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task GeneratePunchListPdfAsync_NoPunchItems_ReturnsEmptyReport()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var service = CreateService(db);
        var bytes = await service.GeneratePunchListPdfAsync(ProjectId);

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(100);
    }

    // ── Not-found tests (blocker #1) ──

    [Fact]
    public async Task GenerateSubmittalLogPdfAsync_ProjectNotFound_ThrowsKeyNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        Func<Task> act = () => service.GenerateSubmittalLogPdfAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GeneratePunchListPdfAsync_ProjectNotFound_ThrowsKeyNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        Func<Task> act = () => service.GeneratePunchListPdfAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ── AR aging bucket math + soft-delete (blockers #2 & #3) ──

    [Fact]
    public async Task AssembleAgedArDataAsync_BucketAssignment_MatchesDaysOverdue()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var contract = new OwnerContract
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            ContractNumber = "OC-BUCKET",
            ProjectName = "Bucket Test",
            OwnerName = "Bucket Owner",
            OriginalContractSum = 1_000_000m,
            ContractSumToDate = 1_000_000m
        };
        db.Set<OwnerContract>().Add(contract);

        var sov = new OwnerScheduleOfValues
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OwnerContractId = contract.Id,
            OriginalContractAmount = 1_000_000m,
            RevisedContractAmount = 1_000_000m,
            TotalScheduledValue = 1_000_000m,
            Status = OwnerSOVStatus.Active
        };
        db.Set<OwnerScheduleOfValues>().Add(sov);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Seed 6 billing applications, one per bucket
        BillingApplication MakeApp(int appNum, int daysAgo, decimal amount) => new()
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OwnerContractId = contract.Id,
            OwnerScheduleOfValuesId = sov.Id,
            ApplicationNumber = appNum,
            PeriodFrom = today.AddDays(-daysAgo - 30),
            PeriodThrough = today.AddDays(-daysAgo),
            ApplicationDate = today.AddDays(-daysAgo),
            OriginalContractSum = 1_000_000m,
            ContractSumToDate = 1_000_000m,
            CurrentPaymentDue = amount,
            Status = BillingApplicationStatus.PaymentDue
        };

        db.Set<BillingApplication>().AddRange(
            MakeApp(1, -5, 10_000m),   // Future (Current bucket: daysOverdue = -5)
            MakeApp(2, 15, 20_000m),   // 1-30 bucket
            MakeApp(3, 45, 30_000m),   // 31-60 bucket
            MakeApp(4, 75, 40_000m),   // 61-90 bucket
            MakeApp(5, 105, 50_000m),  // 91-120 bucket
            MakeApp(6, 150, 60_000m)   // 120+ bucket
        );
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var rows = await service.AssembleAgedArDataAsync();

        rows.Should().HaveCount(6);
        rows.Should().ContainSingle(r => r.Current == 10_000m);
        rows.Should().ContainSingle(r => r.Days1To30 == 20_000m);
        rows.Should().ContainSingle(r => r.Days31To60 == 30_000m);
        rows.Should().ContainSingle(r => r.Days61To90 == 40_000m);
        rows.Should().ContainSingle(r => r.Days91To120 == 50_000m);
        rows.Should().ContainSingle(r => r.Days120Plus == 60_000m);

        // Verify each row lands in exactly one bucket (all other buckets are 0)
        foreach (var row in rows)
        {
            var nonZeroBuckets = new[] { row.Current, row.Days1To30, row.Days31To60, row.Days61To90, row.Days91To120, row.Days120Plus }
                .Count(b => b > 0);
            nonZeroBuckets.Should().Be(1, "each invoice should land in exactly one aging bucket");
        }
    }

    [Fact]
    public async Task AssembleAgedArDataAsync_ExcludesSoftDeletedApplications()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var contract = new OwnerContract
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            ContractNumber = "OC-DEL",
            ProjectName = "Soft Delete Test",
            OwnerName = "Delete Owner",
            OriginalContractSum = 100_000m,
            ContractSumToDate = 100_000m
        };
        db.Set<OwnerContract>().Add(contract);

        var sov = new OwnerScheduleOfValues
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OwnerContractId = contract.Id,
            OriginalContractAmount = 100_000m,
            RevisedContractAmount = 100_000m,
            TotalScheduledValue = 100_000m,
            Status = OwnerSOVStatus.Active
        };
        db.Set<OwnerScheduleOfValues>().Add(sov);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Active application
        db.Set<BillingApplication>().Add(new BillingApplication
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OwnerContractId = contract.Id,
            OwnerScheduleOfValuesId = sov.Id,
            ApplicationNumber = 1,
            PeriodFrom = today.AddDays(-30),
            PeriodThrough = today.AddDays(-10),
            ApplicationDate = today.AddDays(-10),
            OriginalContractSum = 100_000m,
            ContractSumToDate = 100_000m,
            CurrentPaymentDue = 25_000m,
            Status = BillingApplicationStatus.PaymentDue
        });

        // Soft-deleted application — should be excluded
        db.Set<BillingApplication>().Add(new BillingApplication
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OwnerContractId = contract.Id,
            OwnerScheduleOfValuesId = sov.Id,
            ApplicationNumber = 2,
            PeriodFrom = today.AddDays(-60),
            PeriodThrough = today.AddDays(-40),
            ApplicationDate = today.AddDays(-40),
            OriginalContractSum = 100_000m,
            ContractSumToDate = 100_000m,
            CurrentPaymentDue = 75_000m,
            Status = BillingApplicationStatus.PaymentDue,
            IsDeleted = true
        });

        await db.SaveChangesAsync();

        var service = CreateService(db);
        var rows = await service.AssembleAgedArDataAsync();

        rows.Should().HaveCount(1);
        rows[0].Amount.Should().Be(25_000m);
    }

    // ── WIP Schedule data math (blocker #3) ──

    [Fact]
    public async Task AssembleWipScheduleDataAsync_MapsAllFieldsFromWipReportLine()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var report = new WipReport
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            ReportDate = DateOnly.FromDateTime(DateTime.UtcNow),
            FiscalYear = 2026,
            PeriodNumber = 2,
            Status = WipReportStatus.Draft,
            GeneratedById = "test-user"
        };
        db.Set<WipReport>().Add(report);

        db.Set<WipReportLine>().Add(new WipReportLine
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            WipReportId = report.Id,
            ProjectId = ProjectId,
            ContractAmount = 800_000m,
            RevisedContractAmount = 1_000_000m,
            TotalCostToDate = 450_000m,
            EstimatedCostToComplete = 500_000m,
            EstimatedTotalCost = 950_000m,
            PercentComplete = 47.37m,
            EarnedRevenue = 473_684m,
            BilledToDate = 400_000m,
            OverUnderBilling = 73_684m
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var (lines, _) = await service.AssembleWipScheduleDataAsync();

        lines.Should().HaveCount(1);
        var line = lines[0];
        line.ContractAmount.Should().Be(1_000_000m);
        line.CostsToDate.Should().Be(450_000m);
        line.EstimatedTotalCost.Should().Be(950_000m);
        line.PercentComplete.Should().Be(47.37m);
        line.EarnedRevenue.Should().Be(473_684m);
        line.BilledToDate.Should().Be(400_000m);
        line.OverUnderBilling.Should().Be(73_684m);
    }
}
