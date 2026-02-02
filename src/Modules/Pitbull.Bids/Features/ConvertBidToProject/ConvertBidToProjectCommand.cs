using Pitbull.Core.CQRS;

namespace Pitbull.Bids.Features.ConvertBidToProject;

public record ConvertBidToProjectCommand(
    Guid BidId,
    string ProjectNumber
) : ICommand<ConvertBidToProjectResult>;

public record ConvertBidToProjectResult(
    Guid ProjectId,
    Guid BidId,
    string ProjectName,
    string ProjectNumber
);
