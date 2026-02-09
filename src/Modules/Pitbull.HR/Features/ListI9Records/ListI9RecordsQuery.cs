using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListI9Records;

public record ListI9RecordsQuery(
    Guid? EmployeeId = null, I9Status? Status = null, bool? NeedsReverification = null
) : IRequest<Result<PagedResult<I9RecordListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
