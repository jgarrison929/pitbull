using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.SystemAdmin.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.SystemAdmin;

[Collection("SystemAdmin")]
public sealed class TenantSettingsServiceTests
{
    [Fact]
    public async Task GetSettings_NoExistingRow_ReturnsDefaultValues()
    {
        using var db = TestDbContextFactory.Create();
        var service = new TenantSettingsService(db);

        var result = await service.GetSettingsAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value!.CompanyName.Should().Be("My Company");
        result.Value.Timezone.Should().Be("America/Los_Angeles");
        result.Value.EnableTimeTracking.Should().BeTrue();
        result.Value.EnableBidManagement.Should().BeTrue();
        result.Value.EnableDocumentManagement.Should().BeTrue();
        result.Value.EnableSubcontractorPortal.Should().BeFalse();
    }

    [Fact]
    public async Task UpsertSettings_CreateNewRow_PersistsFlagsAndCompanyData()
    {
        using var db = TestDbContextFactory.Create();
        var service = new TenantSettingsService(db);

        var upsert = await service.UpsertSettingsAsync(new UpsertTenantSettingsCommand(
            CompanyName: "Pitbull Construction",
            LogoUrl: "/logo.svg",
            PrimaryColor: "#ff6600",
            Address: "123 Main",
            City: "Austin",
            State: "TX",
            ZipCode: "78701",
            Phone: "555-0101",
            Website: "https://pitbull.local",
            TaxId: "12-3456789",
            Timezone: "America/Chicago",
            DateFormat: "yyyy-MM-dd",
            Currency: "USD",
            FiscalYearStartMonth: 7,
            EnableTimeTracking: false,
            EnableBidManagement: true,
            EnableDocumentManagement: false,
            EnableSubcontractorPortal: true));

        upsert.IsSuccess.Should().BeTrue();
        upsert.Value!.CompanyName.Should().Be("Pitbull Construction");
        upsert.Value.EnableTimeTracking.Should().BeFalse();
        upsert.Value.EnableBidManagement.Should().BeTrue();
        upsert.Value.EnableDocumentManagement.Should().BeFalse();
        upsert.Value.EnableSubcontractorPortal.Should().BeTrue();

        var rows = await db.Set<Pitbull.SystemAdmin.Domain.TenantSettings>().CountAsync();
        rows.Should().Be(1);
    }

    [Fact]
    public async Task UpsertSettings_ExistingRow_UpdatesSameRecord()
    {
        using var db = TestDbContextFactory.Create();
        var service = new TenantSettingsService(db);

        var first = await service.UpsertSettingsAsync(new UpsertTenantSettingsCommand(
            "First Name", null, null, null, null, null, null, null, null, null,
            "America/New_York", "MM/dd/yyyy", "USD", 1, true, true, true, false));
        first.IsSuccess.Should().BeTrue();

        var second = await service.UpsertSettingsAsync(new UpsertTenantSettingsCommand(
            "Updated Name", null, "#000000", null, "Denver", "CO", null, null, null, null,
            null, null, null, null, null, null, null, null));

        second.IsSuccess.Should().BeTrue();
        second.Value!.Id.Should().Be(first.Value!.Id);
        second.Value.CompanyName.Should().Be("Updated Name");
        second.Value.City.Should().Be("Denver");
        second.Value.PrimaryColor.Should().Be("#000000");

        var rows = await db.Set<Pitbull.SystemAdmin.Domain.TenantSettings>().CountAsync();
        rows.Should().Be(1);
    }

    [Fact]
    public async Task UpsertSettings_NullOptionalValues_UseServiceFallbackDefaults()
    {
        using var db = TestDbContextFactory.Create();
        var service = new TenantSettingsService(db);

        var result = await service.UpsertSettingsAsync(new UpsertTenantSettingsCommand(
            CompanyName: "Fallback Test",
            LogoUrl: null,
            PrimaryColor: null,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            Phone: null,
            Website: null,
            TaxId: null,
            Timezone: null,
            DateFormat: null,
            Currency: null,
            FiscalYearStartMonth: null,
            EnableTimeTracking: null,
            EnableBidManagement: null,
            EnableDocumentManagement: null,
            EnableSubcontractorPortal: null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Timezone.Should().Be("America/Los_Angeles");
        result.Value.DateFormat.Should().Be("MM/dd/yyyy");
        result.Value.Currency.Should().Be("USD");
        result.Value.FiscalYearStartMonth.Should().Be(1);
        result.Value.EnableTimeTracking.Should().BeTrue();
        result.Value.EnableBidManagement.Should().BeTrue();
        result.Value.EnableDocumentManagement.Should().BeTrue();
        result.Value.EnableSubcontractorPortal.Should().BeFalse();
    }
}
