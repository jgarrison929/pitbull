using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateCertification;

public record UpdateCertificationCommand(
    Guid Id,
    string CertificationTypeCode,
    string CertificationName,
    string? CertificateNumber,
    string? IssuingAuthority,
    DateOnly IssueDate,
    DateOnly? ExpirationDate,
    CertificationStatus? Status
) : IRequest<Result<CertificationDto>>;
