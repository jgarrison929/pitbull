using Pitbull.Core.CQRS;
using Pitbull.Projects.Domain;

namespace Pitbull.Projects.Features.CreateProject;

public record CreateProjectCommand(
    string Name,
    string Number,
    string? Description,
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
    decimal ContractAmount,
    Guid? ProjectManagerId,
    Guid? SuperintendentId,
    Guid? SourceBidId
) : ICommand<ProjectDto>;

public record ProjectDto(
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
    Guid? SuperintendentId,
    Guid? SourceBidId,
    DateTime CreatedAt
);
