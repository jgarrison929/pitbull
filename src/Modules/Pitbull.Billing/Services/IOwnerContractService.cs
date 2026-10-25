using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Core.CQRS;

namespace Pitbull.Billing.Services;

public interface IOwnerContractService
{
    // Owner Contracts
    Task<Result<ListOwnerContractsResult>> ListContractsAsync(ListOwnerContractsQuery query, CancellationToken ct = default);
    Task<Result<OwnerContractDto>> GetContractAsync(Guid id, CancellationToken ct = default);
    Task<Result<OwnerContractDto>> CreateContractAsync(CreateOwnerContractCommand command, CancellationToken ct = default);
    Task<Result<OwnerContractDto>> UpdateContractAsync(UpdateOwnerContractCommand command, CancellationToken ct = default);
    Task<Result> DeleteContractAsync(Guid id, CancellationToken ct = default);

    // Owner SOV
    Task<Result<OwnerSOVDto>> GetSOVAsync(Guid ownerContractId, CancellationToken ct = default);
    Task<Result<OwnerSOVDto>> CreateSOVAsync(CreateOwnerSOVCommand command, CancellationToken ct = default);
    Task<Result<OwnerSOVDto>> ActivateSOVAsync(Guid sovId, CancellationToken ct = default);

    // SOV Line Items
    Task<Result<OwnerSOVLineItemDto>> AddLineItemAsync(AddSOVLineItemCommand command, CancellationToken ct = default);
    Task<Result<OwnerSOVLineItemDto>> UpdateLineItemAsync(UpdateSOVLineItemCommand command, CancellationToken ct = default);
    Task<Result> DeleteLineItemAsync(Guid lineItemId, CancellationToken ct = default);
}
