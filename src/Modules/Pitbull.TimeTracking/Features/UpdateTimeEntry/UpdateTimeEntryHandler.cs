using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features.UpdateTimeEntry;

public sealed class UpdateTimeEntryHandler(PitbullDbContext db)
    : IRequestHandler<UpdateTimeEntryCommand, Result<TimeEntryDto>>
{
    public async Task<Result<TimeEntryDto>> Handle(
        UpdateTimeEntryCommand request, CancellationToken cancellationToken)
    {
        // Fetch the time entry
        var timeEntry = await db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .FirstOrDefaultAsync(te => te.Id == request.TimeEntryId, cancellationToken);

        if (timeEntry == null)
            return Result.Failure<TimeEntryDto>("Time entry not found", "NOT_FOUND");

        // Handle status transition if requested
        if (request.NewStatus.HasValue)
        {
            var transitionResult = await ValidateAndApplyStatusTransition(
                timeEntry, request, cancellationToken);

            if (!transitionResult.IsSuccess)
                return Result.Failure<TimeEntryDto>(transitionResult.Error!, transitionResult.ErrorCode);
        }

        // Update hours only if entry is in Draft or Submitted status
        if (CanEditHours(timeEntry.Status))
        {
            if (request.RegularHours.HasValue)
                timeEntry.RegularHours = request.RegularHours.Value;

            if (request.OvertimeHours.HasValue)
                timeEntry.OvertimeHours = request.OvertimeHours.Value;

            if (request.DoubletimeHours.HasValue)
                timeEntry.DoubletimeHours = request.DoubletimeHours.Value;

            if (request.Description != null)
                timeEntry.Description = request.Description;
        }
        else if (request.RegularHours.HasValue || request.OvertimeHours.HasValue ||
                 request.DoubletimeHours.HasValue)
        {
            return Result.Failure<TimeEntryDto>(
                "Cannot modify hours on approved or rejected time entries",
                "INVALID_STATUS");
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(TimeEntryMapper.ToDto(timeEntry));
    }

    private async Task<Result> ValidateAndApplyStatusTransition(
        TimeEntry timeEntry,
        UpdateTimeEntryCommand request,
        CancellationToken cancellationToken)
    {
        var currentStatus = timeEntry.Status;
        var newStatus = request.NewStatus!.Value;

        // Validate status transition is allowed
        if (!IsValidTransition(currentStatus, newStatus))
        {
            return Result.Failure(
                $"Cannot transition from {currentStatus} to {newStatus}",
                "INVALID_TRANSITION");
        }

        // For approval/rejection, validate approver has permission
        if (newStatus == TimeEntryStatus.Approved || newStatus == TimeEntryStatus.Rejected)
        {
            if (!request.ApproverId.HasValue)
            {
                return Result.Failure(
                    "Approver ID is required for approval/rejection",
                    "MISSING_APPROVER");
            }

            var hasPermission = await ValidateApproverPermission(
                request.ApproverId.Value,
                timeEntry.EmployeeId,
                cancellationToken);

            if (!hasPermission)
            {
                return Result.Failure(
                    "User does not have permission to approve/reject this time entry",
                    "UNAUTHORIZED");
            }

            // Set approval/rejection details
            timeEntry.ApprovedById = request.ApproverId.Value;
            timeEntry.ApprovedAt = DateTime.UtcNow;

            if (newStatus == TimeEntryStatus.Approved)
            {
                timeEntry.ApprovalComments = request.ApproverNotes;
                timeEntry.RejectionReason = null;
            }
            else if (newStatus == TimeEntryStatus.Rejected)
            {
                if (string.IsNullOrWhiteSpace(request.ApproverNotes))
                {
                    return Result.Failure(
                        "Rejection reason is required",
                        "MISSING_REJECTION_REASON");
                }
                timeEntry.RejectionReason = request.ApproverNotes;
                timeEntry.ApprovalComments = null;
            }
        }

        timeEntry.Status = newStatus;
        return Result.Success();
    }

    private async Task<bool> ValidateApproverPermission(
        Guid approverId,
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        // Get the approver
        var approver = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == approverId && e.IsActive, cancellationToken);

        if (approver == null)
            return false;

        // Supervisors can approve
        if (approver.Classification == EmployeeClassification.Supervisor)
            return true;

        // Salaried employees (typically managers) can approve
        if (approver.Classification == EmployeeClassification.Salaried)
            return true;

        // Check if approver is the employee's direct supervisor
        var employee = await db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == employeeId, cancellationToken);

        if (employee?.SupervisorId == approverId)
            return true;

        return false;
    }

    private static bool IsValidTransition(TimeEntryStatus from, TimeEntryStatus to)
    {
        return (from, to) switch
        {
            // Draft can go to Submitted
            (TimeEntryStatus.Draft, TimeEntryStatus.Submitted) => true,

            // Submitted can go to Approved, Rejected, or back to Draft
            (TimeEntryStatus.Submitted, TimeEntryStatus.Approved) => true,
            (TimeEntryStatus.Submitted, TimeEntryStatus.Rejected) => true,
            (TimeEntryStatus.Submitted, TimeEntryStatus.Draft) => true,

            // Rejected can go back to Draft (for corrections) or resubmitted
            (TimeEntryStatus.Rejected, TimeEntryStatus.Draft) => true,
            (TimeEntryStatus.Rejected, TimeEntryStatus.Submitted) => true,

            // Approved entries generally shouldn't change, but allow reverting if needed
            (TimeEntryStatus.Approved, TimeEntryStatus.Submitted) => true,

            // Same status is a no-op, allow it
            var (f, t) when f == t => true,

            _ => false
        };
    }

    private static bool CanEditHours(TimeEntryStatus status) => status == TimeEntryStatus.Draft || status == TimeEntryStatus.Submitted;
}
