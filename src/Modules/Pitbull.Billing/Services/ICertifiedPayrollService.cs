using Pitbull.Billing.Features.CertifiedPayroll;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface ICertifiedPayrollService
{
    Task<Result<ListCertifiedPayrollReportsResult>> ListAsync(ListCertifiedPayrollReportsQuery query, CancellationToken cancellationToken = default);
    Task<Result<CertifiedPayrollGenerateResult>> GenerateAsync(GenerateCertifiedPayrollCommand command, CancellationToken cancellationToken = default);
}
