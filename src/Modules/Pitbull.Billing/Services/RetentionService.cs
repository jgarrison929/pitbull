using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.Retention;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class RetentionService(PitbullDbContext db, ILogger<RetentionService> logger) : IRetentionService
{
    // ── Policies ──

    public async Task<Result<ListRetentionPoliciesResult>> GetPoliciesAsync(ListRetentionPoliciesQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<RetentionPolicy> dbQuery = db.Set<RetentionPolicy>().AsNoTracking();

        if (query.IsActive.HasValue)
            dbQuery = dbQuery.Where(p => p.IsActive == query.IsActive.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<RetentionPolicy> items = await dbQuery
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListRetentionPoliciesResult(
            Items: items.Select(MapPolicyToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<RetentionPolicyDto>> GetPolicyAsync(Guid id, CancellationToken cancellationToken = default)
    {
        RetentionPolicy? policy = await db.Set<RetentionPolicy>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (policy is null)
            return Result.Failure<RetentionPolicyDto>("Retention policy not found", "NOT_FOUND");

        return Result.Success(MapPolicyToDto(policy));
    }

    public async Task<Result<RetentionPolicyDto>> CreatePolicyAsync(CreateRetentionPolicyCommand command, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(command.Name))
            return Result.Failure<RetentionPolicyDto>("Policy name is required", "VALIDATION_ERROR");

        if (command.PercentageRate <= 0 || command.PercentageRate > 100)
            return Result.Failure<RetentionPolicyDto>("Percentage rate must be between 0 and 100", "VALIDATION_ERROR");

        bool duplicate = await db.Set<RetentionPolicy>()
            .AnyAsync(p => p.Name == command.Name.Trim(), cancellationToken);

        if (duplicate)
            return Result.Failure<RetentionPolicyDto>($"A retention policy named '{command.Name.Trim()}' already exists", "DUPLICATE");

        RetentionPolicy policy = new()
        {
            Name = command.Name.Trim(),
            PercentageRate = command.PercentageRate,
            MaxAmount = command.MaxAmount,
            ReleaseThreshold = command.ReleaseThreshold,
            AppliesTo = command.AppliesTo,
            IsDefault = command.IsDefault
        };

        // If this is marked as default, clear the existing default
        if (command.IsDefault)
        {
            var existingDefault = await db.Set<RetentionPolicy>()
                .Where(p => p.IsDefault)
                .ToListAsync(cancellationToken);

            foreach (var existing in existingDefault)
                existing.IsDefault = false;
        }

        db.Set<RetentionPolicy>().Add(policy);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapPolicyToDto(policy));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create retention policy");
            return Result.Failure<RetentionPolicyDto>("Failed to create retention policy", "DATABASE_ERROR");
        }
    }

    public async Task<Result<RetentionPolicyDto>> UpdatePolicyAsync(UpdateRetentionPolicyCommand command, CancellationToken cancellationToken = default)
    {
        RetentionPolicy? policy = await db.Set<RetentionPolicy>()
            .FirstOrDefaultAsync(p => p.Id == command.PolicyId, cancellationToken);

        if (policy is null)
            return Result.Failure<RetentionPolicyDto>("Retention policy not found", "NOT_FOUND");

        if (command.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(command.Name))
                return Result.Failure<RetentionPolicyDto>("Policy name cannot be empty", "VALIDATION_ERROR");

            bool duplicate = await db.Set<RetentionPolicy>()
                .AnyAsync(p => p.Name == command.Name.Trim() && p.Id != command.PolicyId, cancellationToken);

            if (duplicate)
                return Result.Failure<RetentionPolicyDto>($"A retention policy named '{command.Name.Trim()}' already exists", "DUPLICATE");

            policy.Name = command.Name.Trim();
        }

        if (command.PercentageRate.HasValue)
        {
            if (command.PercentageRate.Value <= 0 || command.PercentageRate.Value > 100)
                return Result.Failure<RetentionPolicyDto>("Percentage rate must be between 0 and 100", "VALIDATION_ERROR");
            policy.PercentageRate = command.PercentageRate.Value;
        }

        if (command.MaxAmount.HasValue)
            policy.MaxAmount = command.MaxAmount.Value;

        if (command.ReleaseThreshold.HasValue)
            policy.ReleaseThreshold = command.ReleaseThreshold.Value;

        if (command.AppliesTo.HasValue)
            policy.AppliesTo = command.AppliesTo.Value;

        if (command.IsActive.HasValue)
            policy.IsActive = command.IsActive.Value;

        if (command.IsDefault.HasValue && command.IsDefault.Value)
        {
            var existingDefaults = await db.Set<RetentionPolicy>()
                .Where(p => p.IsDefault && p.Id != command.PolicyId)
                .ToListAsync(cancellationToken);

            foreach (var existing in existingDefaults)
                existing.IsDefault = false;

            policy.IsDefault = true;
        }
        else if (command.IsDefault.HasValue)
        {
            policy.IsDefault = false;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapPolicyToDto(policy));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<RetentionPolicyDto>("Policy was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update retention policy {Id}", command.PolicyId);
            return Result.Failure<RetentionPolicyDto>("Failed to update retention policy", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeletePolicyAsync(Guid id, CancellationToken cancellationToken = default)
    {
        RetentionPolicy? policy = await db.Set<RetentionPolicy>()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (policy is null)
            return Result.Failure("Retention policy not found", "NOT_FOUND");

        // Check if any holds reference this policy
        bool hasHolds = await db.Set<RetentionHold>()
            .AnyAsync(h => h.RetentionPolicyId == id, cancellationToken);

        if (hasHolds)
            return Result.Failure("Cannot delete policy that has associated retention holds", "HAS_DEPENDENCIES");

        db.Set<RetentionPolicy>().Remove(policy);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete retention policy {Id}", id);
            return Result.Failure("Failed to delete retention policy", "DATABASE_ERROR");
        }
    }

    // ── Holds ──

    public async Task<Result<ListRetentionHoldsResult>> GetHoldsAsync(ListRetentionHoldsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<RetentionHold> dbQuery = db.Set<RetentionHold>().AsNoTracking();

        if (query.ProjectId.HasValue)
            dbQuery = dbQuery.Where(h => h.ProjectId == query.ProjectId.Value);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(h => h.Status == query.Status.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        decimal totalRetained = await dbQuery.SumAsync(h => h.RetainedAmount, cancellationToken);
        decimal totalReleased = await dbQuery.SumAsync(h => h.ReleasedAmount, cancellationToken);

        List<RetentionHold> items = await dbQuery
            .OrderByDescending(h => h.EffectiveDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListRetentionHoldsResult(
            Items: items.Select(MapHoldToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages,
            TotalRetained: totalRetained,
            TotalReleased: totalReleased));
    }

    public async Task<Result<RetentionHoldDto>> GetHoldAsync(Guid id, CancellationToken cancellationToken = default)
    {
        RetentionHold? hold = await db.Set<RetentionHold>()
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.Id == id, cancellationToken);

        if (hold is null)
            return Result.Failure<RetentionHoldDto>("Retention hold not found", "NOT_FOUND");

        return Result.Success(MapHoldToDto(hold));
    }

    public async Task<Result<RetentionHoldDto>> CreateHoldAsync(CreateRetentionHoldCommand command, CancellationToken cancellationToken = default)
    {
        if (command.OriginalAmount <= 0)
            return Result.Failure<RetentionHoldDto>("Original amount must be positive", "VALIDATION_ERROR");

        if (command.RetainagePercent <= 0 || command.RetainagePercent > 100)
            return Result.Failure<RetentionHoldDto>("Retainage percentage must be between 0 and 100", "VALIDATION_ERROR");

        decimal retainedAmount = Math.Round(command.OriginalAmount * command.RetainagePercent / 100m, 2);

        // If a policy is referenced, apply its max amount cap
        if (command.RetentionPolicyId.HasValue)
        {
            RetentionPolicy? policy = await db.Set<RetentionPolicy>()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == command.RetentionPolicyId.Value, cancellationToken);

            if (policy is null)
                return Result.Failure<RetentionHoldDto>("Referenced retention policy not found", "NOT_FOUND");

            if (!policy.IsActive)
                return Result.Failure<RetentionHoldDto>("Referenced retention policy is inactive", "INVALID_STATUS");

            if (policy.MaxAmount.HasValue && retainedAmount > policy.MaxAmount.Value)
                retainedAmount = policy.MaxAmount.Value;
        }

        RetentionHold hold = new()
        {
            ProjectId = command.ProjectId,
            ContractId = command.ContractId,
            OriginalAmount = command.OriginalAmount,
            RetainedAmount = retainedAmount,
            ReleasedAmount = 0m,
            RetainagePercent = command.RetainagePercent,
            RetentionPolicyId = command.RetentionPolicyId,
            Description = command.Description,
            EffectiveDate = command.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Status = RetentionHoldStatus.Held
        };

        db.Set<RetentionHold>().Add(hold);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapHoldToDto(hold));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create retention hold");
            return Result.Failure<RetentionHoldDto>("Failed to create retention hold", "DATABASE_ERROR");
        }
    }

    public async Task<Result<RetentionHoldDto>> ReleaseRetentionAsync(ReleaseRetentionCommand command, CancellationToken cancellationToken = default)
    {
        RetentionHold? hold = await db.Set<RetentionHold>()
            .FirstOrDefaultAsync(h => h.Id == command.HoldId, cancellationToken);

        if (hold is null)
            return Result.Failure<RetentionHoldDto>("Retention hold not found", "NOT_FOUND");

        if (hold.Status == RetentionHoldStatus.Released)
            return Result.Failure<RetentionHoldDto>("Retention has already been fully released", "INVALID_STATUS");

        if (command.ReleaseAmount <= 0)
            return Result.Failure<RetentionHoldDto>("Release amount must be positive", "VALIDATION_ERROR");

        decimal remainingRetained = hold.RetainedAmount - hold.ReleasedAmount;
        if (command.ReleaseAmount > remainingRetained)
            return Result.Failure<RetentionHoldDto>(
                $"Release amount ({command.ReleaseAmount:N2}) exceeds remaining retained ({remainingRetained:N2})",
                "EXCEEDS_BALANCE");

        hold.ReleasedAmount += command.ReleaseAmount;
        hold.ReleasedByUserId = command.ReleasedByUserId;
        hold.ReleasedAt = DateTime.UtcNow;

        // Update status based on how much has been released
        hold.Status = hold.ReleasedAmount >= hold.RetainedAmount
            ? RetentionHoldStatus.Released
            : RetentionHoldStatus.PartiallyReleased;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapHoldToDto(hold));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<RetentionHoldDto>("Hold was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to release retention hold {Id}", command.HoldId);
            return Result.Failure<RetentionHoldDto>("Failed to release retention", "DATABASE_ERROR");
        }
    }

    // ── Mapping ──

    private static RetentionPolicyDto MapPolicyToDto(RetentionPolicy p) => new(
        Id: p.Id,
        Name: p.Name,
        PercentageRate: p.PercentageRate,
        MaxAmount: p.MaxAmount,
        ReleaseThreshold: p.ReleaseThreshold,
        AppliesTo: p.AppliesTo,
        IsDefault: p.IsDefault,
        IsActive: p.IsActive,
        CreatedAt: p.CreatedAt,
        UpdatedAt: p.UpdatedAt);

    private static RetentionHoldDto MapHoldToDto(RetentionHold h) => new(
        Id: h.Id,
        ProjectId: h.ProjectId,
        ContractId: h.ContractId,
        OriginalAmount: h.OriginalAmount,
        RetainedAmount: h.RetainedAmount,
        ReleasedAmount: h.ReleasedAmount,
        Status: h.Status,
        RetentionPolicyId: h.RetentionPolicyId,
        RetainagePercent: h.RetainagePercent,
        Description: h.Description,
        EffectiveDate: h.EffectiveDate,
        ReleasedByUserId: h.ReleasedByUserId,
        ReleasedAt: h.ReleasedAt,
        CreatedAt: h.CreatedAt,
        UpdatedAt: h.UpdatedAt);
}
