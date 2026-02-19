using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.LienWaivers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class LienWaiverService(PitbullDbContext db, ILogger<LienWaiverService> logger) : ILienWaiverService
{
    public async Task<Result<ListLienWaiversResult>> GetLienWaiversAsync(ListLienWaiversQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<LienWaiver> dbQuery = db.Set<LienWaiver>().AsNoTracking();

        if (query.ProjectId.HasValue)
            dbQuery = dbQuery.Where(w => w.ProjectId == query.ProjectId.Value);

        if (query.VendorId.HasValue)
            dbQuery = dbQuery.Where(w => w.VendorId == query.VendorId.Value);

        if (query.WaiverType.HasValue)
            dbQuery = dbQuery.Where(w => w.WaiverType == query.WaiverType.Value);

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(w => w.Status == query.Status.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<LienWaiver> items = await dbQuery
            .OrderByDescending(w => w.ThroughDate)
            .ThenByDescending(w => w.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListLienWaiversResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<LienWaiverDto>> GetLienWaiverAsync(Guid id, CancellationToken cancellationToken = default)
    {
        LienWaiver? waiver = await db.Set<LienWaiver>()
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == id, cancellationToken);

        if (waiver is null)
            return Result.Failure<LienWaiverDto>("Lien waiver not found", "NOT_FOUND");

        return Result.Success(MapToDto(waiver));
    }

    public async Task<Result<LienWaiverDto>> CreateLienWaiverAsync(CreateLienWaiverCommand command, CancellationToken cancellationToken = default)
    {
        if (command.Amount <= 0)
            return Result.Failure<LienWaiverDto>("Amount must be positive", "VALIDATION_ERROR");

        LienWaiver waiver = new()
        {
            ProjectId = command.ProjectId,
            VendorId = command.VendorId,
            WaiverType = command.WaiverType,
            Amount = command.Amount,
            ThroughDate = command.ThroughDate,
            Description = command.Description,
            Status = LienWaiverStatus.Requested
        };

        db.Set<LienWaiver>().Add(waiver);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(waiver));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create lien waiver");
            return Result.Failure<LienWaiverDto>("Failed to create lien waiver", "DATABASE_ERROR");
        }
    }

    public async Task<Result<LienWaiverDto>> UpdateLienWaiverAsync(UpdateLienWaiverCommand command, CancellationToken cancellationToken = default)
    {
        LienWaiver? waiver = await db.Set<LienWaiver>()
            .FirstOrDefaultAsync(w => w.Id == command.WaiverId, cancellationToken);

        if (waiver is null)
            return Result.Failure<LienWaiverDto>("Lien waiver not found", "NOT_FOUND");

        if (waiver.Status == LienWaiverStatus.Approved)
            return Result.Failure<LienWaiverDto>("Cannot modify an approved waiver", "INVALID_STATUS");

        if (command.Amount.HasValue)
        {
            if (command.Amount.Value <= 0)
                return Result.Failure<LienWaiverDto>("Amount must be positive", "VALIDATION_ERROR");
            waiver.Amount = command.Amount.Value;
        }

        if (command.ThroughDate.HasValue)
            waiver.ThroughDate = command.ThroughDate.Value;

        if (command.Description is not null)
            waiver.Description = command.Description;

        if (command.DocumentPath is not null)
            waiver.DocumentPath = command.DocumentPath;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(waiver));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<LienWaiverDto>("Waiver was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update lien waiver {Id}", command.WaiverId);
            return Result.Failure<LienWaiverDto>("Failed to update lien waiver", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteLienWaiverAsync(Guid id, CancellationToken cancellationToken = default)
    {
        LienWaiver? waiver = await db.Set<LienWaiver>()
            .FirstOrDefaultAsync(w => w.Id == id, cancellationToken);

        if (waiver is null)
            return Result.Failure("Lien waiver not found", "NOT_FOUND");

        if (waiver.Status == LienWaiverStatus.Approved)
            return Result.Failure("Cannot delete an approved waiver", "INVALID_STATUS");

        db.Set<LienWaiver>().Remove(waiver);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete lien waiver {Id}", id);
            return Result.Failure("Failed to delete lien waiver", "DATABASE_ERROR");
        }
    }

    public async Task<Result<LienWaiverDto>> ApproveAsync(Guid id, Guid reviewedByUserId, CancellationToken cancellationToken = default)
    {
        LienWaiver? waiver = await db.Set<LienWaiver>()
            .FirstOrDefaultAsync(w => w.Id == id, cancellationToken);

        if (waiver is null)
            return Result.Failure<LienWaiverDto>("Lien waiver not found", "NOT_FOUND");

        if (waiver.Status != LienWaiverStatus.Received)
            return Result.Failure<LienWaiverDto>("Only received waivers can be approved", "INVALID_STATUS");

        waiver.Status = LienWaiverStatus.Approved;
        waiver.ReviewedByUserId = reviewedByUserId;
        waiver.ReviewedAt = DateTime.UtcNow;
        waiver.RejectionReason = null;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(waiver));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to approve lien waiver {Id}", id);
            return Result.Failure<LienWaiverDto>("Failed to approve lien waiver", "DATABASE_ERROR");
        }
    }

    public async Task<Result<LienWaiverDto>> RejectAsync(Guid id, Guid reviewedByUserId, string reason, CancellationToken cancellationToken = default)
    {
        LienWaiver? waiver = await db.Set<LienWaiver>()
            .FirstOrDefaultAsync(w => w.Id == id, cancellationToken);

        if (waiver is null)
            return Result.Failure<LienWaiverDto>("Lien waiver not found", "NOT_FOUND");

        if (waiver.Status != LienWaiverStatus.Received)
            return Result.Failure<LienWaiverDto>("Only received waivers can be rejected", "INVALID_STATUS");

        if (string.IsNullOrWhiteSpace(reason))
            return Result.Failure<LienWaiverDto>("Rejection reason is required", "VALIDATION_ERROR");

        waiver.Status = LienWaiverStatus.Rejected;
        waiver.ReviewedByUserId = reviewedByUserId;
        waiver.ReviewedAt = DateTime.UtcNow;
        waiver.RejectionReason = reason.Trim();

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(waiver));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to reject lien waiver {Id}", id);
            return Result.Failure<LienWaiverDto>("Failed to reject lien waiver", "DATABASE_ERROR");
        }
    }

    public async Task<Result<LienWaiverDto>> MarkReceivedAsync(Guid id, string? documentPath, CancellationToken cancellationToken = default)
    {
        LienWaiver? waiver = await db.Set<LienWaiver>()
            .FirstOrDefaultAsync(w => w.Id == id, cancellationToken);

        if (waiver is null)
            return Result.Failure<LienWaiverDto>("Lien waiver not found", "NOT_FOUND");

        if (waiver.Status != LienWaiverStatus.Requested)
            return Result.Failure<LienWaiverDto>("Only requested waivers can be marked as received", "INVALID_STATUS");

        waiver.Status = LienWaiverStatus.Received;
        if (documentPath is not null)
            waiver.DocumentPath = documentPath;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(waiver));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to mark lien waiver {Id} as received", id);
            return Result.Failure<LienWaiverDto>("Failed to update lien waiver", "DATABASE_ERROR");
        }
    }

    private static LienWaiverDto MapToDto(LienWaiver w) => new(
        Id: w.Id,
        ProjectId: w.ProjectId,
        VendorId: w.VendorId,
        WaiverType: w.WaiverType,
        Amount: w.Amount,
        ThroughDate: w.ThroughDate,
        Status: w.Status,
        DocumentPath: w.DocumentPath,
        Description: w.Description,
        ReviewedByUserId: w.ReviewedByUserId,
        ReviewedAt: w.ReviewedAt,
        RejectionReason: w.RejectionReason,
        CreatedAt: w.CreatedAt,
        UpdatedAt: w.UpdatedAt);
}
