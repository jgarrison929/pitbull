using Pitbull.Core.CQRS;
using Pitbull.Bids.Features;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.ConvertBidToProject;

namespace Pitbull.Bids.Services;

/// <summary>
/// Service for managing bid operations, replacing MediatR-based handlers.
/// Provides direct, testable methods for all bid-related business logic.
/// </summary>
public interface IBidService
{
    // Query operations
    Task<Result<BidDto>> GetBidAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<BidDto>>> GetBidsAsync(ListBidsQuery query, CancellationToken cancellationToken = default);

    // Command operations
    Task<Result<BidDto>> CreateBidAsync(CreateBidCommand command, CancellationToken cancellationToken = default);
    Task<Result<BidDto>> UpdateBidAsync(UpdateBidCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteBidAsync(Guid id, CancellationToken cancellationToken = default);
    
    // Special operations
    Task<Result<ConvertBidToProjectResult>> ConvertToProjectAsync(ConvertBidToProjectCommand command, CancellationToken cancellationToken = default);
}