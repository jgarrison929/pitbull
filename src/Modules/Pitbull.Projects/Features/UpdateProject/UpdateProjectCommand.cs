using Pitbull.Core.CQRS;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features.UpdateProject;

public record UpdateProjectCommand(
    Guid Id,
    string Name,
    string Number,
    string? Description,
    ProjectStatus Status,
    ProjectType Type,
    string? Address,
    string? City,
    string? State,
    string? ZipCode,
    string? ClientName,
    string? ClientContact,
    string? ClientEmail,
    string? ClientPhone,
    DateTime? StartDate,
    DateTime? EstimatedCompletionDate,
    DateTime? ActualCompletionDate,
    decimal ContractAmount,
    Guid? ProjectManagerId,
    Guid? SuperintendentId
) : ICommand<ProjectDto>;
