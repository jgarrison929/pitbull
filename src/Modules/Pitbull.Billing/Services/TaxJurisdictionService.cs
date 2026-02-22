using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Billing.Services;

public class TaxJurisdictionService(
    PitbullDbContext db,
    ILogger<TaxJurisdictionService> logger) : ITaxJurisdictionService
{
    public async Task<Result<IReadOnlyList<TaxJurisdictionDto>>> ListAsync(string? state = null, CancellationToken ct = default)
    {
        var query = db.Set<TaxJurisdiction>()
            .AsNoTracking()
            .Include(j => j.Rates)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(state))
            query = query.Where(j => j.State == state);

        var jurisdictions = await query
            .OrderBy(j => j.State).ThenBy(j => j.Name)
            .ToListAsync(ct);

        IReadOnlyList<TaxJurisdictionDto> dtos = jurisdictions.Select(MapToDto).ToList();
        return Result.Success(dtos);
    }

    public async Task<Result<TaxJurisdictionDto>> GetAsync(Guid id, CancellationToken ct = default)
    {
        var jurisdiction = await db.Set<TaxJurisdiction>()
            .AsNoTracking()
            .Include(j => j.Rates)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        if (jurisdiction is null)
            return Result.Failure<TaxJurisdictionDto>("Tax jurisdiction not found", "NOT_FOUND");

        return Result.Success(MapToDto(jurisdiction));
    }

    public async Task<Result<TaxJurisdictionDto>> CreateAsync(CreateTaxJurisdictionCommand cmd, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(cmd.Name))
            return Result.Failure<TaxJurisdictionDto>("Name is required", "VALIDATION_ERROR");

        if (string.IsNullOrWhiteSpace(cmd.Code))
            return Result.Failure<TaxJurisdictionDto>("Code is required", "VALIDATION_ERROR");

        var jurisdiction = new TaxJurisdiction
        {
            Name = cmd.Name,
            Code = cmd.Code,
            State = cmd.State,
            County = cmd.County,
            City = cmd.City,
            StateRate = cmd.StateRate,
            CountyRate = cmd.CountyRate,
            CityRate = cmd.CityRate,
            CombinedRate = cmd.StateRate + cmd.CountyRate + cmd.CityRate,
            EffectiveDate = cmd.EffectiveDate,
            ExpirationDate = cmd.ExpirationDate
        };

        if (cmd.Rates is { Count: > 0 })
        {
            foreach (var rate in cmd.Rates)
            {
                jurisdiction.Rates.Add(new TaxRate
                {
                    TaxJurisdictionId = jurisdiction.Id,
                    Category = rate.Category,
                    Rate = rate.Rate,
                    EffectiveDate = rate.EffectiveDate,
                    ExpirationDate = rate.ExpirationDate
                });
            }
        }

        db.Set<TaxJurisdiction>().Add(jurisdiction);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Created tax jurisdiction {Code} ({Name})", jurisdiction.Code, jurisdiction.Name);

        return Result.Success(MapToDto(jurisdiction));
    }

    public async Task<Result<TaxJurisdictionDto>> UpdateAsync(Guid id, UpdateTaxJurisdictionCommand cmd, CancellationToken ct = default)
    {
        var jurisdiction = await db.Set<TaxJurisdiction>()
            .Include(j => j.Rates)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        if (jurisdiction is null)
            return Result.Failure<TaxJurisdictionDto>("Tax jurisdiction not found", "NOT_FOUND");

        if (cmd.Name is not null) jurisdiction.Name = cmd.Name;
        if (cmd.Code is not null) jurisdiction.Code = cmd.Code;
        if (cmd.State is not null) jurisdiction.State = cmd.State;
        if (cmd.County is not null) jurisdiction.County = cmd.County;
        if (cmd.City is not null) jurisdiction.City = cmd.City;
        if (cmd.IsActive.HasValue) jurisdiction.IsActive = cmd.IsActive.Value;
        if (cmd.EffectiveDate.HasValue) jurisdiction.EffectiveDate = cmd.EffectiveDate.Value;
        if (cmd.ExpirationDate.HasValue) jurisdiction.ExpirationDate = cmd.ExpirationDate.Value;

        if (cmd.StateRate.HasValue) jurisdiction.StateRate = cmd.StateRate.Value;
        if (cmd.CountyRate.HasValue) jurisdiction.CountyRate = cmd.CountyRate.Value;
        if (cmd.CityRate.HasValue) jurisdiction.CityRate = cmd.CityRate.Value;

        jurisdiction.CombinedRate = jurisdiction.StateRate + jurisdiction.CountyRate + jurisdiction.CityRate;

        await db.SaveChangesAsync(ct);

        return Result.Success(MapToDto(jurisdiction));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var jurisdiction = await db.Set<TaxJurisdiction>()
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        if (jurisdiction is null)
            return Result.Failure("Tax jurisdiction not found", "NOT_FOUND");

        db.Set<TaxJurisdiction>().Remove(jurisdiction);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }

    private static TaxJurisdictionDto MapToDto(TaxJurisdiction j) => new(
        j.Id, j.Name, j.Code, j.State, j.County, j.City,
        j.CombinedRate, j.StateRate, j.CountyRate, j.CityRate,
        j.IsActive, j.EffectiveDate, j.ExpirationDate,
        j.Rates.Select(r => new TaxRateDto(
            r.Id, r.Category.ToString(), r.Rate, r.IsActive,
            r.EffectiveDate, r.ExpirationDate)).ToList());
}
