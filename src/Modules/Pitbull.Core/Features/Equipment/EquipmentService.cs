using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Logging;

namespace Pitbull.Core.Features.Equipment;

/// <summary>
/// Service for managing equipment operations.
/// </summary>
public class EquipmentService : IEquipmentService
{
    private readonly PitbullDbContext _db;
    private readonly IValidator<CreateEquipmentCommand> _createValidator;
    private readonly IValidator<UpdateEquipmentCommand> _updateValidator;
    private readonly ILogger<EquipmentService> _logger;

    public EquipmentService(
        PitbullDbContext db,
        IValidator<CreateEquipmentCommand> createValidator,
        IValidator<UpdateEquipmentCommand> updateValidator,
        ILogger<EquipmentService> logger)
    {
        _db = db;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _logger = logger;
    }

    public async Task<Result<EquipmentDto>> GetEquipmentAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var equipment = await _db.Set<Domain.Equipment>()
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (equipment == null)
            return Result.Failure<EquipmentDto>("Equipment not found", "NOT_FOUND");

        return Result.Success(EquipmentMapper.ToDto(equipment));
    }

    public async Task<Result<ListEquipmentResult>> ListEquipmentAsync(
        ListEquipmentQuery query,
        CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.Set<Domain.Equipment>()
            .AsNoTracking()
            .AsQueryable();

        // Apply filters
        if (query.IsActive.HasValue)
            dbQuery = dbQuery.Where(e => e.IsActive == query.IsActive.Value);

        if (query.Type.HasValue)
            dbQuery = dbQuery.Where(e => e.Type == query.Type.Value);

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var search = query.SearchTerm.ToLower();
            dbQuery = dbQuery.Where(e =>
                e.Code.ToLower().Contains(search) ||
                e.Name.ToLower().Contains(search) ||
                (e.Description != null && e.Description.ToLower().Contains(search)));
        }

        // Get total count
        var totalCount = await dbQuery.CountAsync(cancellationToken);

        // Apply ordering and pagination
        var items = await dbQuery
            .OrderBy(e => e.Code)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / query.PageSize);

        return Result.Success(new ListEquipmentResult(
            Items: EquipmentMapper.ToDto(items),
            TotalCount: totalCount,
            Page: query.Page,
            PageSize: query.PageSize,
            TotalPages: totalPages
        ));
    }

    public async Task<Result<EquipmentDto>> CreateEquipmentAsync(
        CreateEquipmentCommand command,
        CancellationToken cancellationToken = default)
    {
        // Validate command
        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<EquipmentDto>(errors, "VALIDATION_ERROR");
        }

        // Check for duplicate code
        var codeExists = await _db.Set<Domain.Equipment>()
            .AnyAsync(e => e.Code == command.Code, cancellationToken);

        if (codeExists)
            return Result.Failure<EquipmentDto>(
                $"Equipment with code '{command.Code}' already exists",
                "DUPLICATE_CODE");

        var equipment = new Domain.Equipment
        {
            Code = command.Code,
            Name = command.Name,
            Description = command.Description,
            Type = command.Type,
            HourlyRate = command.HourlyRate,
            BillingRate = command.BillingRate,
            IsActive = command.IsActive,
            SerialNumber = command.SerialNumber,
            LicensePlate = command.LicensePlate
        };

        _db.Set<Domain.Equipment>().Add(equipment);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(EquipmentMapper.ToDto(equipment));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create equipment with code {Code}", LogSafe.Text(command.Code));
            return Result.Failure<EquipmentDto>("Failed to create equipment", "DATABASE_ERROR");
        }
    }

    public async Task<Result<EquipmentDto>> UpdateEquipmentAsync(
        UpdateEquipmentCommand command,
        CancellationToken cancellationToken = default)
    {
        // Validate command
        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<EquipmentDto>(errors, "VALIDATION_ERROR");
        }

        var equipment = await _db.Set<Domain.Equipment>()
            .FirstOrDefaultAsync(e => e.Id == command.EquipmentId, cancellationToken);

        if (equipment == null)
            return Result.Failure<EquipmentDto>("Equipment not found", "NOT_FOUND");

        // Check for duplicate code if code is being changed
        if (!string.IsNullOrEmpty(command.Code) && command.Code != equipment.Code)
        {
            var codeExists = await _db.Set<Domain.Equipment>()
                .AnyAsync(e => e.Code == command.Code && e.Id != command.EquipmentId, cancellationToken);

            if (codeExists)
                return Result.Failure<EquipmentDto>(
                    $"Equipment with code '{command.Code}' already exists",
                    "DUPLICATE_CODE");

            equipment.Code = command.Code;
        }

        // Update fields that are provided
        if (!string.IsNullOrEmpty(command.Name))
            equipment.Name = command.Name;

        if (command.Description != null)
            equipment.Description = command.Description;

        if (command.Type.HasValue)
            equipment.Type = command.Type.Value;

        if (command.HourlyRate.HasValue)
            equipment.HourlyRate = command.HourlyRate.Value;

        if (command.BillingRate.HasValue)
            equipment.BillingRate = command.BillingRate.Value;

        if (command.IsActive.HasValue)
            equipment.IsActive = command.IsActive.Value;

        if (command.SerialNumber != null)
            equipment.SerialNumber = command.SerialNumber;

        if (command.LicensePlate != null)
            equipment.LicensePlate = command.LicensePlate;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(EquipmentMapper.ToDto(equipment));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<EquipmentDto>("Equipment was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update equipment {EquipmentId}", command.EquipmentId);
            return Result.Failure<EquipmentDto>("Failed to update equipment", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteEquipmentAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var equipment = await _db.Set<Domain.Equipment>()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (equipment == null)
            return Result.Failure("Equipment not found", "NOT_FOUND");

        // Soft delete via DbContext SaveChanges override
        _db.Set<Domain.Equipment>().Remove(equipment);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete equipment {EquipmentId}", id);
            return Result.Failure("Failed to delete equipment", "DATABASE_ERROR");
        }
    }
}
