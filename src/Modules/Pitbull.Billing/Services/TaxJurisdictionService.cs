using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Logging;

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
        if (cmd.Name.Trim().Length > 200)
            return Result.Failure<TaxJurisdictionDto>("Name cannot exceed 200 characters", "VALIDATION_ERROR");
        if (string.IsNullOrWhiteSpace(cmd.Code))
            return Result.Failure<TaxJurisdictionDto>("Code is required", "VALIDATION_ERROR");
        if (cmd.Code.Trim().Length > 50)
            return Result.Failure<TaxJurisdictionDto>("Code cannot exceed 50 characters", "VALIDATION_ERROR");
        if (cmd.State is { Length: > 50 })
            return Result.Failure<TaxJurisdictionDto>("State cannot exceed 50 characters", "VALIDATION_ERROR");
        if (cmd.County is { Length: > 100 })
            return Result.Failure<TaxJurisdictionDto>("County cannot exceed 100 characters", "VALIDATION_ERROR");
        if (cmd.City is { Length: > 100 })
            return Result.Failure<TaxJurisdictionDto>("City cannot exceed 100 characters", "VALIDATION_ERROR");
        // Rates are stored as percent points (e.g. 7.25 for 7.25%), not fractions.
        if (cmd.StateRate is < 0 or > 100 || cmd.CountyRate is < 0 or > 100 || cmd.CityRate is < 0 or > 100)
            return Result.Failure<TaxJurisdictionDto>("Tax rates must be between 0 and 100 percent", "VALIDATION_ERROR");
        if (cmd.Rates is { Count: > 50 })
            return Result.Failure<TaxJurisdictionDto>("Cannot have more than 50 category rates", "VALIDATION_ERROR");

        var jurisdiction = new TaxJurisdiction
        {
            Name = cmd.Name.Trim(),
            Code = cmd.Code.Trim(),
            State = cmd.State?.Trim(),
            County = cmd.County?.Trim(),
            City = cmd.City?.Trim(),
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
                if (rate.Rate is < 0 or > 100)
                    return Result.Failure<TaxJurisdictionDto>("Category tax rates must be between 0 and 100 percent", "VALIDATION_ERROR");
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

        logger.LogInformation("Created tax jurisdiction {Code} ({Name})", LogSafe.Text(jurisdiction.Code), LogSafe.Text(jurisdiction.Name));

        return Result.Success(MapToDto(jurisdiction));
    }

    public async Task<Result<TaxJurisdictionDto>> UpdateAsync(Guid id, UpdateTaxJurisdictionCommand cmd, CancellationToken ct = default)
    {
        var jurisdiction = await db.Set<TaxJurisdiction>()
            .Include(j => j.Rates)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        if (jurisdiction is null)
            return Result.Failure<TaxJurisdictionDto>("Tax jurisdiction not found", "NOT_FOUND");

        if (cmd.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(cmd.Name) || cmd.Name.Trim().Length > 200)
                return Result.Failure<TaxJurisdictionDto>("Name is required and cannot exceed 200 characters", "VALIDATION_ERROR");
            jurisdiction.Name = cmd.Name.Trim();
        }
        if (cmd.Code is not null)
        {
            if (string.IsNullOrWhiteSpace(cmd.Code) || cmd.Code.Trim().Length > 50)
                return Result.Failure<TaxJurisdictionDto>("Code is required and cannot exceed 50 characters", "VALIDATION_ERROR");
            jurisdiction.Code = cmd.Code.Trim();
        }
        if (cmd.State is not null)
        {
            if (cmd.State.Length > 50)
                return Result.Failure<TaxJurisdictionDto>("State cannot exceed 50 characters", "VALIDATION_ERROR");
            jurisdiction.State = cmd.State.Trim();
        }
        if (cmd.County is not null)
        {
            if (cmd.County.Length > 100)
                return Result.Failure<TaxJurisdictionDto>("County cannot exceed 100 characters", "VALIDATION_ERROR");
            jurisdiction.County = cmd.County.Trim();
        }
        if (cmd.City is not null)
        {
            if (cmd.City.Length > 100)
                return Result.Failure<TaxJurisdictionDto>("City cannot exceed 100 characters", "VALIDATION_ERROR");
            jurisdiction.City = cmd.City.Trim();
        }
        if (cmd.IsActive.HasValue) jurisdiction.IsActive = cmd.IsActive.Value;
        if (cmd.EffectiveDate.HasValue) jurisdiction.EffectiveDate = cmd.EffectiveDate.Value;
        if (cmd.ExpirationDate.HasValue) jurisdiction.ExpirationDate = cmd.ExpirationDate.Value;

        if (cmd.StateRate.HasValue)
        {
            if (cmd.StateRate.Value is < 0 or > 100)
                return Result.Failure<TaxJurisdictionDto>("Tax rates must be between 0 and 100 percent", "VALIDATION_ERROR");
            jurisdiction.StateRate = cmd.StateRate.Value;
        }
        if (cmd.CountyRate.HasValue)
        {
            if (cmd.CountyRate.Value is < 0 or > 100)
                return Result.Failure<TaxJurisdictionDto>("Tax rates must be between 0 and 100 percent", "VALIDATION_ERROR");
            jurisdiction.CountyRate = cmd.CountyRate.Value;
        }
        if (cmd.CityRate.HasValue)
        {
            if (cmd.CityRate.Value is < 0 or > 100)
                return Result.Failure<TaxJurisdictionDto>("Tax rates must be between 0 and 100 percent", "VALIDATION_ERROR");
            jurisdiction.CityRate = cmd.CityRate.Value;
        }

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
