using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.ListDeductions;

public record ListDeductionsQuery(
    Guid? EmployeeId = null, string? DeductionCode = null, bool? ActiveOnly = null
) : IRequest<Result<PagedResult<DeductionListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
