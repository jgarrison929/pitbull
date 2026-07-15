using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Logging;

namespace Pitbull.Core.Features.CostCode;

public class CostCodeService : ICostCodeService
{
    private readonly PitbullDbContext _db;
    private readonly IValidator<CreateCostCodeCommand> _createValidator;
    private readonly IValidator<UpdateCostCodeCommand> _updateValidator;
    private readonly ILogger<CostCodeService> _logger;

    public CostCodeService(
        PitbullDbContext db,
        IValidator<CreateCostCodeCommand> createValidator,
        IValidator<UpdateCostCodeCommand> updateValidator,
        ILogger<CostCodeService> logger)
    {
        _db = db;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _logger = logger;
    }

    public async Task<Result<CostCodeDto>> GetCostCodeAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var costCode = await _db.Set<Domain.CostCode>()
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (costCode == null)
            return Result.Failure<CostCodeDto>("Cost code not found", "NOT_FOUND");

        return Result.Success(CostCodeMapper.ToDto(costCode));
    }

    public async Task<Result<ListCostCodesResult>> ListCostCodesAsync(
        ListCostCodesQuery query,
        CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.Set<Domain.CostCode>()
            .AsNoTracking()
            .AsQueryable();

        // Default to active-only when not specified. Pass isActive=false to see inactive,
        // or explicitly query all via the API by not including the parameter (frontend should handle this).
        if (query.IsActive.HasValue)
            dbQuery = dbQuery.Where(c => c.IsActive == query.IsActive.Value);
        else
            dbQuery = dbQuery.Where(c => c.IsActive);

        if (query.CostType.HasValue)
            dbQuery = dbQuery.Where(c => c.CostType == query.CostType.Value);

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var search = query.SearchTerm.ToLower();
            dbQuery = dbQuery.Where(c =>
                c.Code.ToLower().Contains(search) ||
                c.Description.ToLower().Contains(search));
        }

        var totalCount = await dbQuery.CountAsync(cancellationToken);

        var items = await dbQuery
            .OrderBy(c => c.Code)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / query.PageSize);

        return Result.Success(new ListCostCodesResult(
            Items: CostCodeMapper.ToDto(items),
            TotalCount: totalCount,
            Page: query.Page,
            PageSize: query.PageSize,
            TotalPages: totalPages
        ));
    }

    public async Task<Result<CostCodeDto>> CreateCostCodeAsync(
        CreateCostCodeCommand command,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CostCodeDto>(errors, "VALIDATION_ERROR");
        }

        var codeExists = await _db.Set<Domain.CostCode>()
            .AnyAsync(c => c.Code == command.Code, cancellationToken);

        if (codeExists)
            return Result.Failure<CostCodeDto>(
                $"Cost code '{command.Code}' already exists",
                "DUPLICATE_CODE");

        var costCode = new Domain.CostCode
        {
            Code = command.Code,
            Description = command.Description,
            Division = command.Division,
            CostType = command.CostType,
            IsActive = command.IsActive
        };

        _db.Set<Domain.CostCode>().Add(costCode);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(CostCodeMapper.ToDto(costCode));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create cost code {Code}", LogSafe.Text(command.Code));
            return Result.Failure<CostCodeDto>("Failed to create cost code", "DATABASE_ERROR");
        }
    }

    public async Task<Result<CostCodeDto>> UpdateCostCodeAsync(
        UpdateCostCodeCommand command,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CostCodeDto>(errors, "VALIDATION_ERROR");
        }

        var costCode = await _db.Set<Domain.CostCode>()
            .FirstOrDefaultAsync(c => c.Id == command.CostCodeId, cancellationToken);

        if (costCode == null)
            return Result.Failure<CostCodeDto>("Cost code not found", "NOT_FOUND");

        if (!string.IsNullOrEmpty(command.Code) && command.Code != costCode.Code)
        {
            var codeExists = await _db.Set<Domain.CostCode>()
                .AnyAsync(c => c.Code == command.Code && c.Id != command.CostCodeId, cancellationToken);

            if (codeExists)
                return Result.Failure<CostCodeDto>(
                    $"Cost code '{command.Code}' already exists",
                    "DUPLICATE_CODE");

            costCode.Code = command.Code;
        }

        if (!string.IsNullOrEmpty(command.Description))
            costCode.Description = command.Description;

        if (command.Division != null)
            costCode.Division = command.Division;

        if (command.CostType.HasValue)
            costCode.CostType = command.CostType.Value;

        if (command.IsActive.HasValue)
            costCode.IsActive = command.IsActive.Value;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(CostCodeMapper.ToDto(costCode));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<CostCodeDto>("Cost code was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update cost code {CostCodeId}", command.CostCodeId);
            return Result.Failure<CostCodeDto>("Failed to update cost code", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteCostCodeAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var costCode = await _db.Set<Domain.CostCode>()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (costCode == null)
            return Result.Failure("Cost code not found", "NOT_FOUND");

        _db.Set<Domain.CostCode>().Remove(costCode);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete cost code {CostCodeId}", id);
            return Result.Failure("Failed to delete cost code", "DATABASE_ERROR");
        }
    }
}
