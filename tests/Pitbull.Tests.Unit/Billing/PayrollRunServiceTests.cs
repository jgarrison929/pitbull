using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.PayrollRuns;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Billing;

public class PayrollRunServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly PayrollRunService _service;

    public PayrollRunServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new PayrollRunService(_db, NullLogger<PayrollRunService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task<PayPeriod> SeedLockedPayPeriod(Guid? id = null)
    {
        PayPeriod period = new()
        {
            Id = id ?? Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            StartDate = new DateOnly(2026, 2, 1),
            EndDate = new DateOnly(2026, 2, 14),
            Status = PayPeriodStatus.Locked,
            Name = "Feb 1-14, 2026",
            LockedAt = DateTime.UtcNow,
            LockedById = Guid.NewGuid()
        };
        _db.Set<PayPeriod>().Add(period);
        await _db.SaveChangesAsync();
        return period;
    }

    private async Task<PayPeriod> SeedOpenPayPeriod(Guid? id = null)
    {
        PayPeriod period = new()
        {
            Id = id ?? Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            StartDate = new DateOnly(2026, 2, 15),
            EndDate = new DateOnly(2026, 2, 28),
            Status = PayPeriodStatus.Open,
            Name = "Feb 15-28, 2026"
        };
        _db.Set<PayPeriod>().Add(period);
        await _db.SaveChangesAsync();
        return period;
    }

    private async Task<Employee> SeedEmployee(decimal baseRate = 50m)
    {
        Employee emp = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            EmployeeNumber = "EMP-001",
            FirstName = "John",
            LastName = "Doe",
            BaseHourlyRate = baseRate,
            IsActive = true,
            Classification = EmployeeClassification.Hourly
        };
        _db.Set<Employee>().Add(emp);
        await _db.SaveChangesAsync();
        return emp;
    }

    private async Task SeedApprovedTimeEntry(Guid employeeId, DateOnly date,
        decimal regularHours = 8m, decimal overtimeHours = 0m, decimal doubletimeHours = 0m)
    {
        TimeEntry entry = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            EmployeeId = employeeId,
            ProjectId = Guid.NewGuid(),
            CostCodeId = Guid.NewGuid(),
            Date = date,
            RegularHours = regularHours,
            OvertimeHours = overtimeHours,
            DoubletimeHours = doubletimeHours,
            Status = TimeEntryStatus.Approved,
            ApprovedAt = DateTime.UtcNow,
            ApprovedById = Guid.NewGuid()
        };
        _db.Set<TimeEntry>().Add(entry);
        await _db.SaveChangesAsync();
    }

    private async Task<PayrollRun> SeedPayrollRun(Guid payPeriodId, PayrollRunStatus status = PayrollRunStatus.Draft)
    {
        PayrollRun run = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = payPeriodId,
            Status = status,
            TotalGross = 0m,
            TotalNet = 0m,
            EmployeeCount = 0
        };
        _db.Set<PayrollRun>().Add(run);
        await _db.SaveChangesAsync();
        return run;
    }

    // ── Create: Duplicate Prevention ──

    [Fact]
    public async Task CreatePayrollRun_FirstForPayPeriod_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();

        var result = await _service.CreatePayrollRunAsync(
            new CreatePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeTrue();
        result.Value!.PayPeriodId.Should().Be(period.Id);
        result.Value.Status.Should().Be(PayrollRunStatus.Draft);
    }

    [Fact]
    public async Task CreatePayrollRun_DuplicateForSamePayPeriod_ReturnsDuplicateError()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        await SeedPayrollRun(period.Id);

        var result = await _service.CreatePayrollRunAsync(
            new CreatePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_PAYROLL_RUN");
    }

    [Fact]
    public async Task CreatePayrollRun_EmptyPayPeriodId_ReturnsValidationError()
    {
        var result = await _service.CreatePayrollRunAsync(
            new CreatePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), Guid.Empty));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    // ── Generate: Pay Period Lock Check ──

    [Fact]
    public async Task GeneratePayrollRun_OpenPayPeriod_ReturnsPayPeriodNotLocked()
    {
        PayPeriod period = await SeedOpenPayPeriod();

        var result = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PAY_PERIOD_NOT_LOCKED");
    }

    [Fact]
    public async Task GeneratePayrollRun_LockedPayPeriod_WithApprovedEntries_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        Employee emp = await SeedEmployee(50m);
        await SeedApprovedTimeEntry(emp.Id, new DateOnly(2026, 2, 3), regularHours: 8m, overtimeHours: 2m);

        var result = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollRunStatus.Processing);
        result.Value.EmployeeCount.Should().Be(1);
        result.Value.Lines.Should().HaveCount(1);
        result.Value.Lines[0].RegularHours.Should().Be(8m);
        result.Value.Lines[0].OvertimeHours.Should().Be(2m);
        result.Value.Lines[0].RegularPay.Should().Be(400m);      // 8 * 50
        result.Value.Lines[0].OvertimePay.Should().Be(150m);      // 2 * 50 * 1.5
    }

    [Fact]
    public async Task GeneratePayrollRun_ClosedPayPeriod_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        period.Status = PayPeriodStatus.Closed;
        await _db.SaveChangesAsync();

        Employee emp = await SeedEmployee(40m);
        await SeedApprovedTimeEntry(emp.Id, new DateOnly(2026, 2, 5), regularHours: 8m);

        var result = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GeneratePayrollRun_PayPeriodNotFound_ReturnsNotFound()
    {
        var result = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PAY_PERIOD_NOT_FOUND");
    }

    [Fact]
    public async Task GeneratePayrollRun_NoApprovedEntries_ReturnsNoTimeEntries()
    {
        PayPeriod period = await SeedLockedPayPeriod();

        var result = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NO_TIME_ENTRIES");
    }

    // ── Generate: Duplicate Prevention ──

    [Fact]
    public async Task GeneratePayrollRun_DuplicateForSamePayPeriod_ReturnsDuplicateError()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        await SeedPayrollRun(period.Id);

        var result = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_PAYROLL_RUN");
    }

    // ── Update: Status Enforcement ──

    [Fact]
    public async Task UpdatePayrollRun_DraftStatus_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Draft);

        var result = await _service.UpdatePayrollRunAsync(
            new UpdatePayrollRunCommand(run.Id, RunDate: new DateOnly(2026, 3, 1)));

        result.IsSuccess.Should().BeTrue();
        result.Value!.RunDate.Should().Be(new DateOnly(2026, 3, 1));
    }

    [Fact]
    public async Task UpdatePayrollRun_ProcessingStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Processing);

        var result = await _service.UpdatePayrollRunAsync(
            new UpdatePayrollRunCommand(run.Id, RunDate: new DateOnly(2026, 3, 1)));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdatePayrollRun_ApprovedStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Approved);

        var result = await _service.UpdatePayrollRunAsync(
            new UpdatePayrollRunCommand(run.Id, RunDate: new DateOnly(2026, 3, 1)));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdatePayrollRun_ExportedStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Exported);

        var result = await _service.UpdatePayrollRunAsync(
            new UpdatePayrollRunCommand(run.Id, RunDate: new DateOnly(2026, 3, 1)));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdatePayrollRun_NotFound_ReturnsNotFound()
    {
        var result = await _service.UpdatePayrollRunAsync(
            new UpdatePayrollRunCommand(Guid.NewGuid(), RunDate: new DateOnly(2026, 3, 1)));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    // ── Approve: Status Enforcement ──

    [Fact]
    public async Task ApprovePayrollRun_ProcessingStatus_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Processing);

        var result = await _service.ApprovePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollRunStatus.Approved);
    }

    [Fact]
    public async Task ApprovePayrollRun_SubmittedStatus_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Submitted);

        var result = await _service.ApprovePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollRunStatus.Approved);
    }

    [Fact]
    public async Task ApprovePayrollRun_UnderReviewStatus_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.UnderReview);

        var result = await _service.ApprovePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollRunStatus.Approved);
    }

    [Fact]
    public async Task ApprovePayrollRun_DraftStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Draft);

        var result = await _service.ApprovePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ApprovePayrollRun_ExportedStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Exported);

        var result = await _service.ApprovePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ApprovePayrollRun_AlreadyApproved_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Approved);

        var result = await _service.ApprovePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ApprovePayrollRun_NotFound_ReturnsNotFound()
    {
        var result = await _service.ApprovePayrollRunAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    // ── Export: Status Enforcement ──

    [Fact]
    public async Task ExportPayrollRun_ApprovedStatus_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Approved);

        var result = await _service.ExportPayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollRunStatus.Exported);
    }

    [Fact]
    public async Task ExportPayrollRun_DraftStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Draft);

        var result = await _service.ExportPayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ExportPayrollRun_ProcessingStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Processing);

        var result = await _service.ExportPayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ExportPayrollRun_AlreadyExported_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Exported);

        var result = await _service.ExportPayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ExportPayrollRun_NotFound_ReturnsNotFound()
    {
        var result = await _service.ExportPayrollRunAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    // ── Delete: Status Enforcement ──

    [Fact]
    public async Task DeletePayrollRun_DraftStatus_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Draft);

        var result = await _service.DeletePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeTrue();
        bool exists = await _db.Set<PayrollRun>().AnyAsync(x => x.Id == run.Id);
        exists.Should().BeFalse();
    }

    [Fact]
    public async Task DeletePayrollRun_ProcessingStatus_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Processing);

        var result = await _service.DeletePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeletePayrollRun_ApprovedStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Approved);

        var result = await _service.DeletePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task DeletePayrollRun_ExportedStatus_ReturnsInvalidStatus()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        PayrollRun run = await SeedPayrollRun(period.Id, PayrollRunStatus.Exported);

        var result = await _service.DeletePayrollRunAsync(run.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task DeletePayrollRun_NotFound_ReturnsNotFound()
    {
        var result = await _service.DeletePayrollRunAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    // ── Happy Path: Full Lifecycle ──

    [Fact]
    public async Task FullLifecycle_Create_Generate_Approve_Export()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        Employee emp = await SeedEmployee(60m);
        await SeedApprovedTimeEntry(emp.Id, new DateOnly(2026, 2, 3), regularHours: 8m, overtimeHours: 2m, doubletimeHours: 1m);
        await SeedApprovedTimeEntry(emp.Id, new DateOnly(2026, 2, 4), regularHours: 8m);

        // Generate
        var generateResult = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        generateResult.IsSuccess.Should().BeTrue();
        Guid runId = generateResult.Value!.Id;
        generateResult.Value.Status.Should().Be(PayrollRunStatus.Processing);
        generateResult.Value.EmployeeCount.Should().Be(1);

        // Verify pay calculations: 16 regular hrs * $60 = $960, 2 OT hrs * $90 = $180, 1 DT hr * $120 = $120
        PayrollRunLineDto line = generateResult.Value.Lines[0];
        line.RegularHours.Should().Be(16m);
        line.OvertimeHours.Should().Be(2m);
        line.DoubletimeHours.Should().Be(1m);
        line.RegularPay.Should().Be(960m);
        line.OvertimePay.Should().Be(180m);
        line.DoubletimePay.Should().Be(120m);
        line.GrossPay.Should().Be(1260m);

        generateResult.Value.TotalGross.Should().Be(1260m);

        // Approve
        var approveResult = await _service.ApprovePayrollRunAsync(runId);
        approveResult.IsSuccess.Should().BeTrue();
        approveResult.Value!.Status.Should().Be(PayrollRunStatus.Approved);

        // Export
        var exportResult = await _service.ExportPayrollRunAsync(runId);
        exportResult.IsSuccess.Should().BeTrue();
        exportResult.Value!.Status.Should().Be(PayrollRunStatus.Exported);
    }

    // ── Generate: Overtime Calculation ──

    [Fact]
    public async Task GeneratePayrollRun_OvertimeCalculation_UsesCorrectMultipliers()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        Employee emp = await SeedEmployee(40m);
        await SeedApprovedTimeEntry(emp.Id, new DateOnly(2026, 2, 3),
            regularHours: 8m, overtimeHours: 4m, doubletimeHours: 2m);

        var result = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeTrue();
        PayrollRunLineDto line = result.Value!.Lines[0];

        line.RegularPay.Should().Be(320m);     // 8 * $40
        line.OvertimePay.Should().Be(240m);    // 4 * $40 * 1.5
        line.DoubletimePay.Should().Be(160m);  // 2 * $40 * 2.0
        line.GrossPay.Should().Be(720m);
    }

    [Fact]
    public async Task GeneratePayrollRun_MultipleEmployees_CalculatesSeparately()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        Employee emp1 = await SeedEmployee(50m);
        Employee emp2 = await SeedEmployee(30m);
        await SeedApprovedTimeEntry(emp1.Id, new DateOnly(2026, 2, 3), regularHours: 8m);
        await SeedApprovedTimeEntry(emp2.Id, new DateOnly(2026, 2, 3), regularHours: 8m);

        var result = await _service.GeneratePayrollRunAsync(
            new GeneratePayrollRunCommand(DateOnly.FromDateTime(DateTime.UtcNow), period.Id));

        result.IsSuccess.Should().BeTrue();
        result.Value!.EmployeeCount.Should().Be(2);
        result.Value.Lines.Should().HaveCount(2);
        result.Value.TotalGross.Should().Be(640m); // (8*50) + (8*30)
    }

    // ── HIGH #11: Status transition validation ──

    [Fact]
    public async Task Update_DraftToExported_ReturnsInvalidStatusTransition()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        var createCmd = new CreatePayrollRunCommand(
            RunDate: DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId: period.Id);
        var created = await _service.CreatePayrollRunAsync(createCmd);
        created.IsSuccess.Should().BeTrue();

        // Try to jump from Draft straight to Exported (skipping Processing/Submitted/UnderReview/Approved)
        var updateCmd = new UpdatePayrollRunCommand(
            PayrollRunId: created.Value!.Id,
            RunDate: null,
            Status: PayrollRunStatus.Exported);
        var result = await _service.UpdatePayrollRunAsync(updateCmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    [Fact]
    public async Task Update_DraftToProcessing_Succeeds()
    {
        PayPeriod period = await SeedLockedPayPeriod();
        var createCmd = new CreatePayrollRunCommand(
            RunDate: DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId: period.Id);
        var created = await _service.CreatePayrollRunAsync(createCmd);
        created.IsSuccess.Should().BeTrue();

        var updateCmd = new UpdatePayrollRunCommand(
            PayrollRunId: created.Value!.Id,
            RunDate: null,
            Status: PayrollRunStatus.Processing);
        var result = await _service.UpdatePayrollRunAsync(updateCmd);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollRunStatus.Processing);
    }
}
