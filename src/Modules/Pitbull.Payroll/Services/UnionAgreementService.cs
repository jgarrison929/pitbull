using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features.UnionAgreements;

namespace Pitbull.Payroll.Services;

public interface IUnionAgreementService
{
    Task<Result<ListUnionAgreementsResult>> ListAsync(ListUnionAgreementsQuery query, CancellationToken cancellationToken = default);
    Task<Result<UnionAgreementDto>> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<UnionAgreementDto>> CreateAsync(CreateUnionAgreementCommand command, CancellationToken cancellationToken = default);
    Task<Result<UnionAgreementDto>> UpdateAsync(UpdateUnionAgreementCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class UnionAgreementService(PitbullDbContext db, ILogger<UnionAgreementService> logger) : IUnionAgreementService
{
    public async Task<Result<ListUnionAgreementsResult>> ListAsync(ListUnionAgreementsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<UnionAgreement> dbQuery = db.Set<UnionAgreement>().AsNoTracking().Where(x => !x.IsDeleted);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(x => x.Status == query.Status.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string term = query.Search.Trim();
            dbQuery = dbQuery.Where(x => x.UnionName.Contains(term) || x.LocalNumber.Contains(term) || x.Name.Contains(term));
        }

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<UnionAgreement> items = await dbQuery
            .OrderBy(x => x.UnionName)
            .ThenBy(x => x.LocalNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListUnionAgreementsResult(items.Select(Map).ToList(), totalCount, page, pageSize, totalPages));
    }

    public async Task<Result<UnionAgreementDto>> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        UnionAgreement? entity = await db.Set<UnionAgreement>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);

        if (entity is null)
            return Result.Failure<UnionAgreementDto>("Union agreement not found", "NOT_FOUND");

        return Result.Success(Map(entity));
    }

    public async Task<Result<UnionAgreementDto>> CreateAsync(CreateUnionAgreementCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.UnionName))
            return Result.Failure<UnionAgreementDto>("Union name is required", "VALIDATION_ERROR");
        if (string.IsNullOrWhiteSpace(command.LocalNumber))
            return Result.Failure<UnionAgreementDto>("Local number is required", "VALIDATION_ERROR");
        if (string.IsNullOrWhiteSpace(command.Name))
            return Result.Failure<UnionAgreementDto>("Agreement name is required", "VALIDATION_ERROR");

        UnionAgreement entity = new()
        {
            UnionName = command.UnionName.Trim(),
            LocalNumber = command.LocalNumber.Trim(),
            Name = command.Name.Trim(),
            InternationalBody = EmptyToNull(command.InternationalBody),
            AgreementNumber = EmptyToNull(command.AgreementNumber),
            Jurisdiction = EmptyToNull(command.Jurisdiction),
            State = EmptyToNull(command.State),
            EffectiveDate = command.EffectiveDate,
            ExpirationDate = command.ExpirationDate,
            Status = command.Status
        };

        db.Set<UnionAgreement>().Add(entity);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(Map(entity));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create union agreement {Name}", command.Name);
            return Result.Failure<UnionAgreementDto>("Failed to create union agreement", "DATABASE_ERROR");
        }
    }

    public async Task<Result<UnionAgreementDto>> UpdateAsync(UpdateUnionAgreementCommand command, CancellationToken cancellationToken = default)
    {
        UnionAgreement? entity = await db.Set<UnionAgreement>()
            .FirstOrDefaultAsync(x => x.Id == command.Id && !x.IsDeleted, cancellationToken);

        if (entity is null)
            return Result.Failure<UnionAgreementDto>("Union agreement not found", "NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(command.UnionName))
            entity.UnionName = command.UnionName.Trim();
        if (!string.IsNullOrWhiteSpace(command.LocalNumber))
            entity.LocalNumber = command.LocalNumber.Trim();
        if (!string.IsNullOrWhiteSpace(command.Name))
            entity.Name = command.Name.Trim();
        if (command.InternationalBody is not null)
            entity.InternationalBody = EmptyToNull(command.InternationalBody);
        if (command.AgreementNumber is not null)
            entity.AgreementNumber = EmptyToNull(command.AgreementNumber);
        if (command.Jurisdiction is not null)
            entity.Jurisdiction = EmptyToNull(command.Jurisdiction);
        if (command.State is not null)
            entity.State = EmptyToNull(command.State);
        if (command.EffectiveDate.HasValue)
            entity.EffectiveDate = command.EffectiveDate.Value;
        if (command.ExpirationDate.HasValue)
            entity.ExpirationDate = command.ExpirationDate;
        if (command.Status.HasValue)
            entity.Status = command.Status.Value;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(Map(entity));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<UnionAgreementDto>("Union agreement was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update union agreement {Id}", command.Id);
            return Result.Failure<UnionAgreementDto>("Failed to update union agreement", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        UnionAgreement? entity = await db.Set<UnionAgreement>()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);

        if (entity is null)
            return Result.Failure("Union agreement not found", "NOT_FOUND");

        entity.IsDeleted = true;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete union agreement {Id}", id);
            return Result.Failure("Failed to delete union agreement", "DATABASE_ERROR");
        }
    }

    private static UnionAgreementDto Map(UnionAgreement x) => new(
        x.Id, x.UnionName, x.LocalNumber, x.InternationalBody, x.AgreementNumber, x.Name,
        x.Jurisdiction, x.State, x.EffectiveDate, x.ExpirationDate, x.Status, x.Status.ToString(),
        x.CreatedAt, x.UpdatedAt);

    private static string? EmptyToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
