using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.PayrollReviews;

public record PayrollRunReviewDto(
    Guid Id,
    Guid PayrollRunId,
    string ReviewerUserId,
    PayrollReviewStatus Status,
    string StatusName,
    string? Comments,
    DateTime? SubmittedAt,
    DateTime? ReviewedAt,
    DateTime? EscalatedAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record SubmitPayrollRunForReviewCommand(
    Guid PayrollRunId,
    string ReviewerUserId,
    string? Comments
) : ICommand<PayrollRunReviewDto>;

public record ApprovePayrollRunReviewCommand(
    Guid ReviewId,
    string ReviewerUserId,
    string? Comments
) : ICommand<PayrollRunReviewDto>;

public record RejectPayrollRunReviewCommand(
    Guid ReviewId,
    string ReviewerUserId,
    string Comments
) : ICommand<PayrollRunReviewDto>;

public record EscalatePayrollRunReviewCommand(
    Guid ReviewId,
    string ReviewerUserId,
    string Comments
) : ICommand<PayrollRunReviewDto>;

public record ListPayrollRunReviewsQuery(
    PayrollReviewStatus? Status = null,
    Guid? PayrollRunId = null,
    bool PendingOnly = false,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListPayrollRunReviewsResult>;

public record ListPayrollRunReviewsResult(
    IReadOnlyList<PayrollRunReviewDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
