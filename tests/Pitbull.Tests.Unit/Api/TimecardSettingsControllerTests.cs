using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Controllers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;

namespace Pitbull.Tests.Unit.Api;

public class TimecardSettingsControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly TimecardSettingsController _controller;

    public TimecardSettingsControllerTests()
    {
        var tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyContext = new CompanyContext();
        companyContext.CompanyId = TestCompanyId;
        companyContext.CompanyCode = "TEST";
        companyContext.CompanyName = "Test Company";
        companyContext.SetAccessibleCompanies([TestCompanyId]);

        // Module assemblies are registered by ModuleInit at assembly load time.
        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);

        // Seed a test company
        var company = new Company
        {
            Id = TestCompanyId,
            Code = "TEST",
            Name = "Test Company",
            TenantId = TestTenantId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        _db.Companies.Add(company);
        _db.SaveChanges();

        _controller = new TimecardSettingsController(_db, companyContext);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private Guid SeedProject()
    {
        var project = new Project
        {
            Id = Guid.NewGuid(),
            CompanyId = TestCompanyId,
            TenantId = TestTenantId,
            Name = "Test Project",
            Number = "PRJ-001",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        _db.Set<Project>().Add(project);
        _db.SaveChanges();
        return project.Id;
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    #region GET

    [Fact]
    public async Task Get_ReturnsOk_WithDefaultSettings()
    {
        var result = await _controller.Get();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);

        var settings = ok.Value.Should().BeOfType<TimecardSettingsResponse>().Subject;
        settings.TimecardMode.Should().Be(TimecardMode.Daily);
        settings.WeeklyEntryMode.Should().Be(WeeklyEntryMode.Detailed);
        settings.DefaultProjectId.Should().BeNull();
        settings.RequirePhase.Should().BeFalse();
        settings.RequireEquipment.Should().BeFalse();
    }

    [Fact]
    public async Task Get_NoActiveCompany_Returns404()
    {
        // Create controller with unresolved company context
        var tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var emptyCompanyContext = new CompanyContext(); // CompanyId = Guid.Empty => !IsResolved
        var controller = new TimecardSettingsController(_db, emptyCompanyContext);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        var result = await controller.Get();

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region PUT

    [Fact]
    public async Task Update_ReturnsOk_WithUpdatedSettings()
    {
        var projectId = SeedProject();
        var request = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Weekly,
            WeeklyEntryMode: WeeklyEntryMode.Simple,
            DefaultProjectId: projectId,
            RequirePhase: true,
            RequireEquipment: true,
            WeekStartDay: 1);

        var result = await _controller.Update(request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = ok.Value.Should().BeOfType<TimecardSettingsResponse>().Subject;
        settings.TimecardMode.Should().Be(TimecardMode.Weekly);
        settings.WeeklyEntryMode.Should().Be(WeeklyEntryMode.Simple);
        settings.DefaultProjectId.Should().Be(projectId);
        settings.RequirePhase.Should().BeTrue();
        settings.RequireEquipment.Should().BeTrue();
    }

    [Fact]
    public async Task Update_PersistsToDatabase()
    {
        var projectId = SeedProject();
        var request = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Weekly,
            WeeklyEntryMode: WeeklyEntryMode.Simple,
            DefaultProjectId: projectId,
            RequirePhase: true,
            RequireEquipment: false,
            WeekStartDay: 1);

        await _controller.Update(request);

        // Re-fetch from DB to verify persistence
        var company = await _db.Companies
            .IgnoreQueryFilters()
            .FirstAsync(c => c.Id == TestCompanyId);

        company.TimecardSettings.TimecardMode.Should().Be(TimecardMode.Weekly);
        company.TimecardSettings.WeeklyEntryMode.Should().Be(WeeklyEntryMode.Simple);
        company.TimecardSettings.DefaultProjectId.Should().Be(projectId);
        company.TimecardSettings.RequirePhase.Should().BeTrue();
        company.TimecardSettings.RequireEquipment.Should().BeFalse();
    }

    [Fact]
    public async Task Update_ClearDefaultProject_SetsToNull()
    {
        // First set a project
        var seededProjectId = SeedProject();
        var firstRequest = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Daily,
            WeeklyEntryMode: WeeklyEntryMode.Detailed,
            DefaultProjectId: seededProjectId,
            RequirePhase: false,
            RequireEquipment: false,
            WeekStartDay: 1);
        await _controller.Update(firstRequest);

        // Then clear it
        var clearRequest = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Daily,
            WeeklyEntryMode: WeeklyEntryMode.Detailed,
            DefaultProjectId: null,
            RequirePhase: false,
            RequireEquipment: false,
            WeekStartDay: 1);

        var result = await _controller.Update(clearRequest);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = ok.Value.Should().BeOfType<TimecardSettingsResponse>().Subject;
        settings.DefaultProjectId.Should().BeNull();
    }

    [Fact]
    public async Task Update_NoActiveCompany_Returns404()
    {
        var tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var emptyCompanyContext = new CompanyContext();
        var controller = new TimecardSettingsController(_db, emptyCompanyContext);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        var request = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Weekly,
            WeeklyEntryMode: WeeklyEntryMode.Detailed,
            DefaultProjectId: null,
            RequirePhase: false,
            RequireEquipment: false,
            WeekStartDay: 1);

        var result = await controller.Update(request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_InvalidDefaultProjectId_ReturnsBadRequest()
    {
        var request = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Daily,
            WeeklyEntryMode: WeeklyEntryMode.Detailed,
            DefaultProjectId: Guid.NewGuid(), // not seeded
            RequirePhase: false,
            RequireEquipment: false,
            WeekStartDay: 1);

        var result = await _controller.Update(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_AllEnumValues_AreValid()
    {
        // Test Daily mode
        var dailyRequest = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Daily,
            WeeklyEntryMode: WeeklyEntryMode.Detailed,
            DefaultProjectId: null,
            RequirePhase: false,
            RequireEquipment: false,
            WeekStartDay: 1);

        var dailyResult = await _controller.Update(dailyRequest);
        dailyResult.Should().BeOfType<OkObjectResult>();

        // Test Weekly mode with Simple entry
        var weeklyRequest = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Weekly,
            WeeklyEntryMode: WeeklyEntryMode.Simple,
            DefaultProjectId: null,
            RequirePhase: false,
            RequireEquipment: false,
            WeekStartDay: 1);

        var weeklyResult = await _controller.Update(weeklyRequest);
        weeklyResult.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Get_AfterUpdate_ReturnsUpdatedValues()
    {
        var projectId = SeedProject();
        var request = new UpdateTimecardSettingsRequest(
            TimecardMode: TimecardMode.Weekly,
            WeeklyEntryMode: WeeklyEntryMode.Simple,
            DefaultProjectId: projectId,
            RequirePhase: true,
            RequireEquipment: true,
            WeekStartDay: 1);

        await _controller.Update(request);

        var result = await _controller.Get();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = ok.Value.Should().BeOfType<TimecardSettingsResponse>().Subject;
        settings.TimecardMode.Should().Be(TimecardMode.Weekly);
        settings.WeeklyEntryMode.Should().Be(WeeklyEntryMode.Simple);
        settings.DefaultProjectId.Should().Be(projectId);
        settings.RequirePhase.Should().BeTrue();
        settings.RequireEquipment.Should().BeTrue();
    }

    #endregion
}
