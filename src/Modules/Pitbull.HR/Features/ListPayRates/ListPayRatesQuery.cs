using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.ListPayRates;

public record ListPayRatesQuery(
    Guid? EmployeeId = null,
    RateType? RateType = null,
    Guid? ProjectId = null,
    string? ShiftCode = null,
    string? WorkState = null,
    bool? ActiveOnly = null,
    DateOnly? AsOfDate = null
) : IRequest<Result<PagedResult<PayRateListDto>>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}
