using Pitbull.Billing.Features.WageDeterminations;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IWageDeterminationService
{
    Task<Result<ListWageDeterminationsResult>> ListAsync(ListWageDeterminationsQuery query, CancellationToken cancellationToken = default);
    Task<Result<WageDeterminationDto>> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<WageDeterminationDto>> CreateAsync(CreateWageDeterminationCommand command, CancellationToken cancellationToken = default);
    Task<Result<WageDeterminationDto>> UpdateAsync(UpdateWageDeterminationCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<ApplicableWageRateDto>> LookupRateAsync(ApplicableWageRateLookup lookup, CancellationToken cancellationToken = default);
}
