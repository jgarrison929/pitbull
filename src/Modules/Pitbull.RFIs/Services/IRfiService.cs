using Pitbull.Core.CQRS;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.RFIs.Features.UpdateRfi;
using Pitbull.RFIs.Features.ListRfis;

namespace Pitbull.RFIs.Services;

/// <summary>
/// Service for managing RFI operations, replacing MediatR-based handlers.
/// Provides direct, testable methods for all RFI-related business logic.
/// </summary>
public interface IRfiService
{
    // Query operations
    Task<Result<RfiDto>> GetRfiAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<RfiDto>>> GetRfisAsync(ListRfisQuery query, CancellationToken cancellationToken = default);

    // Command operations
    Task<Result<RfiDto>> CreateRfiAsync(CreateRfiCommand command, CancellationToken cancellationToken = default);
    Task<Result<RfiDto>> UpdateRfiAsync(UpdateRfiCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteRfiAsync(Guid id, CancellationToken cancellationToken = default);
}