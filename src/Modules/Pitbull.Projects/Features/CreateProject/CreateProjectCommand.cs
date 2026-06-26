using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;

namespace Pitbull.Projects.Features.CreateProject;

public record CreateProjectPhaseInput(string Name, string CostCode, decimal BudgetAmount = 0);

public record CreateProjectTeamMemberInput(
    Guid EmployeeId,
    string? Role,
    AssignmentRole AssignmentRole = AssignmentRole.Worker);

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
    Guid? SourceBidId,
    List<CreateProjectPhaseInput>? Phases = null,
    List<CreateProjectTeamMemberInput>? TeamMembers = null,
    bool ActivateOnCreate = false
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
