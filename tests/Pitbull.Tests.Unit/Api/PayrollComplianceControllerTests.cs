using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.CertifiedPayroll;
using Pitbull.Billing.Features.PayrollRuns;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;

namespace Pitbull.Tests.Unit.Api;

public class PayrollComplianceControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();

    private readonly PitbullDbContext _db;
    private readonly PayrollRunsController _payrollRunsController;
    private readonly CertifiedPayrollController _certifiedPayrollController;

    public PayrollComplianceControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);

        IPayrollRunService payrollRunService = new PayrollRunService(_db, NullLogger<PayrollRunService>.Instance);
        ICertifiedPayrollService certifiedPayrollService = new CertifiedPayrollService(_db, NullLogger<CertifiedPayrollService>.Instance);

        _payrollRunsController = new PayrollRunsController(payrollRunService)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        _certifiedPayrollController = new CertifiedPayrollController(certifiedPayrollService)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task GeneratePayrollRun_CalculatesGrossAndHours_FromApprovedTimeEntries()
    {
        Guid employeeId = Guid.NewGuid();
        Guid projectId = Guid.NewGuid();

        PayPeriod payPeriod = await SeedPayPeriodAsync();
        await SeedEmployeeAsync(employeeId, 40m);
        await SeedApprovedTimeEntryAsync(employeeId, projectId, payPeriod.StartDate.AddDays(1), regularHours: 8m, overtimeHours: 2m, doubletimeHours: 1m);

        GeneratePayrollRunRequest request = new(
            RunDate: DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId: payPeriod.Id);

        IActionResult result = await _payrollRunsController.Generate(request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        PayrollRunDto payload = ok.Value.Should().BeOfType<PayrollRunDto>().Subject;

        payload.EmployeeCount.Should().Be(1);
        payload.Lines.Should().HaveCount(1);
        payload.Lines[0].RegularHours.Should().Be(8m);
        payload.Lines[0].OvertimeHours.Should().Be(2m);
        payload.Lines[0].DoubletimeHours.Should().Be(1m);
        payload.Lines[0].GrossPay.Should().Be(520m);
        payload.TotalGross.Should().Be(520m);
        payload.TotalNet.Should().Be(520m);
    }

    [Fact]
    public async Task GenerateCertifiedPayroll_FiltersByProject_AndReturnsWH347Data()
    {
        Guid employeeId = Guid.NewGuid();
        Guid projectId = Guid.NewGuid();
        Guid otherProjectId = Guid.NewGuid();

        PayPeriod payPeriod = await SeedPayPeriodAsync();
        await SeedEmployeeAsync(employeeId, 50m);

        await SeedApprovedTimeEntryAsync(employeeId, projectId, payPeriod.StartDate.AddDays(1), regularHours: 8m, overtimeHours: 1m, doubletimeHours: 0m);
        await SeedApprovedTimeEntryAsync(employeeId, otherProjectId, payPeriod.StartDate.AddDays(2), regularHours: 6m, overtimeHours: 0m, doubletimeHours: 0m);

        IActionResult generatedRunResult = await _payrollRunsController.Generate(new GeneratePayrollRunRequest(DateOnly.FromDateTime(DateTime.UtcNow), payPeriod.Id));
        PayrollRunDto payrollRun = ((OkObjectResult)generatedRunResult).Value.Should().BeOfType<PayrollRunDto>().Subject;

        GenerateCertifiedPayrollRequest request = new(
            PayrollRunId: payrollRun.Id,
            ProjectId: projectId,
            WeekEnding: payPeriod.EndDate);

        IActionResult result = await _certifiedPayrollController.Generate(request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        CertifiedPayrollGenerateResult payload = ok.Value.Should().BeOfType<CertifiedPayrollGenerateResult>().Subject;

        payload.Report.WHDFormNumber.Should().Be("WH-347");
        payload.Report.ProjectId.Should().Be(projectId);
        payload.Lines.Should().HaveCount(1);
        payload.Lines[0].EmployeeId.Should().Be(employeeId);
        payload.Lines[0].RegularHours.Should().Be(8m);
        payload.Lines[0].OvertimeHours.Should().Be(1m);
        payload.TotalGross.Should().Be(475m);
    }

    private async Task<PayPeriod> SeedPayPeriodAsync()
    {
        DateOnly start = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-7);
        DateOnly end = start.AddDays(6);

        PayPeriod payPeriod = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            StartDate = start,
            EndDate = end,
            Name = "Test Period",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<PayPeriod>().Add(payPeriod);
        await _db.SaveChangesAsync();
        return payPeriod;
    }

    private async Task SeedEmployeeAsync(Guid employeeId, decimal baseRate)
    {
        Employee employee = new()
        {
            Id = employeeId,
            TenantId = TestTenantId,
            EmployeeNumber = $"E-{employeeId.ToString()[..8]}",
            FirstName = "Test",
            LastName = "Worker",
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = baseRate,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<Employee>().Add(employee);
        await _db.SaveChangesAsync();
    }

    private async Task SeedApprovedTimeEntryAsync(
        Guid employeeId,
        Guid projectId,
        DateOnly date,
        decimal regularHours,
        decimal overtimeHours,
        decimal doubletimeHours)
    {
        TimeEntry entry = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Date = date,
            EmployeeId = employeeId,
            ProjectId = projectId,
            CostCodeId = Guid.NewGuid(),
            RegularHours = regularHours,
            OvertimeHours = overtimeHours,
            DoubletimeHours = doubletimeHours,
            Status = TimeEntryStatus.Approved,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<TimeEntry>().Add(entry);
        await _db.SaveChangesAsync();
    }
}
