using Pitbull.Bids.Features.ConvertBidToProject;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.ListBids;
using Pitbull.Bids.Features.Shared;
using Pitbull.Bids.Features.UpdateBid;
using Pitbull.Core.CQRS;

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

    // Wizard data
    Task<Result<BidConversionPreviewDto>> GetConversionPreviewAsync(Guid bidId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Preview data for the bid-to-project conversion wizard.
/// </summary>
public record BidConversionPreviewDto(
    Guid BidId,
    string BidName,
    string BidNumber,
    decimal EstimatedValue,
    string? Owner,
    string? Description,
    IReadOnlyList<BidItemPreviewDto> Items
);

public record BidItemPreviewDto(
    Guid Id,
    string Description,
    string Category,
    decimal Quantity,
    decimal UnitCost,
    decimal TotalCost,
    string? SuggestedCostCode
);
