using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Controllers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class AdminCompanyControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();

    private readonly PitbullDbContext _db;
    private readonly AdminCompanyController _controller;

    public AdminCompanyControllerTests()
    {
        var tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyContext = new CompanyContext { CompanyId = TestCompanyId, CompanyCode = "01", CompanyName = "Test Co" };

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _controller = new AdminCompanyController(_db, companyContext);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task SeedCompany(Action<Company>? configure = null)
    {
        var company = new Company
        {
            Id = TestCompanyId,
            TenantId = TestTenantId,
            Code = "01",
            Name = "My Company",
            Timezone = "America/Los_Angeles",
            DateFormat = "MM/dd/yyyy",
            Currency = "USD",
            FiscalYearStartMonth = 1,
            PayPeriodType = "Weekly",
            DefaultWorkWeekDays = "Mon,Tue,Wed,Thu,Fri",
            OvertimeSettings = new OvertimeSettings
            {
                Enabled = true,
                DailyOtThreshold = 8,
                WeeklyOtThreshold = 40,
                DailyDtThreshold = 12,
                CaliforniaOtRules = false
            }
        };
        configure?.Invoke(company);
        _db.Companies.Add(company);
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetSettings_ReturnsNotFound_WhenNoCompanyExists()
    {
        var result = await _controller.GetSettings(CancellationToken.None);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetSettings_ReturnsSettings_WhenCompanyExists()
    {
        await SeedCompany();

        var result = await _controller.GetSettings(CancellationToken.None);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<CompanySettingsDto>().Subject;
        settings.Name.Should().Be("My Company");
        settings.Timezone.Should().Be("America/Los_Angeles");
        settings.DateFormat.Should().Be("MM/dd/yyyy");
        settings.Currency.Should().Be("USD");
        settings.FiscalYearStartMonth.Should().Be(1);
        settings.OvertimeEnabled.Should().BeTrue();
        settings.DailyOtThreshold.Should().Be(8);
        settings.WeeklyOtThreshold.Should().Be(40);
    }

    [Fact]
    public async Task UpdateSettings_ReturnsUpdatedSettings()
    {
        await SeedCompany();

        var request = new UpdateCompanySettingsRequest
        {
            Name = "Pitbull Construction",
            Address = "123 Main St",
            City = "Los Angeles",
            State = "CA",
            ZipCode = "90001",
            Phone = "555-1234",
            Timezone = "America/New_York",
            Currency = "EUR",
            FiscalYearStartMonth = 7,
            OvertimeEnabled = false,
            DailyOtThreshold = 10
        };

        var result = await _controller.UpdateSettings(request, CancellationToken.None);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<CompanySettingsDto>().Subject;
        settings.Name.Should().Be("Pitbull Construction");
        settings.Address.Should().Be("123 Main St");
        settings.City.Should().Be("Los Angeles");
        settings.State.Should().Be("CA");
        settings.Timezone.Should().Be("America/New_York");
        settings.Currency.Should().Be("EUR");
        settings.FiscalYearStartMonth.Should().Be(7);
        settings.OvertimeEnabled.Should().BeFalse();
        settings.DailyOtThreshold.Should().Be(10);
    }

    [Fact]
    public async Task UpdateSettings_ReturnsNotFound_WhenNoCompanyExists()
    {
        var request = new UpdateCompanySettingsRequest { Name = "Test" };

        var result = await _controller.UpdateSettings(request, CancellationToken.None);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task UpdateSettings_OnlyUpdatesProvidedFields()
    {
        await SeedCompany();

        // Only update name, leave everything else null
        var request = new UpdateCompanySettingsRequest { Name = "Updated Name" };

        var result = await _controller.UpdateSettings(request, CancellationToken.None);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<CompanySettingsDto>().Subject;
        settings.Name.Should().Be("Updated Name");
        // Unchanged fields should keep defaults
        settings.Timezone.Should().Be("America/Los_Angeles");
        settings.Currency.Should().Be("USD");
        settings.OvertimeEnabled.Should().BeTrue();
        settings.DailyOtThreshold.Should().Be(8);
    }
}
