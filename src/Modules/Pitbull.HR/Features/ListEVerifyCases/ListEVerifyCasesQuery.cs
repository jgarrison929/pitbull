using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListEVerifyCases;

public record ListEVerifyCasesQuery(
    Guid? EmployeeId = null, EVerifyStatus? Status = null, bool? NeedsAction = null
) : IRequest<Result<PagedResult<EVerifyCaseListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
