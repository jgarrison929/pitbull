using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.Vendors;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Billing;

public sealed class VendorServiceTests
{
    private static VendorService CreateService(PitbullDbContext db) =>
        new(db, NullLogger<VendorService>.Instance);

    [Fact]
    public async Task CreateVendorAsync_MissingNameOrCode_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        VendorService service = CreateService(db);

        var result = await service.CreateVendorAsync(new CreateVendorCommand(Name: "", Code: " "));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateVendorAsync_DuplicateCode_ReturnsDuplicateError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        VendorService service = CreateService(db);
        await SeedVendorAsync(db, code: "V-100");

        var result = await service.CreateVendorAsync(new CreateVendorCommand(
            Name: "Duplicate Vendor",
            Code: "V-100"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CODE");
    }

    [Fact]
    public async Task UpdateVendorAsync_DuplicateCode_ReturnsDuplicateError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        VendorService service = CreateService(db);
        await SeedVendorAsync(db, code: "V-001");
        Vendor vendorToUpdate = await SeedVendorAsync(db, code: "V-002");

        var result = await service.UpdateVendorAsync(new UpdateVendorCommand(
            VendorId: vendorToUpdate.Id,
            Code: "V-001"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CODE");
    }

    [Fact]
    public async Task UpdateVendorAsync_IsActiveToggleAndTrim_UpdatesState()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        VendorService service = CreateService(db);
        Vendor vendor = await SeedVendorAsync(db, code: "V-200", isActive: true);

        var result = await service.UpdateVendorAsync(new UpdateVendorCommand(
            VendorId: vendor.Id,
            Name: " Updated Vendor ",
            IsActive: false,
            PaymentTerms: "Net 45"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Updated Vendor");
        result.Value.IsActive.Should().BeFalse();
        result.Value.PaymentTerms.Should().Be("Net 45");
    }

    [Fact]
    public async Task DeleteVendorAsync_ExistingVendor_DeletesAndSubsequentGetNotFound()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        VendorService service = CreateService(db);
        Vendor vendor = await SeedVendorAsync(db, code: "V-300");

        var deleteResult = await service.DeleteVendorAsync(vendor.Id);
        var getResult = await service.GetVendorAsync(vendor.Id);

        deleteResult.IsSuccess.Should().BeTrue();
        getResult.IsSuccess.Should().BeFalse();
        getResult.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetVendorsAsync_SearchByTradeClassificationAndPagingDefaults_Works()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        VendorService service = CreateService(db);
        await SeedVendorAsync(db, code: "V-500", name: "River Electric", tradeClassification: "Electrical");
        await SeedVendorAsync(db, code: "V-600", name: "Ace Concrete", tradeClassification: "Concrete");

        var result = await service.GetVendorsAsync(new ListVendorsQuery(
            SearchTerm: "  ELECTRICAL ",
            IsActive: null,
            Page: 0,
            PageSize: 0));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Code.Should().Be("V-500");
        result.Value.Page.Should().Be(1);
        result.Value.PageSize.Should().Be(25);
    }

    private static async Task<Vendor> SeedVendorAsync(
        PitbullDbContext db,
        string code,
        string name = "Test Vendor",
        string? tradeClassification = null,
        bool isActive = true)
    {
        Vendor vendor = new()
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = name,
            Code = code,
            TradeClassification = tradeClassification,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Vendor>().Add(vendor);
        await db.SaveChangesAsync();
        return vendor;
    }
}
