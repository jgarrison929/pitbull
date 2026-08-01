using FluentAssertions;
using Pitbull.SystemAdmin.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.SystemAdmin;

public sealed class TenantSettingsBoundsTests
{
    [Fact]
    public async Task Upsert_RejectsOversizedCompanyName()
    {
        using var db = TestDbContextFactory.Create();
        var service = new TenantSettingsService(db);

        var result = await service.UpsertSettingsAsync(new UpsertTenantSettingsCommand(
            CompanyName: new string('C', 201),
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
            FiscalYearStartMonth: 1,
            EnableTimeTracking: true,
            EnableBidManagement: true,
            EnableDocumentManagement: true,
            EnableSubcontractorPortal: false));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("200");
    }

    [Fact]
    public async Task Upsert_RejectsInvalidFiscalMonth()
    {
        using var db = TestDbContextFactory.Create();
        var service = new TenantSettingsService(db);

        var result = await service.UpsertSettingsAsync(new UpsertTenantSettingsCommand(
            CompanyName: "Acme Construction",
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
            FiscalYearStartMonth: 13,
            EnableTimeTracking: true,
            EnableBidManagement: true,
            EnableDocumentManagement: true,
            EnableSubcontractorPortal: false));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("1 and 12");
    }

    [Fact]
    public async Task Upsert_AcceptsValidSettings()
    {
        using var db = TestDbContextFactory.Create();
        var service = new TenantSettingsService(db);

        var result = await service.UpsertSettingsAsync(new UpsertTenantSettingsCommand(
            CompanyName: "Acme Construction",
            LogoUrl: null,
            PrimaryColor: "#112233",
            Address: "1 Main St",
            City: "Austin",
            State: "TX",
            ZipCode: "78701",
            Phone: "555-0100",
            Website: "https://acme.example",
            TaxId: "12-3456789",
            Timezone: "America/Chicago",
            DateFormat: "MM/dd/yyyy",
            Currency: "usd",
            FiscalYearStartMonth: 1,
            EnableTimeTracking: true,
            EnableBidManagement: true,
            EnableDocumentManagement: true,
            EnableSubcontractorPortal: false));

        result.IsSuccess.Should().BeTrue();
        result.Value!.CompanyName.Should().Be("Acme Construction");
        result.Value.Currency.Should().Be("USD");
    }
}
