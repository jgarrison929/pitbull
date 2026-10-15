using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Pitbull.Core.Domain;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Services;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Tests.Unit.Payroll;

public sealed class PayrollTaxEngineTests
{
    [Fact]
    public void UnconfiguredEngine_IsNotConfigured()
    {
        var engine = new CheckPayrollTaxEngine(Options.Create(new PayrollTaxOptions()));
        engine.IsConfigured.Should().BeFalse();
        engine.OverlayPack.Should().Be("us_tax");
    }

    [Fact]
    public async Task Calculate_WithoutCredentials_FailsClosed()
    {
        var engine = new CheckPayrollTaxEngine(Options.Create(new PayrollTaxOptions { Vendor = "check" }));

        var result = await engine.CalculateAsync(EmptyRequest());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("TAX_VENDOR_NOT_CONFIGURED");
        result.Error.Should().NotContain("7.65");
        result.Error.Should().NotContain("12%");
    }

    [Fact]
    public async Task Calculate_WithCredentials_DoesNotCallLiveApiOrInventPercents()
    {
        var engine = new CheckPayrollTaxEngine(Options.Create(new PayrollTaxOptions
        {
            Vendor = "check",
            ApiKey = "test-key"
        }));

        var result = await engine.CalculateAsync(EmptyRequest());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("TAX_VENDOR_NOT_IMPLEMENTED");
        result.Error.Should().Contain("does not call live vendor APIs");
        result.Error.Should().NotContain("7.65");
        result.Error.Should().NotContain("0.0765");
        result.Error.Should().NotContain("0.12");
    }

    [Fact]
    public async Task Ingest_StoresVendorSnapshotMetadata()
    {
        using var db = TestDbContextFactory.Create();
        var service = new TaxTableVersionIngestService(db, NullLogger<TaxTableVersionIngestService>.Instance);

        var result = await service.IngestAsync(new IngestTaxTableVersionCommand(
            Vendor: PayrollTaxVendor.Check,
            Jurisdiction: "US-CA",
            EffectiveDate: new DateOnly(2026, 1, 1),
            ContentHash: "sha256:abc",
            Notes: "provider is SoR, no local tables"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Vendor.Should().Be(PayrollTaxVendor.Check);
        result.Value.Jurisdiction.Should().Be("US-CA");
        result.Value.ContentHash.Should().Be("sha256:abc");
        db.Set<TaxTableVersion>().Should().ContainSingle();
    }

    private static PayrollTaxCalculationRequest EmptyRequest()
    {
        return new PayrollTaxCalculationRequest(
            Guid.NewGuid(),
            new DateOnly(2026, 2, 15),
            Array.Empty<EmployeeWageSlice>(),
            Array.Empty<EmployeeTaxProfile>(),
            null);
    }
}
