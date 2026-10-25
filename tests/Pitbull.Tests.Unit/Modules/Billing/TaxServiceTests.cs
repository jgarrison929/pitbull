using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Domain;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Xunit;

namespace Pitbull.Tests.Unit.Modules.Billing;

public class TaxServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();

    private readonly PitbullDbContext _db;
    private readonly TaxJurisdictionService _jurisdictionService;
    private readonly TaxCalculationService _calculationService;

    public TaxServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId, CompanyName = "TestCo" };

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _jurisdictionService = new TaxJurisdictionService(_db, NullLogger<TaxJurisdictionService>.Instance);
        _calculationService = new TaxCalculationService(_db, NullLogger<TaxCalculationService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // --- Jurisdiction CRUD ---

    [Fact]
    public async Task CreateJurisdiction_ValidData_Succeeds()
    {
        var cmd = new CreateTaxJurisdictionCommand(
            Name: "Denver Metro",
            Code: "CO-DENVER",
            State: "CO",
            County: "Denver",
            City: "Denver",
            StateRate: 2.9m,
            CountyRate: 1.0m,
            CityRate: 4.81m,
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null,
            Rates: null);

        var result = await _jurisdictionService.CreateAsync(cmd);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CombinedRate.Should().Be(8.71m);
        result.Value.State.Should().Be("CO");
        result.Value.Code.Should().Be("CO-DENVER");
    }

    [Fact]
    public async Task CreateJurisdiction_WithRates_CreatesRates()
    {
        var cmd = new CreateTaxJurisdictionCommand(
            Name: "Austin TX",
            Code: "TX-AUSTIN",
            State: "TX",
            County: "Travis",
            City: "Austin",
            StateRate: 6.25m,
            CountyRate: 0m,
            CityRate: 2.0m,
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null,
            Rates:
            [
                new CreateTaxRateCommand(TaxCategory.Materials, 8.25m, new DateOnly(2026, 1, 1), null),
                new CreateTaxRateCommand(TaxCategory.Labor, 0m, new DateOnly(2026, 1, 1), null),
                new CreateTaxRateCommand(TaxCategory.Equipment, 8.25m, new DateOnly(2026, 1, 1), null)
            ]);

        var result = await _jurisdictionService.CreateAsync(cmd);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Rates.Should().HaveCount(3);
        result.Value.Rates.First(r => r.Category == "Labor").Rate.Should().Be(0m);
    }

    [Fact]
    public async Task CreateJurisdiction_MissingName_Fails()
    {
        var cmd = new CreateTaxJurisdictionCommand(
            Name: "",
            Code: "INVALID",
            State: null, County: null, City: null,
            StateRate: 0, CountyRate: 0, CityRate: 0,
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null, Rates: null);

        var result = await _jurisdictionService.CreateAsync(cmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task GetJurisdiction_ExistingId_ReturnsJurisdiction()
    {
        var created = await CreateTestJurisdiction();

        var result = await _jurisdictionService.GetAsync(created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Test Jurisdiction");
    }

    [Fact]
    public async Task GetJurisdiction_NonExistent_ReturnsNotFound()
    {
        var result = await _jurisdictionService.GetAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateJurisdiction_ChangeRates_RecalculatesCombined()
    {
        var created = await CreateTestJurisdiction();

        var updateCmd = new UpdateTaxJurisdictionCommand(
            StateRate: 5.0m, CountyRate: 1.5m, CityRate: 2.5m,
            Name: null, Code: null, State: null, County: null, City: null,
            IsActive: null, EffectiveDate: null, ExpirationDate: null);

        var result = await _jurisdictionService.UpdateAsync(created.Id, updateCmd);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CombinedRate.Should().Be(9.0m);
    }

    [Fact]
    public async Task DeleteJurisdiction_Existing_SoftDeletes()
    {
        var created = await CreateTestJurisdiction();

        var result = await _jurisdictionService.DeleteAsync(created.Id);

        result.IsSuccess.Should().BeTrue();

        // Should not be found after delete (soft delete + query filter)
        var getResult = await _jurisdictionService.GetAsync(created.Id);
        getResult.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task ListJurisdictions_FilterByState_FiltersCorrectly()
    {
        await CreateTestJurisdiction("CO Jurisdiction", "CO-TEST", "CO");
        await CreateTestJurisdiction("TX Jurisdiction", "TX-TEST", "TX");

        var result = await _jurisdictionService.ListAsync("CO");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(1);
        result.Value[0].State.Should().Be("CO");
    }

    // --- Tax Calculation ---

    [Fact]
    public async Task CalculateTax_MaterialsWithRate_ReturnsCorrectTax()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Materials, 8.25m);

        var result = await _calculationService.CalculateTaxAsync(
            1000m, jurisdiction.Id, TaxCategory.Materials);

        result.TaxRate.Should().Be(8.25m);
        result.TaxAmount.Should().Be(82.50m);
        result.IsExempt.Should().BeFalse();
    }

    [Fact]
    public async Task CalculateTax_LaborZeroRate_ReturnsZeroTax()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Labor, 0m);

        var result = await _calculationService.CalculateTaxAsync(
            5000m, jurisdiction.Id, TaxCategory.Labor);

        result.TaxRate.Should().Be(0m);
        result.TaxAmount.Should().Be(0m);
    }

    [Fact]
    public async Task CalculateTax_FallsBackToJurisdictionCombinedRate()
    {
        var created = await CreateTestJurisdiction();

        // No category-specific rate, should use combined rate (7.5%)
        var result = await _calculationService.CalculateTaxAsync(
            1000m, created.Id, TaxCategory.Other);

        result.TaxRate.Should().Be(7.5m);
        result.TaxAmount.Should().Be(75m);
    }

    [Fact]
    public async Task CalculateTax_ExemptProject_ReturnsZero()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Materials, 8.25m);
        var projectId = Guid.NewGuid();

        // Create tax exemption for this project
        _db.Set<TaxExemption>().Add(new TaxExemption
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Scope = TaxExemptionScope.Project,
            EntityId = projectId,
            ExemptCategory = TaxCategory.All,
            EffectiveDate = new DateOnly(2025, 1, 1),
            IsActive = true
        });
        await _db.SaveChangesAsync();

        var result = await _calculationService.CalculateTaxAsync(
            1000m, jurisdiction.Id, TaxCategory.Materials, projectId: projectId);

        result.IsExempt.Should().BeTrue();
        result.TaxAmount.Should().Be(0m);
    }

    [Fact]
    public async Task CalculateTax_ExemptVendor_ReturnsZero()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Materials, 8.25m);
        var vendorId = Guid.NewGuid();

        _db.Set<TaxExemption>().Add(new TaxExemption
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Scope = TaxExemptionScope.Vendor,
            EntityId = vendorId,
            ExemptCategory = TaxCategory.Materials,
            EffectiveDate = new DateOnly(2025, 1, 1),
            IsActive = true
        });
        await _db.SaveChangesAsync();

        var result = await _calculationService.CalculateTaxAsync(
            1000m, jurisdiction.Id, TaxCategory.Materials, vendorId: vendorId);

        result.IsExempt.Should().BeTrue();
        result.TaxAmount.Should().Be(0m);
    }

    [Fact]
    public async Task CalculateBulkTax_MultipleLines_CalculatesEach()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Materials, 8.25m);

        var lines = new List<TaxLineInput>
        {
            new(1000m, TaxCategory.Materials),
            new(2000m, TaxCategory.Materials),
            new(500m, TaxCategory.Materials)
        };

        var results = await _calculationService.CalculateBulkTaxAsync(
            lines, jurisdiction.Id);

        results.Should().HaveCount(3);
        results[0].TaxAmount.Should().Be(82.50m);
        results[1].TaxAmount.Should().Be(165.00m);
        results[2].TaxAmount.Should().Be(41.25m);
    }

    [Fact]
    public async Task IsTaxExempt_NoExemption_ReturnsFalse()
    {
        var result = await _calculationService.IsTaxExemptAsync(
            Guid.NewGuid(), null, TaxCategory.Materials);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task CalculateTax_ExpiredExemption_NotExempt()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Materials, 8.25m);
        var projectId = Guid.NewGuid();

        _db.Set<TaxExemption>().Add(new TaxExemption
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Scope = TaxExemptionScope.Project,
            EntityId = projectId,
            ExemptCategory = TaxCategory.All,
            EffectiveDate = new DateOnly(2020, 1, 1),
            ExpirationDate = new DateOnly(2024, 12, 31),
            IsActive = true
        });
        await _db.SaveChangesAsync();

        var result = await _calculationService.CalculateTaxAsync(
            1000m, jurisdiction.Id, TaxCategory.Materials, projectId: projectId);

        result.IsExempt.Should().BeFalse();
        result.TaxAmount.Should().Be(82.50m);
    }

    [Fact]
    public async Task CalculateTax_RoundsCorrectly()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Materials, 8.875m);

        var result = await _calculationService.CalculateTaxAsync(
            33.33m, jurisdiction.Id, TaxCategory.Materials);

        // 33.33 * 8.875 / 100 = 2.958...  → rounds to 2.96
        result.TaxAmount.Should().Be(2.96m);
    }

    // --- Precision & Edge Cases ---

    [Fact]
    public async Task CalculateTax_RateAbove10Percent_WorksCorrectly()
    {
        // Combined rates above 10% are common (e.g., 10.25% in some CA jurisdictions)
        var cmd = new CreateTaxJurisdictionCommand(
            Name: "High Tax", Code: "HIGH-TAX", State: "CA",
            County: "LA", City: "Los Angeles",
            StateRate: 7.25m, CountyRate: 1.0m, CityRate: 2.0m,
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null,
            Rates: [new CreateTaxRateCommand(TaxCategory.Materials, 10.25m, new DateOnly(2026, 1, 1), null)]);

        var result = await _jurisdictionService.CreateAsync(cmd);
        result.IsSuccess.Should().BeTrue();
        result.Value!.CombinedRate.Should().Be(10.25m);

        var taxResult = await _calculationService.CalculateTaxAsync(
            1000m, result.Value.Id, TaxCategory.Materials);

        taxResult.TaxRate.Should().Be(10.25m);
        taxResult.TaxAmount.Should().Be(102.50m);
    }

    [Fact]
    public async Task CalculateTax_MultipleRates_MostRecentWins()
    {
        var jurisdiction = await CreateTestJurisdiction("Rate Order Test", "RATE-ORDER");

        // Add two rates for the same category with different effective dates
        _db.Set<TaxRate>().Add(new TaxRate
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            TaxJurisdictionId = Guid.Parse(jurisdiction.Id.ToString()),
            Category = TaxCategory.Materials,
            Rate = 5.0m,
            IsActive = true,
            EffectiveDate = new DateOnly(2025, 1, 1)
        });
        _db.Set<TaxRate>().Add(new TaxRate
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            TaxJurisdictionId = jurisdiction.Id,
            Category = TaxCategory.Materials,
            Rate = 8.5m,
            IsActive = true,
            EffectiveDate = new DateOnly(2026, 1, 1)
        });
        await _db.SaveChangesAsync();

        var result = await _calculationService.CalculateTaxAsync(
            1000m, jurisdiction.Id, TaxCategory.Materials);

        // The 2026 rate (8.5%) should win over the 2025 rate (5.0%)
        result.TaxRate.Should().Be(8.5m);
        result.TaxAmount.Should().Be(85.0m);
    }

    [Fact]
    public async Task CalculateTax_DeletedJurisdiction_ReturnsZero()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Materials, 8.25m);

        // Soft-delete the jurisdiction
        var entity = await _db.Set<TaxJurisdiction>().FindAsync(jurisdiction.Id);
        entity!.IsDeleted = true;
        await _db.SaveChangesAsync();

        // Detach so the calc service re-queries
        _db.ChangeTracker.Clear();

        var result = await _calculationService.CalculateTaxAsync(
            1000m, jurisdiction.Id, TaxCategory.Materials);

        // Should return 0 since the jurisdiction is deleted
        result.TaxRate.Should().Be(0m);
        result.TaxAmount.Should().Be(0m);
    }

    [Fact]
    public async Task CalculateTax_InactiveJurisdiction_ReturnsZero()
    {
        var jurisdiction = await CreateTestJurisdictionWithRate(TaxCategory.Materials, 8.25m);

        // Deactivate the jurisdiction
        var entity = await _db.Set<TaxJurisdiction>().FindAsync(jurisdiction.Id);
        entity!.IsActive = false;
        await _db.SaveChangesAsync();

        _db.ChangeTracker.Clear();

        var result = await _calculationService.CalculateTaxAsync(
            1000m, jurisdiction.Id, TaxCategory.Materials);

        result.TaxRate.Should().Be(0m);
        result.TaxAmount.Should().Be(0m);
    }

    // --- Helpers ---

    private async Task<TaxJurisdictionDto> CreateTestJurisdiction(
        string name = "Test Jurisdiction",
        string code = "TEST",
        string state = "CO")
    {
        var cmd = new CreateTaxJurisdictionCommand(
            Name: name, Code: code, State: state,
            County: null, City: null,
            StateRate: 2.9m, CountyRate: 1.1m, CityRate: 3.5m,
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null, Rates: null);

        var result = await _jurisdictionService.CreateAsync(cmd);
        return result.Value!;
    }

    private async Task<TaxJurisdictionDto> CreateTestJurisdictionWithRate(TaxCategory category, decimal rate)
    {
        var cmd = new CreateTaxJurisdictionCommand(
            Name: $"Test-{category}", Code: $"TEST-{category}",
            State: "CO", County: null, City: null,
            StateRate: 2.9m, CountyRate: 0m, CityRate: 0m,
            EffectiveDate: new DateOnly(2026, 1, 1),
            ExpirationDate: null,
            Rates: [new CreateTaxRateCommand(category, rate, new DateOnly(2026, 1, 1), null)]);

        var result = await _jurisdictionService.CreateAsync(cmd);
        return result.Value!;
    }
}
