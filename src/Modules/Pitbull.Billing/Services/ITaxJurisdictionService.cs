using Pitbull.Billing.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface ITaxJurisdictionService
{
    Task<Result<IReadOnlyList<TaxJurisdictionDto>>> ListAsync(string? state = null, CancellationToken ct = default);
    Task<Result<TaxJurisdictionDto>> GetAsync(Guid id, CancellationToken ct = default);
    Task<Result<TaxJurisdictionDto>> CreateAsync(CreateTaxJurisdictionCommand cmd, CancellationToken ct = default);
    Task<Result<TaxJurisdictionDto>> UpdateAsync(Guid id, UpdateTaxJurisdictionCommand cmd, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface ITaxCalculationService
{
    /// <summary>
    /// Calculate tax for a line item given a jurisdiction and category.
    /// Returns 0 if the project or vendor is tax-exempt.
    /// </summary>
    Task<TaxCalculationResult> CalculateTaxAsync(
        decimal amount,
        Guid jurisdictionId,
        TaxCategory category,
        Guid? projectId = null,
        Guid? vendorId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Calculate tax for multiple line items at once.
    /// </summary>
    Task<IReadOnlyList<TaxCalculationResult>> CalculateBulkTaxAsync(
        IReadOnlyList<TaxLineInput> lines,
        Guid jurisdictionId,
        Guid? projectId = null,
        Guid? vendorId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Check if a project or vendor is tax-exempt for a given category.
    /// </summary>
    Task<bool> IsTaxExemptAsync(
        Guid? projectId,
        Guid? vendorId,
        TaxCategory category,
        CancellationToken ct = default);
}

public record TaxJurisdictionDto(
    Guid Id,
    string Name,
    string Code,
    string? State,
    string? County,
    string? City,
    decimal CombinedRate,
    decimal StateRate,
    decimal CountyRate,
    decimal CityRate,
    bool IsActive,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    IReadOnlyList<TaxRateDto> Rates);

public record TaxRateDto(
    Guid Id,
    string Category,
    decimal Rate,
    bool IsActive,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate);

public record CreateTaxJurisdictionCommand(
    string Name,
    string Code,
    string? State,
    string? County,
    string? City,
    decimal StateRate,
    decimal CountyRate,
    decimal CityRate,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    IReadOnlyList<CreateTaxRateCommand>? Rates);

public record UpdateTaxJurisdictionCommand(
    string? Name,
    string? Code,
    string? State,
    string? County,
    string? City,
    decimal? StateRate,
    decimal? CountyRate,
    decimal? CityRate,
    bool? IsActive,
    DateOnly? EffectiveDate,
    DateOnly? ExpirationDate);

public record CreateTaxRateCommand(
    TaxCategory Category,
    decimal Rate,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate);

public record TaxCalculationResult(
    decimal TaxableAmount,
    decimal TaxRate,
    decimal TaxAmount,
    bool IsExempt,
    string? ExemptReason);

public record TaxLineInput(
    decimal Amount,
    TaxCategory Category);
