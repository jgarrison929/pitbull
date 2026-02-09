using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.CreateCertification;

public record CreateCertificationCommand(
    Guid EmployeeId,
    string CertificationTypeCode,
    string CertificationName,
    string? CertificateNumber,
    string? IssuingAuthority,
    DateOnly IssueDate,
    DateOnly? ExpirationDate
) : IRequest<Result<CertificationDto>>;
