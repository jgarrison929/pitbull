using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features;

/// <summary>
/// Maps Project entities to DTOs.
/// </summary>
public static class ProjectMapper
{
    public static ProjectDto ToDto(Project p) => new(
        p.Id, p.Name, p.Number, p.Description, p.Status, p.Type,
        p.Address, p.City, p.State, p.ZipCode,
        p.ClientName, p.ClientContact, p.ClientEmail, p.ClientPhone,
        p.StartDate, p.EstimatedCompletionDate, p.ActualCompletionDate,
        p.ContractAmount, p.ProjectManagerId, p.SuperintendentId,
        p.SourceBidId, p.CreatedAt
    );
}
