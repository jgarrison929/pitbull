using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.SystemAdmin.Services;

namespace Pitbull.Tests.Unit.Api;

public class AdminCompanyControllerTests
{
    private static (AdminCompanyController controller, Mock<ITenantSettingsService> mock) CreateController(Guid tenantId)
    {
        var claims = new[] { new Claim("tenant_id", tenantId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var mockService = new Mock<ITenantSettingsService>();
        var controller = new AdminCompanyController(mockService.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
        return (controller, mockService);
    }

    private static TenantSettingsDto DefaultSettings(Guid id = default) => new(
        id == default ? Guid.NewGuid() : id,
        "My Company", null, null, null, null, null, null, null, null, null,
        "America/Los_Angeles", "MM/dd/yyyy", "USD", 1,
        true, true, true, false
    );

    [Fact]
    public async Task GetSettings_ReturnsDefaults_WhenNoSettingsStored()
    {
        var tenantId = Guid.NewGuid();
        var (controller, mock) = CreateController(tenantId);
        var dto = DefaultSettings();

        mock.Setup(s => s.GetSettingsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(dto));

        var result = await controller.GetSettings();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<TenantSettingsDto>().Subject;
        settings.CompanyName.Should().Be("My Company");
        settings.Timezone.Should().Be("America/Los_Angeles");
        settings.DateFormat.Should().Be("MM/dd/yyyy");
        settings.Currency.Should().Be("USD");
        settings.FiscalYearStartMonth.Should().Be(1);
    }

    [Fact]
    public async Task UpdateSettings_ReturnsUpdatedSettings()
    {
        var tenantId = Guid.NewGuid();
        var (controller, mock) = CreateController(tenantId);

        var command = new UpsertTenantSettingsCommand(
            "Pitbull Construction", null, null, "123 Main St", "Los Angeles", "CA",
            "90001", "555-1234", null, null, "America/New_York", null, "EUR", 7,
            null, null, null, null
        );

        var responseDto = new TenantSettingsDto(
            Guid.NewGuid(), "Pitbull Construction", null, null, "123 Main St",
            "Los Angeles", "CA", "90001", "555-1234", null, null,
            "America/New_York", "MM/dd/yyyy", "EUR", 7,
            true, true, true, false
        );

        mock.Setup(s => s.UpsertSettingsAsync(It.IsAny<UpsertTenantSettingsCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(responseDto));

        var result = await controller.UpdateSettings(command);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var settings = okResult.Value.Should().BeOfType<TenantSettingsDto>().Subject;
        settings.CompanyName.Should().Be("Pitbull Construction");
        settings.Address.Should().Be("123 Main St");
        settings.City.Should().Be("Los Angeles");
        settings.State.Should().Be("CA");
        settings.Timezone.Should().Be("America/New_York");
        settings.Currency.Should().Be("EUR");
        settings.FiscalYearStartMonth.Should().Be(7);
    }

    [Fact]
    public async Task UpdateSettings_ReturnsBadRequest_OnFailure()
    {
        var tenantId = Guid.NewGuid();
        var (controller, mock) = CreateController(tenantId);

        var command = new UpsertTenantSettingsCommand(
            "", null, null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null
        );

        mock.Setup(s => s.UpsertSettingsAsync(It.IsAny<UpsertTenantSettingsCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<TenantSettingsDto>("Company name is required", "VALIDATION_ERROR"));

        var result = await controller.UpdateSettings(command);

        result.Should().BeOfType<BadRequestObjectResult>();
    }
}
