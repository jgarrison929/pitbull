using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.CreateRfi;

public sealed class CreateRfiHandler(PitbullDbContext db) : IRequestHandler<CreateRfiCommand, Result<RfiDto>>
{
    public async Task<Result<RfiDto>> Handle(CreateRfiCommand request, CancellationToken cancellationToken)
    {
        // Auto-assign next sequential number for this project
        var maxNumber = await db.Set<Rfi>()
            .Where(r => r.ProjectId == request.ProjectId)
            .MaxAsync(r => (int?)r.Number, cancellationToken) ?? 0;

        var rfi = new Rfi
        {
            Number = maxNumber + 1,
            Subject = request.Subject,
            Question = request.Question,
            Priority = request.Priority,
            DueDate = request.DueDate,
            ProjectId = request.ProjectId,
            AssignedToUserId = request.AssignedToUserId,
            AssignedToName = request.AssignedToName,
            BallInCourtUserId = request.BallInCourtUserId ?? request.AssignedToUserId,
            BallInCourtName = request.BallInCourtName ?? request.AssignedToName,
            CreatedByName = request.CreatedByName
        };

        db.Set<Rfi>().Add(rfi);
        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(RfiMapper.ToDto(rfi));
    }
}