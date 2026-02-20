using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.WageDeterminations;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class WageDeterminationService(PitbullDbContext db, ILogger<WageDeterminationService> logger) : IWageDeterminationService
{
    public async Task<Result<ListWageDeterminationsResult>> ListAsync(ListWageDeterminationsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<WageDetermination> dbQuery = db.Set<WageDetermination>()
            .AsNoTracking()
            .Include(x => x.Rates)
            .ThenInclude(x => x.WorkClassification);

        if (query.ProjectId.HasValue)
            dbQuery = dbQuery.Where(x => x.ProjectId == query.ProjectId.Value);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(x => x.Status == query.Status.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<WageDetermination> items = await dbQuery
            .OrderByDescending(x => x.EffectiveDate)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListWageDeterminationsResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<WageDeterminationDto>> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        WageDetermination? entity = await db.Set<WageDetermination>()
            .AsNoTracking()
            .Include(x => x.Rates)
            .ThenInclude(x => x.WorkClassification)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
            return Result.Failure<WageDeterminationDto>("Wage determination not found", "NOT_FOUND");

        return Result.Success(MapToDto(entity));
    }

    public async Task<Result<WageDeterminationDto>> CreateAsync(CreateWageDeterminationCommand command, CancellationToken cancellationToken = default)
    {
        if (command.ProjectId == Guid.Empty)
            return Result.Failure<WageDeterminationDto>("Project is required", "VALIDATION_ERROR");

        if (string.IsNullOrWhiteSpace(command.DeterminationNumber))
            return Result.Failure<WageDeterminationDto>("Determination number is required", "VALIDATION_ERROR");

        WageDetermination determination = new()
        {
            ProjectId = command.ProjectId,
            JurisdictionType = command.JurisdictionType,
            DeterminationNumber = command.DeterminationNumber.Trim(),
            SourceAgency = string.IsNullOrWhiteSpace(command.SourceAgency) ? null : command.SourceAgency.Trim(),
            EffectiveDate = command.EffectiveDate,
            ExpirationDate = command.ExpirationDate,
            Status = command.Status
        };

        foreach (CreateWageDeterminationRateInput rate in command.Rates)
        {
            if (rate.WorkClassificationId == Guid.Empty)
                continue;

            determination.Rates.Add(new WageDeterminationRate
            {
                WorkClassificationId = rate.WorkClassificationId,
                BaseRate = rate.BaseRate,
                FringeRate = rate.FringeRate,
                TotalRate = rate.TotalRate <= 0 ? rate.BaseRate + rate.FringeRate : rate.TotalRate
            });
        }

        db.Set<WageDetermination>().Add(determination);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(await LoadDtoAsync(determination.Id, cancellationToken));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create wage determination for project {ProjectId}", command.ProjectId);
            return Result.Failure<WageDeterminationDto>("Failed to create wage determination", "DATABASE_ERROR");
        }
    }

    public async Task<Result<WageDeterminationDto>> UpdateAsync(UpdateWageDeterminationCommand command, CancellationToken cancellationToken = default)
    {
        WageDetermination? determination = await db.Set<WageDetermination>()
            .Include(x => x.Rates)
            .FirstOrDefaultAsync(x => x.Id == command.WageDeterminationId, cancellationToken);

        if (determination is null)
            return Result.Failure<WageDeterminationDto>("Wage determination not found", "NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(command.DeterminationNumber))
            determination.DeterminationNumber = command.DeterminationNumber.Trim();

        if (command.SourceAgency is not null)
            determination.SourceAgency = string.IsNullOrWhiteSpace(command.SourceAgency) ? null : command.SourceAgency.Trim();

        if (command.EffectiveDate.HasValue)
            determination.EffectiveDate = command.EffectiveDate.Value;

        if (command.ExpirationDate.HasValue)
            determination.ExpirationDate = command.ExpirationDate.Value;

        if (command.Status.HasValue)
            determination.Status = command.Status.Value;

        if (command.Rates is not null)
        {
            db.Set<WageDeterminationRate>().RemoveRange(determination.Rates);
            determination.Rates.Clear();

            foreach (CreateWageDeterminationRateInput rate in command.Rates)
            {
                if (rate.WorkClassificationId == Guid.Empty)
                    continue;

                determination.Rates.Add(new WageDeterminationRate
                {
                    WorkClassificationId = rate.WorkClassificationId,
                    BaseRate = rate.BaseRate,
                    FringeRate = rate.FringeRate,
                    TotalRate = rate.TotalRate <= 0 ? rate.BaseRate + rate.FringeRate : rate.TotalRate
                });
            }
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(await LoadDtoAsync(determination.Id, cancellationToken));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<WageDeterminationDto>("Wage determination was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update wage determination {WageDeterminationId}", command.WageDeterminationId);
            return Result.Failure<WageDeterminationDto>("Failed to update wage determination", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        WageDetermination? determination = await db.Set<WageDetermination>()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (determination is null)
            return Result.Failure("Wage determination not found", "NOT_FOUND");

        db.Set<WageDetermination>().Remove(determination);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete wage determination {WageDeterminationId}", id);
            return Result.Failure("Failed to delete wage determination", "DATABASE_ERROR");
        }
    }

    public async Task<Result<ApplicableWageRateDto>> LookupRateAsync(ApplicableWageRateLookup lookup, CancellationToken cancellationToken = default)
    {
        WageDeterminationRate? rate = await db.Set<WageDeterminationRate>()
            .AsNoTracking()
            .Include(x => x.WorkClassification)
            .Include(x => x.WageDetermination)
            .Where(x => x.WorkClassificationId == lookup.WorkClassificationId)
            .Where(x => x.WageDetermination.ProjectId == lookup.ProjectId)
            .Where(x => x.WageDetermination.Status == WageDeterminationStatus.Active)
            .Where(x => x.WageDetermination.EffectiveDate <= lookup.WorkDate)
            .Where(x => x.WageDetermination.ExpirationDate == null || x.WageDetermination.ExpirationDate >= lookup.WorkDate)
            .OrderByDescending(x => x.WageDetermination.EffectiveDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (rate is null)
            return Result.Failure<ApplicableWageRateDto>("No applicable wage determination rate found", "NOT_FOUND");

        return Result.Success(new ApplicableWageRateDto(
            WageDeterminationId: rate.WageDeterminationId,
            WageDeterminationRateId: rate.Id,
            WorkClassificationId: rate.WorkClassificationId,
            ClassificationCode: rate.WorkClassification.Code,
            BaseRate: rate.BaseRate,
            FringeRate: rate.FringeRate,
            TotalRate: rate.TotalRate,
            EffectiveDate: rate.WageDetermination.EffectiveDate,
            ExpirationDate: rate.WageDetermination.ExpirationDate));
    }

    private async Task<WageDeterminationDto> LoadDtoAsync(Guid id, CancellationToken cancellationToken)
    {
        WageDetermination entity = await db.Set<WageDetermination>()
            .AsNoTracking()
            .Include(x => x.Rates)
            .ThenInclude(x => x.WorkClassification)
            .FirstAsync(x => x.Id == id, cancellationToken);

        return MapToDto(entity);
    }

    private static WageDeterminationDto MapToDto(WageDetermination entity)
    {
        return new WageDeterminationDto(
            Id: entity.Id,
            ProjectId: entity.ProjectId,
            JurisdictionType: entity.JurisdictionType,
            DeterminationNumber: entity.DeterminationNumber,
            SourceAgency: entity.SourceAgency,
            EffectiveDate: entity.EffectiveDate,
            ExpirationDate: entity.ExpirationDate,
            Status: entity.Status,
            StatusName: entity.Status.ToString(),
            Rates: entity.Rates
                .OrderBy(x => x.WorkClassification.Code)
                .Select(x => new WageDeterminationRateDto(
                    Id: x.Id,
                    WorkClassificationId: x.WorkClassificationId,
                    ClassificationCode: x.WorkClassification.Code,
                    ClassificationName: x.WorkClassification.Name,
                    BaseRate: x.BaseRate,
                    FringeRate: x.FringeRate,
                    TotalRate: x.TotalRate))
                .ToList(),
            CreatedAt: entity.CreatedAt,
            UpdatedAt: entity.UpdatedAt);
    }
}
