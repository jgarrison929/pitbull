using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;

namespace Pitbull.Projects.Features.CreateProject;

public class CreateProjectHandler(PitbullDbContext db)
    : IRequestHandler<CreateProjectCommand, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(
        CreateProjectCommand request, CancellationToken cancellationToken)
    {
        var project = new Project
        {
            Name = request.Name,
            Number = request.Number,
            Description = request.Description,
            Type = request.Type,
            Status = ProjectStatus.Bidding,
            Address = request.Address,
            City = request.City,
            State = request.State,
            ZipCode = request.ZipCode,
            ClientName = request.ClientName,
            ClientContact = request.ClientContact,
            ClientEmail = request.ClientEmail,
            ClientPhone = request.ClientPhone,
            StartDate = request.StartDate,
            EstimatedCompletionDate = request.EstimatedCompletionDate,
            ContractAmount = request.ContractAmount,
            ProjectManagerId = request.ProjectManagerId,
            SuperintendentId = request.SuperintendentId,
            SourceBidId = request.SourceBidId
        };

        db.Set<Project>().Add(project);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(MapToDto(project));
    }

    internal static ProjectDto MapToDto(Project p) => new(
        p.Id, p.Name, p.Number, p.Description, p.Status, p.Type,
        p.Address, p.City, p.State, p.ZipCode,
        p.ClientName, p.ClientContact, p.ClientEmail, p.ClientPhone,
        p.StartDate, p.EstimatedCompletionDate, p.ActualCompletionDate,
        p.ContractAmount, p.ProjectManagerId, p.SuperintendentId,
        p.SourceBidId, p.CreatedAt
    );
}
