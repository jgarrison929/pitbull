using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Http;
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
public class ProjectService(
    PitbullDbContext db,
    IValidator<CreateProjectCommand> createValidator,
    IValidator<UpdateProjectCommand> updateValidator,
    IHttpContextAccessor? httpContextAccessor,
    ILogger<ProjectService> logger) : IProjectService
{
    private readonly PitbullDbContext _db = db;
    private readonly IValidator<CreateProjectCommand> _createValidator = createValidator;
    private readonly IValidator<UpdateProjectCommand> _updateValidator = updateValidator;
    private readonly IHttpContextAccessor? _httpContextAccessor = httpContextAccessor;
    private readonly ILogger<ProjectService> _logger = logger;

    private string GetCurrentUserId()
    {
        var user = _httpContextAccessor?.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? user.FindFirstValue("sub");
            if (!string.IsNullOrEmpty(userId))
                return userId;
        }
        return "system";
    }

    public async Task<Result<ProjectDto>> GetProjectAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found", id);
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
        }

        return Result.Success(MapToDto(project));
    }

    public async Task<Result<PagedResult<ProjectDto>>> GetProjectsAsync(ListProjectsQuery listQuery, CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.Set<Project>().AsNoTracking().Where(p => !p.IsDeleted);

        // Apply filtering logic (from ListProjectsHandler)
        if (!string.IsNullOrWhiteSpace(listQuery.Search))
        {
            var searchTerm = listQuery.Search.ToLower();
            dbQuery = dbQuery.Where(p =>
                p.Name.Contains(searchTerm, StringComparison.CurrentCultureIgnoreCase) ||
                p.Number.ToLower().Contains(searchTerm) ||
                (p.ClientName != null && p.ClientName.Contains(searchTerm, StringComparison.CurrentCultureIgnoreCase)));
        }

        if (listQuery.Status.HasValue)
        {
            dbQuery = dbQuery.Where(p => p.Status == listQuery.Status.Value);
        }

        if (listQuery.Type.HasValue)
        {
            dbQuery = dbQuery.Where(p => p.Type == listQuery.Type.Value);
        }

        // Get total count for pagination
        var totalCount = await dbQuery.CountAsync(cancellationToken);

        // Apply pagination and get results
        var projects = await dbQuery
            .OrderByDescending(p => p.CreatedAt)
            .Skip((listQuery.Page - 1) * listQuery.PageSize)
            .Take(listQuery.PageSize)
            .ToArrayAsync(cancellationToken);

        var dtos = projects.Select(MapToDto).ToArray();
        var result = new PagedResult<ProjectDto>(dtos, totalCount, listQuery.Page, listQuery.PageSize);
        return Result.Success(result);
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
            Status = ProjectStatus.PreConstruction,
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

    public async Task<Result<ProjectDto>> UpdateProjectAsync(UpdateProjectCommand command, CancellationToken cancellationToken = default)
    {
        // Validate request
        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            _logger.LogWarning("Project update validation failed for {ProjectId}: {Errors}", command.Id, errors);
            return Result.Failure<ProjectDto>(errors, "VALIDATION_ERROR");
        }

        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == command.Id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found for update", command.Id);
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");
        }

        // Update fields
        project.Name = command.Name;
        project.Number = command.Number;
        project.Description = command.Description;
        project.Status = command.Status;
        project.Type = command.Type;
        project.Address = command.Address;
        project.City = command.City;
        project.State = command.State;
        project.ZipCode = command.ZipCode;
        project.ClientName = command.ClientName;
        project.ClientContact = command.ClientContact;
        project.ClientEmail = command.ClientEmail;
        project.ClientPhone = command.ClientPhone;
        project.StartDate = command.StartDate;
        project.EstimatedCompletionDate = command.EstimatedCompletionDate;
        project.ActualCompletionDate = command.ActualCompletionDate;
        project.ContractAmount = command.ContractAmount;
        project.ProjectManagerId = command.ProjectManagerId;
        project.SuperintendentId = command.SuperintendentId;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Updated project {ProjectId} '{ProjectName}'", project.Id, project.Name);
            return Result.Success(MapToDto(project));
        }
        catch (DbUpdateConcurrencyException)
        {
            _logger.LogWarning("Concurrency conflict updating project {ProjectId}", command.Id);
            return Result.Failure<ProjectDto>(
                "This project was modified by another user. Please refresh and try again.",
                "CONFLICT");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update project {ProjectId}", command.Id);
            return Result.Failure<ProjectDto>("Failed to update project", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteProjectAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            _logger.LogWarning("Project {ProjectId} not found for deletion", id);
            return Result.Failure("Project not found", "NOT_FOUND");
        }

        // Perform soft delete (matches existing DeleteProjectHandler)
        project.IsDeleted = true;
        project.DeletedAt = DateTime.UtcNow;
        project.DeletedBy = GetCurrentUserId();

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Soft deleted project {ProjectId} '{ProjectName}'", project.Id, project.Name);
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
