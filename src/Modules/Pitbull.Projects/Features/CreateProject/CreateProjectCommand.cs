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
    DateTime CreatedAt,
    /// <summary>Latest non-draft/void G702 completed &amp; stored (when enriched).</summary>
    decimal? BilledToDate = null,
    /// <summary>ContractAmount − BilledToDate (when enriched).</summary>
    decimal? UnbilledAmount = null,
    /// <summary>Approved labor (+ equip) spend vs contract (when enriched for budget alerts).</summary>
    decimal? LaborSpent = null,
    decimal? LaborPercentOfContract = null
);

/// <summary>
/// Slim project row for phone pickers (GET /api/projects?view=mobile). Omits address, client, billing enrichments.
/// </summary>
public record ProjectMobileListItemDto(
    Guid Id,
    string Name,
    string Number,
    ProjectStatus Status
);

public static class ProjectListViewMapper
{
    public static ProjectMobileListItemDto ToMobileListItem(ProjectDto p) =>
        new(p.Id, p.Name, p.Number, p.Status);
}
