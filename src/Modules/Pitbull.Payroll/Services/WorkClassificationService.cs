using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Payroll.Features.WorkClassifications;

namespace Pitbull.Payroll.Services;

public interface IWorkClassificationService
{
    Task<Result<ListWorkClassificationsResult>> ListAsync(ListWorkClassificationsQuery query, CancellationToken cancellationToken = default);
    Task<Result<WorkClassificationDto>> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<WorkClassificationDto>> CreateAsync(CreateWorkClassificationCommand command, CancellationToken cancellationToken = default);
    Task<Result<WorkClassificationDto>> UpdateAsync(UpdateWorkClassificationCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class WorkClassificationService(PitbullDbContext db, ILogger<WorkClassificationService> logger) : IWorkClassificationService
{
    public async Task<Result<ListWorkClassificationsResult>> ListAsync(ListWorkClassificationsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<WorkClassification> dbQuery = db.Set<WorkClassification>().AsNoTracking().Where(x => !x.IsDeleted);

        if (query.IsActive.HasValue)
            dbQuery = dbQuery.Where(x => x.IsActive == query.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string term = query.Search.Trim();
            dbQuery = dbQuery.Where(x => x.Code.Contains(term) || x.Name.Contains(term) || (x.Craft != null && x.Craft.Contains(term)));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<WorkClassification> items = await dbQuery
            .OrderBy(x => x.Code)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListWorkClassificationsResult(items.Select(Map).ToList(), totalCount, page, pageSize, totalPages));
    }

    public async Task<Result<WorkClassificationDto>> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        WorkClassification? entity = await db.Set<WorkClassification>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);

        if (entity is null)
            return Result.Failure<WorkClassificationDto>("Work classification not found", "NOT_FOUND");

        return Result.Success(Map(entity));
    }

    public async Task<Result<WorkClassificationDto>> CreateAsync(CreateWorkClassificationCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Code))
            return Result.Failure<WorkClassificationDto>("Code is required", "VALIDATION_ERROR");
        if (string.IsNullOrWhiteSpace(command.Name))
            return Result.Failure<WorkClassificationDto>("Name is required", "VALIDATION_ERROR");

        string code = command.Code.Trim();
        bool duplicate = await db.Set<WorkClassification>().AnyAsync(x => x.Code == code && !x.IsDeleted, cancellationToken);
        if (duplicate)
            return Result.Failure<WorkClassificationDto>("A work classification with this code already exists", "DUPLICATE_CODE");

        WorkClassification entity = new()
        {
            Code = code,
            Name = command.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(command.Description) ? null : command.Description.Trim(),
            IsActive = command.IsActive,
            Craft = string.IsNullOrWhiteSpace(command.Craft) ? null : command.Craft.Trim(),
            ClassName = string.IsNullOrWhiteSpace(command.ClassName) ? null : command.ClassName.Trim(),
            Apprenticeable = command.Apprenticeable
        };

        db.Set<WorkClassification>().Add(entity);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(Map(entity));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create work classification {Code}", code);
            return Result.Failure<WorkClassificationDto>("Failed to create work classification", "DATABASE_ERROR");
        }
    }

    public async Task<Result<WorkClassificationDto>> UpdateAsync(UpdateWorkClassificationCommand command, CancellationToken cancellationToken = default)
    {
        WorkClassification? entity = await db.Set<WorkClassification>()
            .FirstOrDefaultAsync(x => x.Id == command.Id && !x.IsDeleted, cancellationToken);

        if (entity is null)
            return Result.Failure<WorkClassificationDto>("Work classification not found", "NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(command.Code))
        {
            string code = command.Code.Trim();
            bool duplicate = await db.Set<WorkClassification>().AnyAsync(x => x.Id != entity.Id && x.Code == code && !x.IsDeleted, cancellationToken);
            if (duplicate)
                return Result.Failure<WorkClassificationDto>("A work classification with this code already exists", "DUPLICATE_CODE");
            entity.Code = code;
        }

        if (!string.IsNullOrWhiteSpace(command.Name))
            entity.Name = command.Name.Trim();
        if (command.Description is not null)
            entity.Description = string.IsNullOrWhiteSpace(command.Description) ? null : command.Description.Trim();
        if (command.IsActive.HasValue)
            entity.IsActive = command.IsActive.Value;
        if (command.Craft is not null)
            entity.Craft = string.IsNullOrWhiteSpace(command.Craft) ? null : command.Craft.Trim();
        if (command.ClassName is not null)
            entity.ClassName = string.IsNullOrWhiteSpace(command.ClassName) ? null : command.ClassName.Trim();
        if (command.Apprenticeable.HasValue)
            entity.Apprenticeable = command.Apprenticeable.Value;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(Map(entity));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<WorkClassificationDto>("Work classification was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update work classification {Id}", command.Id);
            return Result.Failure<WorkClassificationDto>("Failed to update work classification", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        WorkClassification? entity = await db.Set<WorkClassification>()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);

        if (entity is null)
            return Result.Failure("Work classification not found", "NOT_FOUND");

        entity.IsDeleted = true;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete work classification {Id}", id);
            return Result.Failure("Failed to delete work classification", "DATABASE_ERROR");
        }
    }

    private static WorkClassificationDto Map(WorkClassification x) => new(
        x.Id, x.Code, x.Name, x.Description, x.IsActive, x.Craft, x.ClassName, x.Apprenticeable, x.CreatedAt, x.UpdatedAt);
}
