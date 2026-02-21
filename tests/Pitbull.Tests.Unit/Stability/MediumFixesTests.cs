using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Features.Aging;
using Pitbull.Billing.Features.BankReconciliation;
using Pitbull.Billing.Features.PayrollExports;
using Pitbull.Billing.Features.PurchaseOrders;
using Pitbull.Billing.Features.WageDeterminations;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Stability;

/// <summary>
/// Tests for MEDIUM severity fixes from STABILITY-REVIEW-FEB21.md
/// </summary>
public sealed class MediumFixesTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;

    public MediumFixesTests()
    {
        var tenantCtx = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyCtx = new CompanyContext
        {
            CompanyId = TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantCtx, companyCtx);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── MEDIUM #1: Reconciliation start lacks chronological validation ──

    [Fact]
    public async Task Start_ReconciliationBeforeLastCompleted_ReturnsValidationError()
    {
        var service = new BankReconciliationService(_db, NullLogger<BankReconciliationService>.Instance);

        // Create a GL account + bank account
        var gl = new ChartOfAccount
        {
            TenantId = TestTenantId, CompanyId = TestCompanyId,
            AccountNumber = "1000", AccountName = "Cash",
            AccountType = AccountType.Asset, NormalBalance = NormalBalance.Debit,
            CreatedAt = DateTime.UtcNow, CreatedBy = "test"
        };
        _db.Set<ChartOfAccount>().Add(gl);
        await _db.SaveChangesAsync();

        var createResult = await service.CreateBankAccountAsync(new CreateBankAccountCommand(
            "Operating", "FNB", "4321", "123456789", gl.Id,
            BankAccountType.Checking, 10000m, new DateOnly(2026, 1, 1)));
        createResult.IsSuccess.Should().BeTrue();
        var bankAccountId = createResult.Value!.Id;

        // Create a completed reconciliation for Jan 31
        var rec = new Core.Domain.BankReconciliation
        {
            TenantId = TestTenantId, CompanyId = TestCompanyId,
            BankAccountId = bankAccountId,
            StatementDate = new DateOnly(2026, 1, 31),
            StatementEndingBalance = 10000m,
            Status = BankReconciliationStatus.Completed,
            CompletedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        _db.Set<Core.Domain.BankReconciliation>().Add(rec);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        // Try to start reconciliation for Jan 15 (before last completed)
        var startCmd = new StartReconciliationCommand(bankAccountId, new DateOnly(2026, 1, 15), 9500m);
        var result = await service.StartReconciliationAsync(startCmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    // ── MEDIUM #2: Customer aging excludes PartiallyPaid (inaccurate overstatement) ──

    [Fact]
    public async Task CustomerAging_PartiallyPaid_NotIncluded()
    {
        var service = new AgingReportService(_db, NullLogger<AgingReportService>.Instance);

        var projectId = Guid.NewGuid();
        _db.Set<Project>().Add(new Project
        {
            Id = projectId, TenantId = TestTenantId, CompanyId = TestCompanyId,
            Name = "Test", Number = "P-001", Status = ProjectStatus.Active
        });

        var ownContract = new OwnerContract
        {
            TenantId = TestTenantId, CompanyId = TestCompanyId,
            ProjectId = projectId, ContractNumber = "OC-001",
            ProjectName = "Test", OriginalContractSum = 100000m,
            ContractSumToDate = 100000m
        };
        _db.Set<OwnerContract>().Add(ownContract);
        await _db.SaveChangesAsync();

        // Add a PartiallyPaid billing application
        _db.Set<BillingApplication>().Add(new BillingApplication
        {
            TenantId = TestTenantId, CompanyId = TestCompanyId,
            ProjectId = projectId, OwnerContractId = ownContract.Id,
            ApplicationNumber = 1, PeriodFrom = new DateOnly(2026, 1, 1),
            PeriodThrough = new DateOnly(2026, 1, 31),
            ContractSumToDate = 100000m, CurrentPaymentDue = 25000m,
            Status = BillingApplicationStatus.PartiallyPaid
        });
        await _db.SaveChangesAsync();

        var result = await service.GetCustomerAgingAsync(new DateOnly(2026, 2, 20));

        result.IsSuccess.Should().BeTrue();
        // PartiallyPaid should NOT be in the aging report (we can't determine outstanding balance)
        result.Value!.Summary.Total.Should().Be(0m);
    }

    [Fact]
    public async Task CustomerAging_PaymentDue_IsIncluded()
    {
        var service = new AgingReportService(_db, NullLogger<AgingReportService>.Instance);

        var projectId = Guid.NewGuid();
        _db.Set<Project>().Add(new Project
        {
            Id = projectId, TenantId = TestTenantId, CompanyId = TestCompanyId,
            Name = "Test", Number = "P-002", Status = ProjectStatus.Active
        });

        var ownContract = new OwnerContract
        {
            TenantId = TestTenantId, CompanyId = TestCompanyId,
            ProjectId = projectId, ContractNumber = "OC-002",
            ProjectName = "Test", OriginalContractSum = 100000m,
            ContractSumToDate = 100000m
        };
        _db.Set<OwnerContract>().Add(ownContract);
        await _db.SaveChangesAsync();

        // Add a PaymentDue billing application (fully outstanding)
        _db.Set<BillingApplication>().Add(new BillingApplication
        {
            TenantId = TestTenantId, CompanyId = TestCompanyId,
            ProjectId = projectId, OwnerContractId = ownContract.Id,
            ApplicationNumber = 1, PeriodFrom = new DateOnly(2026, 1, 1),
            PeriodThrough = new DateOnly(2026, 1, 31),
            ContractSumToDate = 100000m, CurrentPaymentDue = 25000m,
            Status = BillingApplicationStatus.PaymentDue
        });
        await _db.SaveChangesAsync();

        var result = await service.GetCustomerAgingAsync(new DateOnly(2026, 2, 20));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Total.Should().Be(25000m);
    }

    // ── MEDIUM #3/#9: Owner contract update skips retainage bounds ──

    [Fact]
    public async Task OwnerContract_Update_RejectsNegativeRetainage()
    {
        var service = new OwnerContractService(_db, NullLogger<OwnerContractService>.Instance);

        var createCmd = new CreateOwnerContractCommand(
            Guid.NewGuid(), "OC-100", "Test Project", 500000m);
        var created = await service.CreateContractAsync(createCmd);
        created.IsSuccess.Should().BeTrue();

        var updateCmd = new UpdateOwnerContractCommand(created.Value!.Id,
            DefaultRetainagePercent: -5m);

        var result = await service.UpdateContractAsync(updateCmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task OwnerContract_Update_RejectsRetainageOver100()
    {
        var service = new OwnerContractService(_db, NullLogger<OwnerContractService>.Instance);

        var createCmd = new CreateOwnerContractCommand(
            Guid.NewGuid(), "OC-101", "Test Project", 500000m);
        var created = await service.CreateContractAsync(createCmd);
        created.IsSuccess.Should().BeTrue();

        var updateCmd = new UpdateOwnerContractCommand(created.Value!.Id,
            DefaultRetainagePercent: 150m);

        var result = await service.UpdateContractAsync(updateCmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task OwnerContract_Update_RejectsMaterialsRetainageOver100()
    {
        var service = new OwnerContractService(_db, NullLogger<OwnerContractService>.Instance);

        var createCmd = new CreateOwnerContractCommand(
            Guid.NewGuid(), "OC-102", "Test Project", 500000m);
        var created = await service.CreateContractAsync(createCmd);
        created.IsSuccess.Should().BeTrue();

        var updateCmd = new UpdateOwnerContractCommand(created.Value!.Id,
            RetainagePercentMaterials: 200m);

        var result = await service.UpdateContractAsync(updateCmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    // ── MEDIUM #4: Payroll allocation rounding reconciliation ──

    [Fact]
    public async Task PayrollExport_AllocationRounding_SumsExactly()
    {
        var service = new PayrollExportService(_db, NullLogger<PayrollExportService>.Instance);

        var payPeriod = new PayPeriod
        {
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 1, 14),
            Status = PayPeriodStatus.Open,
            Name = "Period 1"
        };
        _db.Set<PayPeriod>().Add(payPeriod);

        var employee = new Employee
        {
            FirstName = "Rounding", LastName = "Test",
            EmployeeNumber = "EMP-RND-001", Email = "rnd@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 33.33m
        };
        _db.Set<Employee>().Add(employee);

        var run = new PayrollRun
        {
            RunDate = new DateOnly(2026, 1, 15),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 999.99m, TotalNet = 799.99m, EmployeeCount = 1
        };
        run.Lines.Add(new PayrollRunLine
        {
            PayrollRunId = run.Id, EmployeeId = employee.Id,
            RegularHours = 30m, OvertimeHours = 0m, DoubletimeHours = 0m,
            RegularPay = 999.99m, OvertimePay = 0m, DoubletimePay = 0m,
            GrossPay = 999.99m
        });
        _db.Set<PayrollRun>().Add(run);

        var projectId = Guid.NewGuid();
        _db.Set<Project>().Add(new Project
        {
            Id = projectId, TenantId = TestTenantId, CompanyId = TestCompanyId,
            Name = "P1", Number = "P-RND", Status = ProjectStatus.Active
        });

        var costCode = new CostCode
        {
            Code = "01-100", Description = "General",
            IsActive = true, CostType = CostType.Labor
        };
        _db.Set<CostCode>().Add(costCode);

        // Create 3 time entries with odd hour splits (10, 10, 10 = 30 total)
        // Each is 1/3 ratio, which can cause rounding issues with 999.99
        for (int i = 0; i < 3; i++)
        {
            _db.Set<TimeEntry>().Add(new TimeEntry
            {
                Date = payPeriod.StartDate.AddDays(i),
                EmployeeId = employee.Id,
                ProjectId = projectId,
                CostCodeId = costCode.Id,
                RegularHours = 10m,
                Status = TimeEntryStatus.Approved
            });
        }
        await _db.SaveChangesAsync();

        var command = new GeneratePayrollExportCommand(run.Id, PayrollExportFormat.Csv, null, null);
        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.LineCount.Should().Be(3);

        // Sum of line gross values must exactly equal the payroll run line gross
        result.Value.TotalGross.Should().Be(999.99m);
    }

    // ── MEDIUM #5: Wage determination allows negative rates ──

    [Fact]
    public async Task WageDetermination_Create_RejectsNegativeBaseRate()
    {
        var service = new WageDeterminationService(_db, NullLogger<WageDeterminationService>.Instance);

        var classId = Guid.NewGuid();
        _db.Set<WorkClassification>().Add(new WorkClassification
        {
            Id = classId, Code = "IRON", Name = "Ironworker"
        });
        await _db.SaveChangesAsync();

        var command = new CreateWageDeterminationCommand(
            ProjectId: Guid.NewGuid(),
            JurisdictionType: WageJurisdictionType.Federal,
            DeterminationNumber: "WD-001",
            SourceAgency: "DOL",
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null,
            Status: WageDeterminationStatus.Active,
            Rates: [new CreateWageDeterminationRateInput(classId, -10m, 5m, 0m)]);

        var result = await service.CreateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("Base rate");
    }

    [Fact]
    public async Task WageDetermination_Create_RejectsNegativeFringeRate()
    {
        var service = new WageDeterminationService(_db, NullLogger<WageDeterminationService>.Instance);

        var classId = Guid.NewGuid();
        _db.Set<WorkClassification>().Add(new WorkClassification
        {
            Id = classId, Code = "CARP", Name = "Carpenter"
        });
        await _db.SaveChangesAsync();

        var command = new CreateWageDeterminationCommand(
            ProjectId: Guid.NewGuid(),
            JurisdictionType: WageJurisdictionType.Federal,
            DeterminationNumber: "WD-002",
            SourceAgency: "DOL",
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null,
            Status: WageDeterminationStatus.Active,
            Rates: [new CreateWageDeterminationRateInput(classId, 30m, -5m, 0m)]);

        var result = await service.CreateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("Fringe rate");
    }

    [Fact]
    public async Task WageDetermination_Update_RejectsNegativeBaseRate()
    {
        var service = new WageDeterminationService(_db, NullLogger<WageDeterminationService>.Instance);

        var classId = Guid.NewGuid();
        _db.Set<WorkClassification>().Add(new WorkClassification
        {
            Id = classId, Code = "ELEC", Name = "Electrician"
        });
        await _db.SaveChangesAsync();

        // Create valid determination first
        var createCmd = new CreateWageDeterminationCommand(
            ProjectId: Guid.NewGuid(),
            JurisdictionType: WageJurisdictionType.Federal,
            DeterminationNumber: "WD-003",
            SourceAgency: "DOL",
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null,
            Status: WageDeterminationStatus.Active,
            Rates: [new CreateWageDeterminationRateInput(classId, 40m, 10m, 50m)]);
        var created = await service.CreateAsync(createCmd);
        created.IsSuccess.Should().BeTrue();

        // Try to update with negative rate
        var updateCmd = new UpdateWageDeterminationCommand(
            WageDeterminationId: created.Value!.Id,
            DeterminationNumber: null, SourceAgency: null,
            EffectiveDate: null, ExpirationDate: null, Status: null,
            Rates: [new CreateWageDeterminationRateInput(classId, -15m, 10m, 0m)]);

        var result = await service.UpdateAsync(updateCmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    // ── MEDIUM #6: Vendor portal token missing project validation ──

    [Fact]
    public async Task VendorPortalToken_InvalidProjectId_ReturnsNotFound()
    {
        var service = new VendorPortalService(_db, NullLogger<VendorPortalService>.Instance);

        var vendorId = Guid.NewGuid();
        _db.Vendors.Add(new Vendor
        {
            Id = vendorId, TenantId = TestTenantId, CompanyId = TestCompanyId,
            Name = "Test Vendor", Code = "TV-001", IsActive = true
        });
        await _db.SaveChangesAsync();

        var result = await service.GenerateTokenAsync(vendorId, Guid.NewGuid(), 90);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Contain("Project");
    }

    [Fact]
    public async Task VendorPortalToken_ValidProjectId_Succeeds()
    {
        var service = new VendorPortalService(_db, NullLogger<VendorPortalService>.Instance);

        var vendorId = Guid.NewGuid();
        _db.Vendors.Add(new Vendor
        {
            Id = vendorId, TenantId = TestTenantId, CompanyId = TestCompanyId,
            Name = "Test Vendor 2", Code = "TV-002", IsActive = true
        });

        var projectId = Guid.NewGuid();
        _db.Set<Project>().Add(new Project
        {
            Id = projectId, TenantId = TestTenantId, CompanyId = TestCompanyId,
            Name = "Real Project", Number = "P-VP-001", Status = ProjectStatus.Active
        });
        await _db.SaveChangesAsync();

        var result = await service.GenerateTokenAsync(vendorId, projectId, 90);

        result.IsSuccess.Should().BeTrue();
    }

    // ── MEDIUM #7: Labor cost report excludes rejected entries even when not approved-only ──

    [Fact]
    public async Task LaborCostReport_NotApprovedOnly_ExcludesRejected()
    {
        var svc = CreateTimeEntryService();

        var employee = new Employee
        {
            FirstName = "Cost", LastName = "Report",
            EmployeeNumber = "EMP-CR-001", Email = "cr@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 25m
        };
        _db.Set<Employee>().Add(employee);

        var project = new Project
        {
            TenantId = TestTenantId, CompanyId = TestCompanyId,
            Name = "CR Project", Number = "P-CR", Status = ProjectStatus.Active
        };
        _db.Set<Project>().Add(project);

        var costCode = new CostCode
        {
            Code = "01-200", Description = "General Labor",
            IsActive = true, CostType = CostType.Labor
        };
        _db.Set<CostCode>().Add(costCode);

        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id, ProjectId = project.Id,
            StartDate = new DateOnly(2026, 1, 1), IsActive = true,
            Role = AssignmentRole.Worker
        };
        _db.Set<ProjectAssignment>().Add(assignment);

        // Add one approved, one submitted, one rejected entry
        _db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = new DateOnly(2026, 1, 5), EmployeeId = employee.Id,
            ProjectId = project.Id, CostCodeId = costCode.Id,
            RegularHours = 8m, Status = TimeEntryStatus.Approved
        });
        _db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = new DateOnly(2026, 1, 6), EmployeeId = employee.Id,
            ProjectId = project.Id, CostCodeId = costCode.Id,
            RegularHours = 8m, Status = TimeEntryStatus.Submitted
        });
        _db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = new DateOnly(2026, 1, 7), EmployeeId = employee.Id,
            ProjectId = project.Id, CostCodeId = costCode.Id,
            RegularHours = 8m, Status = TimeEntryStatus.Rejected
        });
        await _db.SaveChangesAsync();

        // approvedOnly = false should include approved + submitted but NOT rejected
        var result = await svc.GetLaborCostReportAsync(
            project.Id, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), false);

        result.IsSuccess.Should().BeTrue();
        // Should have 2 entries (approved + submitted), not 3
        result.Value!.TotalCost.TotalHours.Should().Be(16m); // 8 + 8 (rejected excluded)
    }

    // ── Self-Review: Owner contract CREATE rejects out-of-range materials retainage ──

    [Fact]
    public async Task OwnerContract_Create_RejectsNegativeMaterialsRetainage()
    {
        var service = new OwnerContractService(_db, NullLogger<OwnerContractService>.Instance);

        var createCmd = new CreateOwnerContractCommand(
            Guid.NewGuid(), "OC-SR-01", "Test Project", 500000m,
            RetainagePercentMaterials: -5m);

        var result = await service.CreateContractAsync(createCmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("Materials retainage");
    }

    [Fact]
    public async Task OwnerContract_Create_RejectsMaterialsRetainageOver100()
    {
        var service = new OwnerContractService(_db, NullLogger<OwnerContractService>.Instance);

        var createCmd = new CreateOwnerContractCommand(
            Guid.NewGuid(), "OC-SR-02", "Test Project", 500000m,
            RetainagePercentMaterials: 150m);

        var result = await service.CreateContractAsync(createCmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("Materials retainage");
    }

    // ── Self-Review: Controllers return 401 (not Guid.Empty) when user claims missing ──

    [Fact]
    public async Task PurchaseOrdersController_Approve_NoUserClaims_Returns401()
    {
        var tenantCtx = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyCtx = new CompanyContext();
        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        using var db = new PitbullDbContext(options, tenantCtx, companyCtx);

        var poService = new Pitbull.Billing.Services.PurchaseOrderService(db, NullLogger<Pitbull.Billing.Services.PurchaseOrderService>.Instance);
        var controller = new Pitbull.Api.Controllers.PurchaseOrdersController(poService)
        {
            ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
            {
                HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext() // No user claims
            }
        };

        var result = await controller.Approve(Guid.NewGuid());

        result.Should().BeOfType<Microsoft.AspNetCore.Mvc.UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task LienWaiversController_Approve_NoUserClaims_Returns401()
    {
        var tenantCtx = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyCtx = new CompanyContext();
        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        using var db = new PitbullDbContext(options, tenantCtx, companyCtx);

        var lienService = new Pitbull.Billing.Services.LienWaiverService(db, NullLogger<Pitbull.Billing.Services.LienWaiverService>.Instance);
        var controller = new Pitbull.Api.Controllers.LienWaiversController(lienService)
        {
            ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
            {
                HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext()
            }
        };

        var result = await controller.Approve(Guid.NewGuid());

        result.Should().BeOfType<Microsoft.AspNetCore.Mvc.UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task RetentionController_Release_NoUserClaims_Returns401()
    {
        var tenantCtx = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyCtx = new CompanyContext();
        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        using var db = new PitbullDbContext(options, tenantCtx, companyCtx);

        var retentionService = new Pitbull.Billing.Services.RetentionService(db, NullLogger<Pitbull.Billing.Services.RetentionService>.Instance);
        var controller = new Pitbull.Api.Controllers.RetentionController(retentionService)
        {
            ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
            {
                HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext()
            }
        };

        var result = await controller.ReleaseRetention(Guid.NewGuid(), new Pitbull.Api.Controllers.ReleaseRetentionRequest(1000m));

        result.Should().BeOfType<Microsoft.AspNetCore.Mvc.UnauthorizedObjectResult>();
    }

    // ── Codex Gap #2: PO number generation is atomic (retry on unique violation) ──

    [Fact]
    public async Task PurchaseOrder_Create_SucceedsWithUniqueNumber()
    {
        var poService = new PurchaseOrderService(_db, NullLogger<PurchaseOrderService>.Instance);

        var cmd1 = new CreatePurchaseOrderCommand(
            Guid.NewGuid(), Guid.NewGuid(), "PO 1",
            [new CreatePurchaseOrderLineCommand("Item 1", 5, 100m)]);
        var result1 = await poService.CreatePurchaseOrderAsync(cmd1);
        result1.IsSuccess.Should().BeTrue();

        var cmd2 = new CreatePurchaseOrderCommand(
            Guid.NewGuid(), Guid.NewGuid(), "PO 2",
            [new CreatePurchaseOrderLineCommand("Item 2", 3, 200m)]);
        var result2 = await poService.CreatePurchaseOrderAsync(cmd2);
        result2.IsSuccess.Should().BeTrue();

        // Two POs should have different numbers
        result1.Value!.PONumber.Should().NotBe(result2.Value!.PONumber);
    }

    // ── Codex Gap #3: Payroll export fails fast on missing allocations ──

    [Fact]
    public async Task PayrollExport_MissingTimeEntries_FailsFast()
    {
        var service = new PayrollExportService(_db, NullLogger<PayrollExportService>.Instance);

        var payPeriod = new PayPeriod
        {
            StartDate = new DateOnly(2026, 2, 1),
            EndDate = new DateOnly(2026, 2, 14),
            Status = PayPeriodStatus.Open,
            Name = "Gap Test Period"
        };
        _db.Set<PayPeriod>().Add(payPeriod);

        var employee = new Employee
        {
            FirstName = "Missing", LastName = "Entries",
            EmployeeNumber = "EMP-GAP-001", Email = "gap@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 30m
        };
        _db.Set<Employee>().Add(employee);

        var run = new PayrollRun
        {
            RunDate = new DateOnly(2026, 2, 15),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 1200m, TotalNet = 960m, EmployeeCount = 1
        };
        run.Lines.Add(new PayrollRunLine
        {
            PayrollRunId = run.Id, EmployeeId = employee.Id,
            RegularHours = 40m, OvertimeHours = 0m, DoubletimeHours = 0m,
            RegularPay = 1200m, OvertimePay = 0m, DoubletimePay = 0m, GrossPay = 1200m
        });
        _db.Set<PayrollRun>().Add(run);
        // NOTE: No time entries added for this employee
        await _db.SaveChangesAsync();

        var command = new GeneratePayrollExportCommand(run.Id, PayrollExportFormat.Csv, null, null);
        var result = await service.GenerateAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("MISSING_ALLOCATIONS");
        result.Error.Should().Contain("Missing Entries");

        // Run must remain Approved — not silently marked Exported
        _db.ChangeTracker.Clear();
        var freshRun = await _db.Set<PayrollRun>().FindAsync(run.Id);
        freshRun!.Status.Should().Be(PayrollRunStatus.Approved);
    }

    [Fact]
    public async Task PayrollExport_MixedEmployees_SomeWithEntries_SomeWithout_FailsFast()
    {
        var service = new PayrollExportService(_db, NullLogger<PayrollExportService>.Instance);

        var payPeriod = new PayPeriod
        {
            StartDate = new DateOnly(2026, 2, 1),
            EndDate = new DateOnly(2026, 2, 14),
            Status = PayPeriodStatus.Open,
            Name = "Mixed Period"
        };
        _db.Set<PayPeriod>().Add(payPeriod);

        var goodEmployee = new Employee
        {
            FirstName = "Good", LastName = "Worker",
            EmployeeNumber = "EMP-MIX-001", Email = "good@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 25m
        };
        var badEmployee = new Employee
        {
            FirstName = "No", LastName = "Timesheet",
            EmployeeNumber = "EMP-MIX-002", Email = "bad@test.com",
            IsActive = true, Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 25m
        };
        _db.Set<Employee>().AddRange(goodEmployee, badEmployee);

        var projectId = Guid.NewGuid();
        _db.Set<Project>().Add(new Project
        {
            Id = projectId, TenantId = TestTenantId, CompanyId = TestCompanyId,
            Name = "Mix", Number = "P-MIX", Status = ProjectStatus.Active
        });

        var costCode = new CostCode
        {
            Code = "01-MIX", Description = "Mixed",
            IsActive = true, CostType = CostType.Labor
        };
        _db.Set<CostCode>().Add(costCode);

        var run = new PayrollRun
        {
            RunDate = new DateOnly(2026, 2, 15),
            PayPeriodId = payPeriod.Id,
            Status = PayrollRunStatus.Approved,
            TotalGross = 2400m, TotalNet = 1920m, EmployeeCount = 2
        };
        run.Lines.Add(new PayrollRunLine
        {
            PayrollRunId = run.Id, EmployeeId = goodEmployee.Id,
            RegularHours = 40m, OvertimeHours = 0m, DoubletimeHours = 0m,
            RegularPay = 1000m, OvertimePay = 0m, DoubletimePay = 0m, GrossPay = 1000m
        });
        run.Lines.Add(new PayrollRunLine
        {
            PayrollRunId = run.Id, EmployeeId = badEmployee.Id,
            RegularHours = 40m, OvertimeHours = 0m, DoubletimeHours = 0m,
            RegularPay = 1000m, OvertimePay = 0m, DoubletimePay = 0m, GrossPay = 1000m
        });
        _db.Set<PayrollRun>().Add(run);

        // Only add time entries for good employee, not bad
        _db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = new DateOnly(2026, 2, 5), EmployeeId = goodEmployee.Id,
            ProjectId = projectId, CostCodeId = costCode.Id,
            RegularHours = 40m, Status = TimeEntryStatus.Approved
        });
        await _db.SaveChangesAsync();

        var command = new GeneratePayrollExportCommand(run.Id, PayrollExportFormat.Csv, null, null);
        var result = await service.GenerateAsync(command);

        // Should fail because badEmployee has no entries, even though goodEmployee does
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("MISSING_ALLOCATIONS");
        result.Error.Should().Contain("No Timesheet");
    }

    // ── Helper: TimeEntryService construction ──

    private Pitbull.TimeTracking.Services.TimeEntryService CreateTimeEntryService()
    {
        return new Pitbull.TimeTracking.Services.TimeEntryService(
            _db,
            new Pitbull.TimeTracking.Features.CreateTimeEntry.CreateTimeEntryValidator(),
            new Pitbull.TimeTracking.Features.UpdateTimeEntry.UpdateTimeEntryValidator(),
            new Pitbull.TimeTracking.Features.BatchCreateTimeEntries.BatchCreateTimeEntriesValidator(),
            new Pitbull.TimeTracking.Services.LaborCostCalculator(),
            Moq.Mock.Of<Pitbull.TimeTracking.Services.IPayPeriodService>(),
            new Pitbull.TimeTracking.Services.GeofenceService(),
            NullLogger<Pitbull.TimeTracking.Services.TimeEntryService>.Instance);
    }
}
