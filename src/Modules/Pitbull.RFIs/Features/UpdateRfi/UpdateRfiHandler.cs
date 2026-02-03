using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features.UpdateRfi;

public class UpdateRfiHandler(PitbullDbContext db) : IRequestHandler<UpdateRfiCommand, Result<RfiDto>>
{
    public async Task<Result<RfiDto>> Handle(UpdateRfiCommand request, CancellationToken cancellationToken)
    {
        var rfi = await db.Set<Rfi>()
            .FirstOrDefaultAsync(r => r.Id == request.Id && r.ProjectId == request.ProjectId,
                cancellationToken);

        if (rfi is null)
            return Result.Failure<RfiDto>("RFI not found", "NOT_FOUND");

        rfi.Subject = request.Subject;
        rfi.Question = request.Question;
        rfi.Answer = request.Answer;
        rfi.Priority = request.Priority;
        rfi.DueDate = request.DueDate;
        rfi.AssignedToUserId = request.AssignedToUserId;
        rfi.AssignedToName = request.AssignedToName;
        rfi.BallInCourtUserId = request.BallInCourtUserId;
        rfi.BallInCourtName = request.BallInCourtName;

        // Status transition logic with timestamps
        if (request.Status == RfiStatus.Answered && rfi.Status == RfiStatus.Open)
        {
            rfi.AnsweredAt = DateTime.UtcNow;
        }
        if (request.Status == RfiStatus.Closed && rfi.Status != RfiStatus.Closed)
        {
            rfi.ClosedAt = DateTime.UtcNow;
        }
        rfi.Status = request.Status;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(RfiMapper.ToDto(rfi));
    }
}