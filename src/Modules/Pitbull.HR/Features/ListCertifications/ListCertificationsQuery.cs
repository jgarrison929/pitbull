using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListCertifications;

public record ListCertificationsQuery(
    Guid? EmployeeId = null,
    string? CertificationTypeCode = null,
    CertificationStatus? Status = null,
    bool? ExpiringSoon = null,  // Within 90 days
    bool? Expired = null
) : IRequest<Result<PagedResult<CertificationListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
