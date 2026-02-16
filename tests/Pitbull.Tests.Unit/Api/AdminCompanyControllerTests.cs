using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Api.Controllers;

namespace Pitbull.Tests.Unit.Api;

public class AdminCompanyControllerTests
{
    private static AdminCompanyController CreateController(Guid tenantId)
    {
        var claims = new[] { new Claim("tenant_id", tenantId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var controller = new AdminCompanyController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
        return controller;
    }

    [Fact]
    public void GetSettings_ReturnsDefaults_WhenNoSettingsStored()
    {
        // Use a unique tenant ID that won't collide with other tests
        var tenantId = Guid.NewGuid();
        var controller = CreateController(tenantId);

        var result = controller.GetSettings();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<CompanySettingsDto>().Subject;
        settings.CompanyName.Should().Be("My Company");
        settings.Timezone.Should().Be("America/Los_Angeles");
        settings.DateFormat.Should().Be("MM/dd/yyyy");
        settings.Currency.Should().Be("USD");
        settings.FiscalYearStartMonth.Should().Be(1);
    }

    [Fact]
    public void UpdateSettings_StoresAndReturnsSettings()
    {
        var tenantId = Guid.NewGuid();
        var controller = CreateController(tenantId);

        var request = new UpdateCompanySettingsRequest
        {
            CompanyName = "Pitbull Construction",
            Address = "123 Main St",
            City = "Los Angeles",
            State = "CA",
            ZipCode = "90001",
            Phone = "555-1234",
            Timezone = "America/New_York",
            Currency = "EUR",
            FiscalYearStartMonth = 7
        };

        var result = controller.UpdateSettings(request);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<CompanySettingsDto>().Subject;
        settings.CompanyName.Should().Be("Pitbull Construction");
        settings.Address.Should().Be("123 Main St");
        settings.City.Should().Be("Los Angeles");
        settings.State.Should().Be("CA");
        settings.Timezone.Should().Be("America/New_York");
        settings.Currency.Should().Be("EUR");
        settings.FiscalYearStartMonth.Should().Be(7);
    }

    [Fact]
    public void GetSettings_ReturnsStoredSettings_AfterUpdate()
    {
        var tenantId = Guid.NewGuid();
        var controller = CreateController(tenantId);

        var request = new UpdateCompanySettingsRequest
        {
            CompanyName = "Updated Company",
            Timezone = "Europe/London",
            DateFormat = "dd/MM/yyyy",
            Currency = "GBP",
            FiscalYearStartMonth = 4
        };

        controller.UpdateSettings(request);

        // Now GET should return the stored settings
        var result = controller.GetSettings();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<CompanySettingsDto>().Subject;
        settings.CompanyName.Should().Be("Updated Company");
        settings.Timezone.Should().Be("Europe/London");
        settings.Currency.Should().Be("GBP");
        settings.FiscalYearStartMonth.Should().Be(4);
    }

    [Fact]
    public void Settings_ArePerTenant()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        var controllerA = CreateController(tenantA);
        var controllerB = CreateController(tenantB);

        // Update tenant A settings
        controllerA.UpdateSettings(new UpdateCompanySettingsRequest
        {
            CompanyName = "Tenant A Company",
            Currency = "USD"
        });

        // Update tenant B settings
        controllerB.UpdateSettings(new UpdateCompanySettingsRequest
        {
            CompanyName = "Tenant B Company",
            Currency = "EUR"
        });

        // Verify tenant A gets its own settings
        var resultA = controllerA.GetSettings();
        var settingsA = ((OkObjectResult)resultA).Value as CompanySettingsDto;
        settingsA!.CompanyName.Should().Be("Tenant A Company");
        settingsA.Currency.Should().Be("USD");

        // Verify tenant B gets its own settings
        var resultB = controllerB.GetSettings();
        var settingsB = ((OkObjectResult)resultB).Value as CompanySettingsDto;
        settingsB!.CompanyName.Should().Be("Tenant B Company");
        settingsB.Currency.Should().Be("EUR");
    }

    [Fact]
    public void UpdateSettings_DefaultsNullTimezoneAndCurrency()
    {
        var tenantId = Guid.NewGuid();
        var controller = CreateController(tenantId);

        var request = new UpdateCompanySettingsRequest
        {
            CompanyName = "Minimal Company"
            // Timezone, DateFormat, Currency, FiscalYearStartMonth are null
        };

        var result = controller.UpdateSettings(request);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<CompanySettingsDto>().Subject;
        settings.Timezone.Should().Be("America/Los_Angeles");
        settings.DateFormat.Should().Be("MM/dd/yyyy");
        settings.Currency.Should().Be("USD");
        settings.FiscalYearStartMonth.Should().Be(1);
    }
}
