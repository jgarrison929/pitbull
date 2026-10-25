using Pitbull.Contracts.Features.SOV;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Services;

public interface ISOVService
{
    Task<Result<SOVDto>> GetBySubcontractAsync(Guid subcontractId, CancellationToken ct = default);
    Task<Result<SOVDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<SOVDto>> CreateAsync(Guid subcontractId, CreateSOVCommand command, CancellationToken ct = default);
    Task<Result<SOVSummaryDto>> GetSummaryAsync(Guid id, CancellationToken ct = default);

    // Line Items
    Task<Result<SOVLineItemDto>> AddLineItemAsync(Guid sovId, CreateSOVLineItemCommand command, CancellationToken ct = default);
    Task<Result<SOVLineItemDto>> UpdateLineItemAsync(Guid sovId, Guid lineItemId, UpdateSOVLineItemCommand command, CancellationToken ct = default);
    Task<Result> DeleteLineItemAsync(Guid sovId, Guid lineItemId, CancellationToken ct = default);
    Task<Result> ReorderLineItemsAsync(Guid sovId, ReorderSOVLineItemsCommand command, CancellationToken ct = default);
}
