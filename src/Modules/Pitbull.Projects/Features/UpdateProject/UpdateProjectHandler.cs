using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Projects.Features.UpdateProject;

public sealed class UpdateProjectHandler(PitbullDbContext db)
    : IRequestHandler<UpdateProjectCommand, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(
        UpdateProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (project is null)
            return Result.Failure<ProjectDto>("Project not found", "NOT_FOUND");

        project.Name = request.Name;
        project.Number = request.Number;
        project.Description = request.Description;
        project.Status = request.Status;
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
        project.ActualCompletionDate = request.ActualCompletionDate;
        project.ContractAmount = request.ContractAmount;
        project.ProjectManagerId = request.ProjectManagerId;
        project.SuperintendentId = request.SuperintendentId;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<ProjectDto>(
                "This project was modified by another user. Please refresh and try again.",
                "CONFLICT");
        }

        return Result.Success(CreateProjectHandler.MapToDto(project));
    }
}
