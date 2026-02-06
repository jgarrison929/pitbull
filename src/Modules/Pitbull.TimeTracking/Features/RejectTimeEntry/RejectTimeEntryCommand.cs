using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.RejectTimeEntry;

/// <summary>
/// Reject a time entry with a reason
/// </summary>
public record RejectTimeEntryCommand(
    Guid TimeEntryId,
    Guid RejectedById,
    string Reason
) : IRequest<Result<TimeEntryDto>>;

public sealed class RejectTimeEntryHandler(PitbullDbContext db)
    : IRequestHandler<RejectTimeEntryCommand, Result<TimeEntryDto>>
{
    public async Task<Result<TimeEntryDto>> Handle(
        RejectTimeEntryCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure<TimeEntryDto>("Rejection reason is required", "REASON_REQUIRED");

        var timeEntry = await db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Project)
            .Include(te => te.CostCode)
            .FirstOrDefaultAsync(te => te.Id == request.TimeEntryId, cancellationToken);

        if (timeEntry is null)
            return Result.Failure<TimeEntryDto>("Time entry not found", "NOT_FOUND");

        if (timeEntry.Status == TimeEntryStatus.Draft)
            return Result.Failure<TimeEntryDto>("Cannot reject a draft entry. It must be submitted first.", "INVALID_STATUS");

        // Verify rejecter exists
        var rejecter = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.RejectedById, cancellationToken);

        if (rejecter is null)
            return Result.Failure<TimeEntryDto>("Reviewer not found", "REVIEWER_NOT_FOUND");

        // Reject the entry
        timeEntry.Status = TimeEntryStatus.Rejected;
        timeEntry.RejectionReason = request.Reason;
        timeEntry.ApprovedById = null;
        timeEntry.ApprovedAt = null;
        timeEntry.ApprovalComments = null;
        timeEntry.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(TimeEntryMapper.ToDto(timeEntry));
    }
}
