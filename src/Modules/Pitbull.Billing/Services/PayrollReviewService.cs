using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.PayrollReviews;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class PayrollReviewService(PitbullDbContext db, ILogger<PayrollReviewService> logger) : IPayrollReviewService
{
    public async Task<Result<ListPayrollRunReviewsResult>> ListAsync(ListPayrollRunReviewsQuery query, CancellationToken cancellationToken = default)
    {
        IQueryable<PayrollRunReview> dbQuery = db.Set<PayrollRunReview>()
            .AsNoTracking()
            .Include(x => x.PayrollRun);

        if (query.PendingOnly)
        {
            dbQuery = dbQuery.Where(x => x.Status == PayrollReviewStatus.Pending || x.Status == PayrollReviewStatus.Submitted || x.Status == PayrollReviewStatus.Escalated);
        }
        else if (query.Status.HasValue)
        {
            dbQuery = dbQuery.Where(x => x.Status == query.Status.Value);
        }

        if (query.PayrollRunId.HasValue)
            dbQuery = dbQuery.Where(x => x.PayrollRunId == query.PayrollRunId.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : Math.Min(query.PageSize, 100);

        List<PayrollRunReview> items = await dbQuery
            .OrderByDescending(x => x.SubmittedAt)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListPayrollRunReviewsResult(
            Items: items.Select(MapToDto).ToList(),
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages));
    }

    public async Task<Result<PayrollRunReviewDto>> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        PayrollRunReview? review = await db.Set<PayrollRunReview>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (review is null)
            return Result.Failure<PayrollRunReviewDto>("Payroll review not found", "NOT_FOUND");

        return Result.Success(MapToDto(review));
    }

    public async Task<Result<PayrollRunReviewDto>> SubmitAsync(SubmitPayrollRunForReviewCommand command, CancellationToken cancellationToken = default)
    {
        PayrollRun? run = await db.Set<PayrollRun>()
            .FirstOrDefaultAsync(x => x.Id == command.PayrollRunId, cancellationToken);

        if (run is null)
            return Result.Failure<PayrollRunReviewDto>("Payroll run not found", "NOT_FOUND");

        if (run.Status is not (PayrollRunStatus.Submitted or PayrollRunStatus.Processing))
            return Result.Failure<PayrollRunReviewDto>(
                $"Payroll run must be in Submitted or Processing status to submit for review, but is {run.Status}",
                "INVALID_STATUS");

        PayrollRunReview review = new()
        {
            PayrollRunId = command.PayrollRunId,
            ReviewerUserId = command.ReviewerUserId.Trim(),
            Status = PayrollReviewStatus.Submitted,
            Comments = command.Comments,
            SubmittedAt = DateTime.UtcNow
        };

        run.Status = PayrollRunStatus.UnderReview;

        db.Set<PayrollRunReview>().Add(review);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(review));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to submit payroll run {PayrollRunId} for review", command.PayrollRunId);
            return Result.Failure<PayrollRunReviewDto>("Failed to submit payroll run for review", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PayrollRunReviewDto>> ApproveAsync(ApprovePayrollRunReviewCommand command, CancellationToken cancellationToken = default)
    {
        PayrollRunReview? review = await db.Set<PayrollRunReview>()
            .Include(x => x.PayrollRun)
            .FirstOrDefaultAsync(x => x.Id == command.ReviewId, cancellationToken);

        if (review is null)
            return Result.Failure<PayrollRunReviewDto>("Payroll review not found", "NOT_FOUND");

        if (!CanReview(review.Status))
            return Result.Failure<PayrollRunReviewDto>("Review is not in a reviewable state", "INVALID_STATUS");

        review.Status = PayrollReviewStatus.Approved;
        review.Comments = command.Comments;
        review.ReviewedAt = DateTime.UtcNow;
        review.ReviewerUserId = command.ReviewerUserId.Trim();

        review.PayrollRun.Status = PayrollRunStatus.Approved;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(review));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to approve payroll review {ReviewId}", command.ReviewId);
            return Result.Failure<PayrollRunReviewDto>("Failed to approve payroll review", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PayrollRunReviewDto>> RejectAsync(RejectPayrollRunReviewCommand command, CancellationToken cancellationToken = default)
    {
        PayrollRunReview? review = await db.Set<PayrollRunReview>()
            .Include(x => x.PayrollRun)
            .FirstOrDefaultAsync(x => x.Id == command.ReviewId, cancellationToken);

        if (review is null)
            return Result.Failure<PayrollRunReviewDto>("Payroll review not found", "NOT_FOUND");

        if (!CanReview(review.Status))
            return Result.Failure<PayrollRunReviewDto>("Review is not in a reviewable state", "INVALID_STATUS");

        review.Status = PayrollReviewStatus.Rejected;
        review.Comments = command.Comments;
        review.ReviewedAt = DateTime.UtcNow;
        review.ReviewerUserId = command.ReviewerUserId.Trim();

        review.PayrollRun.Status = PayrollRunStatus.Submitted;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(review));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to reject payroll review {ReviewId}", command.ReviewId);
            return Result.Failure<PayrollRunReviewDto>("Failed to reject payroll review", "DATABASE_ERROR");
        }
    }

    public async Task<Result<PayrollRunReviewDto>> EscalateAsync(EscalatePayrollRunReviewCommand command, CancellationToken cancellationToken = default)
    {
        PayrollRunReview? review = await db.Set<PayrollRunReview>()
            .Include(x => x.PayrollRun)
            .FirstOrDefaultAsync(x => x.Id == command.ReviewId, cancellationToken);

        if (review is null)
            return Result.Failure<PayrollRunReviewDto>("Payroll review not found", "NOT_FOUND");

        if (!CanReview(review.Status))
            return Result.Failure<PayrollRunReviewDto>("Review is not in a reviewable state", "INVALID_STATUS");

        review.Status = PayrollReviewStatus.Escalated;
        review.Comments = command.Comments;
        review.EscalatedAt = DateTime.UtcNow;
        review.ReviewerUserId = command.ReviewerUserId.Trim();

        review.PayrollRun.Status = PayrollRunStatus.UnderReview;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success(MapToDto(review));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to escalate payroll review {ReviewId}", command.ReviewId);
            return Result.Failure<PayrollRunReviewDto>("Failed to escalate payroll review", "DATABASE_ERROR");
        }
    }

    private static bool CanReview(PayrollReviewStatus status)
    {
        return status is PayrollReviewStatus.Pending or PayrollReviewStatus.Submitted or PayrollReviewStatus.Escalated;
    }

    private static PayrollRunReviewDto MapToDto(PayrollRunReview review)
    {
        return new PayrollRunReviewDto(
            Id: review.Id,
            PayrollRunId: review.PayrollRunId,
            ReviewerUserId: review.ReviewerUserId,
            Status: review.Status,
            StatusName: review.Status.ToString(),
            Comments: review.Comments,
            SubmittedAt: review.SubmittedAt,
            ReviewedAt: review.ReviewedAt,
            EscalatedAt: review.EscalatedAt,
            CreatedAt: review.CreatedAt,
            UpdatedAt: review.UpdatedAt);
    }
}
