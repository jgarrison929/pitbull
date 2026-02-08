using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.ListSubcontracts;

public record ListSubcontractsQuery(
    Guid? ProjectId = null,
    SubcontractStatus? Status = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 20
) : IQuery<PagedResult<SubcontractDto>>;
