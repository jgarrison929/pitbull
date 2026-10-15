using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features.WagePackages;

namespace Pitbull.Payroll.Services;

public interface IWagePackageService
{
    Task<Result<ListWagePackagesResult>> ListAsync(ListWagePackagesQuery query, CancellationToken cancellationToken = default);
    Task<Result<WagePackageDto>> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<WagePackageDto>> CreateAsync(CreateWagePackageCommand command, CancellationToken cancellationToken = default);
    Task<Result<WagePackageDto>> UpdateAsync(UpdateWagePackageCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class WagePackageService(PitbullDbContext db, ILogger<WagePackageService> logger) : IWagePackageService
{
    public async Task<Result<ListWagePackagesResult>> ListAsync(ListWagePackagesQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<WagePackage> dbQuery = db.Set<WagePackage>()
            .AsNoTracking()
            .Include(x => x.Rates).ThenInclude(x => x.PayComponent)
            .Where(x => !x.IsDeleted);

        if (query.UnionAgreementId.HasValue)
            dbQuery = dbQuery.Where(x => x.UnionAgreementId == query.UnionAgreementId.Value);
        if (query.WorkClassificationId.HasValue)
            dbQuery = dbQuery.Where(x => x.WorkClassificationId == query.WorkClassificationId.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<WagePackage> items = await dbQuery
            .OrderByDescending(x => x.EffectiveDate)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListWagePackagesResult(items.Select(Map).ToList(), totalCount, page, pageSize, totalPages));
    }

    public async Task<Result<WagePackageDto>> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        WagePackage? entity = await LoadAsync(id, cancellationToken);
        if (entity is null)
            return Result.Failure<WagePackageDto>("Wage package not found", "NOT_FOUND");
        return Result.Success(Map(entity));
    }

    public async Task<Result<WagePackageDto>> CreateAsync(CreateWagePackageCommand command, CancellationToken cancellationToken = default)
    {
        if (command.UnionAgreementId == Guid.Empty)
            return Result.Failure<WagePackageDto>("Union agreement is required", "VALIDATION_ERROR");
        if (command.WorkClassificationId == Guid.Empty)
            return Result.Failure<WagePackageDto>("Work classification is required", "VALIDATION_ERROR");

        bool agreementExists = await db.Set<UnionAgreement>().AnyAsync(x => x.Id == command.UnionAgreementId && !x.IsDeleted, cancellationToken);
        if (!agreementExists)
            return Result.Failure<WagePackageDto>("Union agreement not found", "NOT_FOUND");

        bool classExists = await db.Set<WorkClassification>().AnyAsync(x => x.Id == command.WorkClassificationId && !x.IsDeleted, cancellationToken);
        if (!classExists)
            return Result.Failure<WagePackageDto>("Work classification not found", "NOT_FOUND");

        WagePackage entity = new()
        {
            UnionAgreementId = command.UnionAgreementId,
            WorkClassificationId = command.WorkClassificationId,
            ScaleCode = string.IsNullOrWhiteSpace(command.ScaleCode) ? "Journeyman" : command.ScaleCode.Trim(),
            ZoneCode = EmptyToNull(command.ZoneCode),
            ShiftCode = EmptyToNull(command.ShiftCode),
            EffectiveDate = command.EffectiveDate,
            ExpirationDate = command.ExpirationDate
        };

        Result? rateError = await AddRatesAsync(entity, command.Rates, cancellationToken);
        if (rateError is not null)
            return Result.Failure<WagePackageDto>(rateError.Error ?? "Invalid rates", rateError.ErrorCode);

        db.Set<WagePackage>().Add(entity);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            WagePackage? loaded = await LoadAsync(entity.Id, cancellationToken);
            return Result.Success(Map(loaded!));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create wage package for agreement {AgreementId}", command.UnionAgreementId);
            return Result.Failure<WagePackageDto>("Failed to create wage package", "DATABASE_ERROR");
        }
    }

