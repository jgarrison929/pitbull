using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;

namespace Pitbull.Projects.Features.DeleteProject;

public sealed class DeleteProjectHandler(PitbullDbContext db)
    : IRequestHandler<DeleteProjectCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(
        DeleteProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);

        if (project is null)
            return Result.Failure<bool>("Project not found", "NOT_FOUND");

        // Perform soft delete
        project.IsDeleted = true;
        project.DeletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}
