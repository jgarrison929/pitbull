using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Controllers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public sealed class ReportAndSettingsBoundsTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly CompanyContext _companyContext;

    public ReportAndSettingsBoundsTests()
    {
        var tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        _companyContext = new CompanyContext();
        _companyContext.CompanyId = TestCompanyId;
        _companyContext.CompanyCode = "TEST";
        _companyContext.CompanyName = "Test Company";
        _companyContext.SetAccessibleCompanies([TestCompanyId]);

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, _companyContext);
        _db.Companies.Add(new Company
        {
            Id = TestCompanyId,
            Code = "TEST",
            Name = "Test Company",
            TenantId = TestTenantId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });
        _db.SaveChanges();
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task ReportSettings_RejectsDailyThresholdOver24()
    {
        var controller = new ReportSettingsController(_db, _companyContext)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var request = new UpdateReportSettingsRequest(
            OvertimeRules: "Federal",
            OvertimeEnabled: true,
            DailyOvertimeThreshold: 25m,
            DailyDoubletimeThreshold: 12m,
            WeeklyOvertimeThreshold: 40m,
            SaturdayRule: "overtime",
            SundayRule: "doubletime",
            HolidayRule: "doubletime",
            HolidaysJson: "[]",
            ReportBrandingName: "Acme",
            ReportLogoUrl: "",
            FiscalYearStartMonth: 1);

        var result = await controller.Update(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.Value!.ToString().Should().Contain("DailyOvertimeThreshold");
    }

    [Fact]
    public async Task ReportSettings_RejectsOversizedBrandingName()
    {
        var controller = new ReportSettingsController(_db, _companyContext)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var request = new UpdateReportSettingsRequest(
            OvertimeRules: "Federal",
            OvertimeEnabled: true,
            DailyOvertimeThreshold: 8m,
            DailyDoubletimeThreshold: 12m,
            WeeklyOvertimeThreshold: 40m,
            SaturdayRule: "overtime",
            SundayRule: "doubletime",
            HolidayRule: "doubletime",
            HolidaysJson: "[]",
            ReportBrandingName: new string('B', 201),
            ReportLogoUrl: "",
            FiscalYearStartMonth: 1);

        var result = await controller.Update(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.Value!.ToString().Should().Contain("ReportBrandingName");
    }

    [Fact]
    public async Task ContractSettings_RejectsOversizedAiaArchitectName()
    {
        var controller = new ContractSettingsController(_db, _companyContext)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var request = new UpdateContractSettingsRequest(
            DefaultRetainagePercent: 10m,
            RequireSignedSubcontractBeforePayApp: false,
            ApprovalWorkflowType: "None",
            AiaArchitectName: new string('A', 201),
            AiaOwnerName: "Owner");

        var result = await controller.Update(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.Value!.ToString().Should().Contain("AiaArchitectName");
    }

    [Fact]
    public async Task ProjectSettings_RejectsOversizedNumberingFormat()
    {
        var controller = new ProjectSettingsController(_db, _companyContext)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var request = new UpdateProjectSettingsRequest(
            DefaultNumberingFormat: new string('N', 101),
            RequireBudgetBeforeActivation: false,
            AutoCreatePhases: false,
            DefaultRetentionPercent: 5m);

        var result = await controller.Update(request);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.Value!.ToString().Should().Contain("DefaultNumberingFormat");
    }

    [Fact]
    public async Task ReportSettings_AcceptsValidCaliforniaPreset()
    {
        var controller = new ReportSettingsController(_db, _companyContext)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var request = new UpdateReportSettingsRequest(
            OvertimeRules: "California",
            OvertimeEnabled: true,
            DailyOvertimeThreshold: 8m,
            DailyDoubletimeThreshold: 12m,
            WeeklyOvertimeThreshold: 40m,
            SaturdayRule: "overtime",
            SundayRule: "doubletime",
            HolidayRule: "doubletime",
            HolidaysJson: "[]",
            ReportBrandingName: "Acme GC",
            ReportLogoUrl: "https://example.com/logo.png",
            FiscalYearStartMonth: 1);

        var result = await controller.Update(request);

        result.Should().BeOfType<OkObjectResult>();
    }
}
