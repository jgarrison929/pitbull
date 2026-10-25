using Pitbull.Core.CQRS;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features.ListProjects;

public record ListProjectsQuery(
    ProjectStatus? Status = null,
    ProjectType? Type = null,
    string? Search = null,
    /// <summary>Only projects with remaining unbilled contract value (G702 progress).</summary>
    bool UnbilledOnly = false,
    /// <summary>Only projects where labor spend ≥ BudgetAlertPercent of contract (proxy).</summary>
    bool BudgetAlert = false,
    /// <summary>Threshold for BudgetAlert (default 75).</summary>
    int BudgetAlertPercent = 75,
    /// <summary>Exclude Completed projects (matches RoleDashboardSummary ActiveProjectCount).</summary>
    bool ExcludeCompleted = false
) : PaginationQuery, IQuery<PagedResult<ProjectDto>>;
