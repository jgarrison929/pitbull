using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Domain;
using Pitbull.Core.Data;

namespace Pitbull.Billing.Services;

public class TaxCalculationService(
    PitbullDbContext db,
    ILogger<TaxCalculationService> logger) : ITaxCalculationService
{
    public async Task<TaxCalculationResult> CalculateTaxAsync(
        decimal amount,
        Guid jurisdictionId,
        TaxCategory category,
        Guid? projectId = null,
        Guid? vendorId = null,
        CancellationToken ct = default)
    {
        // Check exemptions first
        if (await IsTaxExemptAsync(projectId, vendorId, category, ct))
        {
            return new TaxCalculationResult(amount, 0m, 0m, true, "Tax-exempt entity");
        }

        var rate = await GetEffectiveRateAsync(jurisdictionId, category, ct);

        var taxAmount = Math.Round(amount * rate / 100m, 2, MidpointRounding.AwayFromZero);

        return new TaxCalculationResult(amount, rate, taxAmount, false, null);
    }

    public async Task<IReadOnlyList<TaxCalculationResult>> CalculateBulkTaxAsync(
        IReadOnlyList<TaxLineInput> lines,
        Guid jurisdictionId,
        Guid? projectId = null,
        Guid? vendorId = null,
        CancellationToken ct = default)
    {
        var results = new List<TaxCalculationResult>(lines.Count);

        foreach (var line in lines)
        {
            var result = await CalculateTaxAsync(
                line.Amount, jurisdictionId, line.Category,
                projectId, vendorId, ct);
            results.Add(result);
        }

        return results;
    }

    public async Task<bool> IsTaxExemptAsync(
        Guid? projectId,
        Guid? vendorId,
        TaxCategory category,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var query = db.Set<TaxExemption>()
            .AsNoTracking()
            .Where(e => e.IsActive
                && e.EffectiveDate <= today
                && (e.ExpirationDate == null || e.ExpirationDate >= today)
                && (e.ExemptCategory == category || e.ExemptCategory == TaxCategory.All));

        if (projectId.HasValue)
        {
            var projectExempt = await query.AnyAsync(e =>
                e.Scope == TaxExemptionScope.Project && e.EntityId == projectId.Value, ct);
            if (projectExempt) return true;
        }

        if (vendorId.HasValue)
        {
            var vendorExempt = await query.AnyAsync(e =>
                e.Scope == TaxExemptionScope.Vendor && e.EntityId == vendorId.Value, ct);
            if (vendorExempt) return true;
        }

        // Check company-wide exemption
        var companyExempt = await query.AnyAsync(e =>
            e.Scope == TaxExemptionScope.Company && e.EntityId == null, ct);

        return companyExempt;
    }

    private async Task<decimal> GetEffectiveRateAsync(Guid jurisdictionId, TaxCategory category, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Try category-specific rate first — most recent effective date wins.
        // Also verify the parent jurisdiction is active and not deleted.
        var specificRate = await db.Set<TaxRate>()
            .AsNoTracking()
            .Where(r => r.TaxJurisdictionId == jurisdictionId
                && r.Category == category
                && r.IsActive
                && r.EffectiveDate <= today
                && (r.ExpirationDate == null || r.ExpirationDate >= today)
                && r.TaxJurisdiction.IsActive && !r.TaxJurisdiction.IsDeleted)
            .OrderByDescending(r => r.EffectiveDate)
            .Select(r => (decimal?)r.Rate)
            .FirstOrDefaultAsync(ct);

        if (specificRate.HasValue)
            return specificRate.Value;

        // Fall back to jurisdiction combined rate — check date validity
        var combinedRate = await db.Set<TaxJurisdiction>()
            .AsNoTracking()
            .Where(j => j.Id == jurisdictionId
                && j.IsActive
                && j.EffectiveDate <= today
                && (j.ExpirationDate == null || j.ExpirationDate >= today))
            .Select(j => (decimal?)j.CombinedRate)
            .FirstOrDefaultAsync(ct);

        if (combinedRate.HasValue)
            return combinedRate.Value;

        logger.LogWarning("No tax rate found for jurisdiction {JurisdictionId}, category {Category}", jurisdictionId, category);
        return 0m;
    }
}
