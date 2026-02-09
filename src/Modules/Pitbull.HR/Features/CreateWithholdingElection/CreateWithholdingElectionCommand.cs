using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateWithholdingElection;

public record CreateWithholdingElectionCommand(
    Guid EmployeeId,
    string TaxJurisdiction,
    FilingStatus FilingStatus,
    int Allowances,
    decimal AdditionalWithholding,
    bool IsExempt,
    bool MultipleJobsOrSpouseWorks,
    decimal? DependentCredits,
    decimal? OtherIncome,
    decimal? Deductions,
    DateOnly EffectiveDate,
    DateOnly? SignedDate,
    string? Notes
) : IRequest<Result<WithholdingElectionDto>>;
