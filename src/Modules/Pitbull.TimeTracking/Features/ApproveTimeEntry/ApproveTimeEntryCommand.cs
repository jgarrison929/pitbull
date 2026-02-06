using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.ApproveTimeEntry;

/// <summary>
/// Approve a time entry
/// </summary>
public record ApproveTimeEntryCommand(
    Guid TimeEntryId,
    Guid ApprovedById,
    string? Comments = null
) : IRequest<Result<TimeEntryDto>>;

public sealed class ApproveTimeEntryHandler(PitbullDbContext db)
    : IRequestHandler<ApproveTimeEntryCommand, Result<TimeEntryDto>>
{
    public async Task<Result<TimeEntryDto>> Handle(
        ApproveTimeEntryCommand request, CancellationToken cancellationToken)
    {
        var timeEntry = await db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Project)
            .Include(te => te.CostCode)
            .FirstOrDefaultAsync(te => te.Id == request.TimeEntryId, cancellationToken);

        if (timeEntry is null)
            return Result.Failure<TimeEntryDto>("Time entry not found", "NOT_FOUND");

        if (timeEntry.Status == TimeEntryStatus.Approved)
            return Result.Failure<TimeEntryDto>("Time entry is already approved", "ALREADY_APPROVED");

        if (timeEntry.Status == TimeEntryStatus.Draft)
            return Result.Failure<TimeEntryDto>("Cannot approve a draft entry. It must be submitted first.", "INVALID_STATUS");

        // Verify approver exists
        var approver = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.ApprovedById, cancellationToken);

        if (approver is null)
            return Result.Failure<TimeEntryDto>("Approver not found", "APPROVER_NOT_FOUND");

        // Approve the entry
        timeEntry.Status = TimeEntryStatus.Approved;
        timeEntry.ApprovedById = request.ApprovedById;
        timeEntry.ApprovedAt = DateTime.UtcNow;
        timeEntry.ApprovalComments = request.Comments;
        timeEntry.RejectionReason = null; // Clear any previous rejection reason
        timeEntry.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        // Reload with approver name
        await db.Entry(timeEntry).Reference(te => te.ApprovedBy).LoadAsync(cancellationToken);

        return Result.Success(TimeEntryMapper.ToDto(timeEntry));
    }
}
