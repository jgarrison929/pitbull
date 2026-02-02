using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;

namespace Pitbull.Bids.Features.ConvertBidToProject;

public class ConvertBidToProjectHandler(PitbullDbContext db)
    : IRequestHandler<ConvertBidToProjectCommand, Result<ConvertBidToProjectResult>>
{
    public async Task<Result<ConvertBidToProjectResult>> Handle(
        ConvertBidToProjectCommand request, CancellationToken cancellationToken)
    {
        var bid = await db.Set<Bid>()
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == request.BidId, cancellationToken);

        if (bid is null)
            return Result.Failure<ConvertBidToProjectResult>("Bid not found", "NOT_FOUND");

        if (bid.Status != BidStatus.Won)
            return Result.Failure<ConvertBidToProjectResult>(
                "Only won bids can be converted to projects", "INVALID_STATUS");

        if (bid.ProjectId.HasValue)
            return Result.Failure<ConvertBidToProjectResult>(
                "This bid has already been converted to a project", "ALREADY_CONVERTED");

        // Create project from bid
        var project = new Project
        {
            Name = bid.Name,
            Number = request.ProjectNumber,
            Description = bid.Description,
            Status = ProjectStatus.PreConstruction,
            Type = ProjectType.Commercial,
            ContractAmount = bid.EstimatedValue,
            SourceBidId = bid.Id
        };

        db.Set<Project>().Add(project);

        // Link bid to project
        bid.ProjectId = project.Id;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(new ConvertBidToProjectResult(
            project.Id, bid.Id, project.Name, project.Number));
    }
}
