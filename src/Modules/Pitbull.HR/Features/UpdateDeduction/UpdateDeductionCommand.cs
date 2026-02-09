using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateDeduction;

public record UpdateDeductionCommand(
    Guid Id, string Description, DeductionMethod Method, decimal Amount,
    decimal? MaxPerPeriod, decimal? AnnualMax, int? Priority, bool IsPreTax,
    decimal? EmployerMatch, decimal? EmployerMatchMax, DateOnly? ExpirationDate,
    string? CaseNumber, string? GarnishmentPayee, string? Notes
) : IRequest<Result<DeductionDto>>;
