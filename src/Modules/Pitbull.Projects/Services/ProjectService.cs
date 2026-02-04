using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;

namespace Pitbull.Projects.Services;

/// <summary>
/// Direct service implementation for project operations, replacing MediatR handlers.
/// Provides clean, testable methods for all project-related business logic.
/// </summary>
public class ProjectService : IProjectService
{
    private readonly PitbullDbContext _db;
    private readonly IValidator<CreateProjectCommand> _createValidator;
    private readonly IValidator<UpdateProjectCommand> _updateValidator;
    private readonly ILogger<ProjectService> _logger;

    public ProjectService(
        PitbullDbContext db,
        IValidator<CreateProjectCommand> createValidator,
        IValidator<UpdateProjectCommand> updateValidator,
        ILogger<ProjectService> logger)
    {
        _db = db;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _logger = logger;
    }

    public async Task<Result<ProjectDto>> GetProjectAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found", id);
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
        }

        return Result.Success(MapToDto(project));
    }

    public async Task<Result<ProjectDto[]>> GetProjectsAsync(GetProjectsFilter? filter = null, CancellationToken cancellationToken = default)
    {
        var query = _db.Set<Project>().AsNoTracking();

        // Apply filtering logic (from ListProjectsHandler)
        if (filter != null)
        {
            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                var searchTerm = filter.Search.ToLower();
                query = query.Where(p => 
                    p.Name.ToLower().Contains(searchTerm) ||
                    p.Number.ToLower().Contains(searchTerm) ||
                    (p.ClientName != null && p.ClientName.ToLower().Contains(searchTerm)));
            }

            if (filter.Status.HasValue)
            {
                query = query.Where(p => p.Status == filter.Status.Value);
            }

            if (filter.Type.HasValue)
            {
                query = query.Where(p => p.Type == filter.Type.Value);
            }

            if (filter.ProjectManagerId.HasValue)
            {
                query = query.Where(p => p.ProjectManagerId == filter.ProjectManagerId.Value);
            }
        }

        var projects = await query
            .OrderBy(p => p.Name)
            .ToArrayAsync(cancellationToken);

        var dtos = projects.Select(MapToDto).ToArray();
        return Result.Success(dtos);
    }

    public async Task<Result<ProjectDto>> CreateProjectAsync(CreateProjectCommand request, CancellationToken cancellationToken = default)
    {
        // Validate request
        var validationResult = await _createValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            _logger.LogWarning("Project creation validation failed: {Errors}", errors);
            return Result.Failure<ProjectDto>(errors, "VALIDATION_ERROR");
        }

        // Create project entity
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Number = request.Number,
            Description = request.Description,
            Status = ProjectStatus.Planning,
            Type = request.Type,
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
            SourceBidId = request.SourceBidId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Set<Project>().Add(project);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Created project {ProjectId} '{ProjectName}'", project.Id, project.Name);
            return Result.Success(MapToDto(project));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create project '{ProjectName}'", request.Name);
            return Result.Failure<ProjectDto>("Failed to create project", "DATABASE_ERROR");
        }
    }

    public async Task<Result<ProjectDto>> UpdateProjectAsync(Guid id, UpdateProjectCommand request, CancellationToken cancellationToken = default)
    {
        // Validate request
        var validationResult = await _updateValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            _logger.LogWarning("Project update validation failed for {ProjectId}: {Errors}", id, errors);
            return Result.Failure<ProjectDto>(errors, "VALIDATION_ERROR");
        }

        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found for update", id);
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
        }

        // Update fields
        project.Name = request.Name;
        project.Number = request.Number;
        project.Description = request.Description;
        project.Type = request.Type;
        project.Address = request.Address;
        project.City = request.City;
        project.State = request.State;
        project.ZipCode = request.ZipCode;
        project.ClientName = request.ClientName;
        project.ClientContact = request.ClientContact;
        project.ClientEmail = request.ClientEmail;
        project.ClientPhone = request.ClientPhone;
        project.StartDate = request.StartDate;
        project.EstimatedCompletionDate = request.EstimatedCompletionDate;
        project.ContractAmount = request.ContractAmount;
        project.ProjectManagerId = request.ProjectManagerId;
        project.SuperintendentId = request.SuperintendentId;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Updated project {ProjectId} '{ProjectName}'", project.Id, project.Name);
            return Result.Success(MapToDto(project));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update project {ProjectId}", id);
            return Result.Failure<ProjectDto>("Failed to update project", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteProjectAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found for deletion", id);
            return Result.Failure("Project not found", "NOT_FOUND");
        }

        _db.Set<Project>().Remove(project);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Deleted project {ProjectId} '{ProjectName}'", project.Id, project.Name);
            return Result.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete project {ProjectId}", id);
            return Result.Failure("Failed to delete project", "DATABASE_ERROR");
        }
    }

    /// <summary>
    /// Maps Project entity to ProjectDto (extracted from CreateProjectHandler)
    /// </summary>
    private static ProjectDto MapToDto(Project project)
    {
        return new ProjectDto(
            project.Id,
            project.Name,
            project.Number,
            project.Description,
            project.Status,
            project.Type,
            project.Address,
            project.City,
            project.State,
            project.ZipCode,
            project.ClientName,
            project.ClientContact,
            project.ClientEmail,
            project.ClientPhone,
            project.StartDate,
            project.EstimatedCompletionDate,
            project.ActualCompletionDate,
            project.ContractAmount,
            project.ProjectManagerId,
            project.SuperintendentId,
            project.SourceBidId,
            project.CreatedAt
        );
    }
}