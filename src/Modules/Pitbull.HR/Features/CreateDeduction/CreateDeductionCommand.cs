using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateDeduction;

public record CreateDeductionCommand(
    Guid EmployeeId, string DeductionCode, string Description, DeductionMethod Method,
    decimal Amount, decimal? MaxPerPeriod, decimal? AnnualMax, int? Priority, bool IsPreTax,
    decimal? EmployerMatch, decimal? EmployerMatchMax, DateOnly EffectiveDate,
    string? CaseNumber, string? GarnishmentPayee, string? Notes
) : IRequest<Result<DeductionDto>>;
