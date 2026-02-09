using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.ListWithholdingElections;

public record ListWithholdingElectionsQuery(
    Guid? EmployeeId = null,
    string? TaxJurisdiction = null,
    bool? CurrentOnly = null
) : IRequest<Result<PagedResult<WithholdingElectionListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
