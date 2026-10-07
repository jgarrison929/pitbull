using Pitbull.Payroll.Features.CertifiedPayroll;
using Pitbull.Core.CQRS;

namespace Pitbull.Payroll.Services;

public interface ICertifiedPayrollService
{
    Task<Result<ListCertifiedPayrollReportsResult>> ListAsync(ListCertifiedPayrollReportsQuery query, CancellationToken cancellationToken = default);
    Task<Result<CertifiedPayrollReportDetailDto>> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<CertifiedPayrollGenerateResult>> GenerateAsync(GenerateCertifiedPayrollCommand command, CancellationToken cancellationToken = default);
    Task<Result<CertifiedPayrollReportDto>> SaveStatementAsync(SaveCertifiedPayrollStatementCommand command, CancellationToken cancellationToken = default);
    Task<Result<CertifiedPayrollReportDto>> SubmitAsync(SubmitCertifiedPayrollCommand command, CancellationToken cancellationToken = default);
}
