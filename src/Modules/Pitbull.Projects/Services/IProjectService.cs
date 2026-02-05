using Pitbull.Core.CQRS;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;

namespace Pitbull.Projects.Services;

/// <summary>
/// Service for managing project operations, replacing MediatR-based handlers.
/// Provides direct, testable methods for all project-related business logic.
/// </summary>
public interface IProjectService
{
    // Query operations
    Task<Result<ProjectDto>> GetProjectAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<ProjectDto>>> GetProjectsAsync(ListProjectsQuery query, CancellationToken cancellationToken = default);

    // Command operations  
    Task<Result<ProjectDto>> CreateProjectAsync(CreateProjectCommand command, CancellationToken cancellationToken = default);
    Task<Result<ProjectDto>> UpdateProjectAsync(UpdateProjectCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteProjectAsync(Guid id, CancellationToken cancellationToken = default);
}