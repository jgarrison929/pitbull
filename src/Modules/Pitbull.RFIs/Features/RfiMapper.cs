using Pitbull.RFIs.Domain;

namespace Pitbull.RFIs.Features;

internal static class RfiMapper
{
    public static RfiDto ToDto(Rfi rfi) => new(
        rfi.Id,
        rfi.Number,
        rfi.Subject,
        rfi.Question,
        rfi.Answer,
        rfi.Status,
        rfi.Priority,
        rfi.DueDate,
        rfi.AnsweredAt,
        rfi.ClosedAt,
        rfi.ProjectId,
        rfi.BallInCourtUserId,
        rfi.BallInCourtName,
        rfi.AssignedToUserId,
        rfi.AssignedToName,
        rfi.CreatedByName,
        rfi.CreatedAt
    );
}
