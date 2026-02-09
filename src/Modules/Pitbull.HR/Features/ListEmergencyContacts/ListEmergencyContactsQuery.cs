using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.ListEmergencyContacts;

public record ListEmergencyContactsQuery(
    Guid? EmployeeId = null
) : IRequest<Result<PagedResult<EmergencyContactListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
