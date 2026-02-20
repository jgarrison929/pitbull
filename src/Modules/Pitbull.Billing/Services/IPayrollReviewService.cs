using Pitbull.Billing.Features.PayrollReviews;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IPayrollReviewService
{
    Task<Result<ListPayrollRunReviewsResult>> ListAsync(ListPayrollRunReviewsQuery query, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunReviewDto>> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunReviewDto>> SubmitAsync(SubmitPayrollRunForReviewCommand command, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunReviewDto>> ApproveAsync(ApprovePayrollRunReviewCommand command, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunReviewDto>> RejectAsync(RejectPayrollRunReviewCommand command, CancellationToken cancellationToken = default);
    Task<Result<PayrollRunReviewDto>> EscalateAsync(EscalatePayrollRunReviewCommand command, CancellationToken cancellationToken = default);
}