    public async Task<Result<WagePackageDto>> UpdateAsync(UpdateWagePackageCommand command, CancellationToken cancellationToken = default)
    {
        WagePackage? entity = await db.Set<WagePackage>()
            .Include(x => x.Rates)
            .FirstOrDefaultAsync(x => x.Id == command.Id && !x.IsDeleted, cancellationToken);

        if (entity is null)
            return Result.Failure<WagePackageDto>("Wage package not found", "NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(command.ScaleCode))
            entity.ScaleCode = command.ScaleCode.Trim();
        if (command.ZoneCode is not null)
            entity.ZoneCode = EmptyToNull(command.ZoneCode);
        if (command.ShiftCode is not null)
            entity.ShiftCode = EmptyToNull(command.ShiftCode);
        if (command.EffectiveDate.HasValue)
            entity.EffectiveDate = command.EffectiveDate.Value;
        if (command.ExpirationDate.HasValue)
            entity.ExpirationDate = command.ExpirationDate;

        if (command.Rates is not null)
        {
            db.Set<WagePackageRate>().RemoveRange(entity.Rates);
            entity.Rates.Clear();
            Result? rateError = await AddRatesAsync(entity, command.Rates, cancellationToken);
            if (rateError is not null)
                return Result.Failure<WagePackageDto>(rateError.Error ?? "Invalid rates", rateError.ErrorCode);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            WagePackage? loaded = await LoadAsync(entity.Id, cancellationToken);
            return Result.Success(Map(loaded!));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<WagePackageDto>("Wage package was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update wage package {Id}", command.Id);
            return Result.Failure<WagePackageDto>("Failed to update wage package", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        WagePackage? entity = await db.Set<WagePackage>()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);

        if (entity is null)
            return Result.Failure("Wage package not found", "NOT_FOUND");

        entity.IsDeleted = true;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete wage package {Id}", id);
            return Result.Failure("Failed to delete wage package", "DATABASE_ERROR");
        }
    }

    private async Task<WagePackage?> LoadAsync(Guid id, CancellationToken cancellationToken) =>
        await db.Set<WagePackage>()
            .AsNoTracking()
            .Include(x => x.Rates).ThenInclude(x => x.PayComponent)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);

    private async Task<Result?> AddRatesAsync(WagePackage entity, IReadOnlyList<WagePackageRateInput>? rates, CancellationToken cancellationToken)
    {
        if (rates is null)
            return null;

        foreach (WagePackageRateInput rate in rates)
        {
            if (rate.PayComponentId == Guid.Empty)
                return Result.Failure("Pay component is required for each rate", "VALIDATION_ERROR");

            bool exists = await db.Set<PayComponent>().AnyAsync(x => x.Id == rate.PayComponentId && !x.IsDeleted, cancellationToken);
            if (!exists)
                return Result.Failure("Pay component not found", "NOT_FOUND");

            entity.Rates.Add(new WagePackageRate
            {
                PayComponentId = rate.PayComponentId,
                HourlyRate = rate.HourlyRate,
                Amount = rate.Amount,
                Unit = rate.Unit,
                FringeMethod = rate.FringeMethod
            });
        }

        return null;
    }

    private static WagePackageDto Map(WagePackage x) => new(
        x.Id,
        x.UnionAgreementId,
        x.WorkClassificationId,
        x.ScaleCode,
        x.ZoneCode,
        x.ShiftCode,
        x.EffectiveDate,
        x.ExpirationDate,
        x.Rates.Where(r => !r.IsDeleted).Select(r => new WagePackageRateDto(
            r.Id,
            r.PayComponentId,
            r.PayComponent?.Code ?? string.Empty,
            r.HourlyRate,
            r.Amount,
            r.Unit,
            r.FringeMethod)).ToList(),
        x.CreatedAt,
        x.UpdatedAt);

    private static string? EmptyToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
